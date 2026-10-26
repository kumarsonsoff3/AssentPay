import { isIP } from "node:net";
import { Resend } from "resend";
import { Query, Storage } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { dataClient, dataDatabase } from "../data/client";
import { currentOperation } from "../data/coordinator";
import { InputError } from "../workspaces/validation";
import { audit, enqueue, notify, optionalRow, params, stableId, type Job } from "./store";
import type { GuardedCommit } from "./gmail-sync";
import { documentBucketId, maximumDocumentSize } from "./schema";
import { validateDocument } from "./documents";
import { safeGoogleConfirmationLink } from "../email-forwarding";
export function resendClient() {
  if (!process.env.RESEND_API_KEY) throw new InputError("Email provider is not configured.", 503, "RESEND_NOT_CONFIGURED");
  return new Resend(process.env.RESEND_API_KEY);
}
export class ResendReceivingError extends Error {
  readonly code: string;
  constructor(readonly status: number) {
    super("Received email could not be retrieved.");
    this.code = [401, 403].includes(status) ? "RESEND_RECEIVING_ACCESS_DENIED" : status === 429 ? "RESEND_RATE_LIMITED" : "RESEND_MESSAGE_UNAVAILABLE";
  }
}
export function verifyResend(raw: string, headers: Headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) throw new InputError("Inbound webhook verification is not configured.", 503);
  let event;
  try { event = resendClient().webhooks.verify({ payload: raw, headers: {
    id: headers.get("svix-id") || "", timestamp: headers.get("svix-timestamp") || "", signature: headers.get("svix-signature") || "",
  }, webhookSecret: secret }); } catch (e) {
    if (e instanceof InputError) throw e;
    throw new InputError("Invalid email webhook signature.", 401);
  }
  return event;
}
export async function acceptResend(event: ReturnType<typeof verifyResend>) {
  if (["email.delivered", "email.bounced", "email.failed", "email.suppressed", "email.complained"].includes(event.type)) {
    const data = event.data as { email_id?: string };
    if (!data.email_id) return { status: "ignored" };
    const deliveries = await dataDatabase().listRows({ ...params("notification_deliveries"), queries: [Query.equal("channel", "email"), Query.equal("providerId", data.email_id), Query.limit(10)] });
    return currentOperation().commit(async (db, tx) => {
      for (const delivery of deliveries.rows) {
        const latest = await db.getRow(params("notification_deliveries", delivery.$id, tx));
        const status = event.type.slice(6);
        if (latest.status === status || (["bounced", "complained", "suppressed", "failed"].includes(latest.status) && status === "delivered")) continue;
        await db.updateRow({ ...params("notification_deliveries", delivery.$id, tx), data: { status } });
        if (status !== "delivered") await notify(db, tx, delivery.workspaceId, `${delivery.$id}:${status}`, "Operational email delivery needs attention", "Review the recipient and sending domain. Payment receipts remain with PayPal.", "delivery");
      }
      return { status: "accepted" };
    });
  }
  if (event.type !== "email.received") return { status: "ignored" };
  const email = event.data;
  if (!email.email_id || email.email_id.length > 128 || !Array.isArray(email.to) || email.to.length > 50)
    throw new InputError("Invalid received email event.");
  // Use provider-signed destination metadata only, never embedded headers/body/AI.
  const addresses = [...new Set(email.to.map((v) => v.trim().toLowerCase()))];
  if (!addresses.length) return { status: "ignored" };
  if (addresses.length > 50) throw new InputError("Too many recipients.");
  const endpoints = await dataDatabase().listRows({ ...params("inbound_endpoints"), queries: [Query.equal("address", addresses), Query.limit(50)] });
  return currentOperation().commit(async (db, tx) => {
    let accepted = 0;
    for (const candidate of endpoints.rows) {
      const endpoint = await db.getRow(params("inbound_endpoints", candidate.$id, tx));
      if (endpoint.status === "disabled" || !addresses.includes(endpoint.address)) continue;
      const id = stableId(endpoint.workspaceId, "resend", email.email_id);
      if (await optionalRow("webhook_events", id, db, tx)) continue;
      const day = new Date().toISOString().slice(0, 10), limitId = stableId(endpoint.workspaceId, day);
      const quota = await optionalRow("ingress_limits", limitId, db, tx);
      const configuredLimit = Number(process.env.INBOUND_DAILY_LIMIT || 200);
      const limit = Number.isSafeInteger(configuredLimit) && configuredLimit > 0 ? Math.min(configuredLimit, 10000) : 200;
      const throttled = Number(quota?.count || 0) >= limit;
      if (!throttled) await db.upsertRow({ ...params("ingress_limits", limitId, tx), permissions: [], data: {
        workspaceId: endpoint.workspaceId, count: Number(quota?.count || 0) + 1, expiresAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      } });
      if (throttled) {
        await db.updateRow({ ...params("inbound_endpoints", endpoint.$id, tx), data: { errorCode: "DAILY_LIMIT_REACHED" } });
        continue;
      }
      await db.createRow({ ...params("webhook_events", id, tx), permissions: [], data: {
        workspaceId: endpoint.workspaceId, provider: "resend", eventId: email.email_id,
        eventType: "email.received", status: "received",
        payloadJson: JSON.stringify({ emailId: email.email_id, address: endpoint.address, endpointId: endpoint.$id, version: endpoint.version }),
      } });
      await enqueue({ workspaceId: endpoint.workspaceId, integrationId: endpoint.$id, connectionVersion: endpoint.version,
        requestedBy: endpoint.createdBy, kind: "resend-ingest", key: id, payload: { receiptId: id } }, db, tx);
      accepted++;
    }
    return { status: "accepted", accepted };
  });
}
function plainText(text: string | null, html: string | null) {
  return (text || (html || "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, 5000);
}
async function boundedDownload(url: string, expected: number) {
  const parsed = new URL(url), allowed = (process.env.RESEND_ATTACHMENT_HOSTS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (url.length > 8192 || isIP(parsed.hostname) || parsed.hostname === "localhost" || parsed.protocol !== "https:" || parsed.port || parsed.username || parsed.password || !allowed.includes(parsed.hostname))
    throw new InputError("Attachment download host is not allowed.");
  const response = await fetch(parsed, { redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!response.ok || !response.body) throw new Error("Attachment unavailable");
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0;
  try { while (true) { const { value, done } = await reader.read(); if (done) break;
    length += value.length; if (length > maximumDocumentSize || length > expected) { await reader.cancel(); throw new InputError("Attachment exceeds its declared size."); } chunks.push(value);
  } } finally { reader.releaseLock(); }
  if (length !== expected) throw new InputError("Attachment size changed.");
  return Buffer.concat(chunks);
}
export async function ingestResend(job: Job, commit: GuardedCommit) {
  const { receiptId } = JSON.parse(job.payloadJson), receipt = await optionalRow("webhook_events", receiptId);
  if (!receipt || receipt.workspaceId !== job.workspaceId) throw new InputError("Receipt unavailable.", 404);
  if (receipt.status === "processed") return;
  const payload = JSON.parse(receipt.payloadJson), client = resendClient();
  const response = await client.emails.receiving.get(payload.emailId, { html_format: "cid" }, { signal: AbortSignal.timeout(15000) });
  if (response.error || !response.data) throw new ResendReceivingError(response.error?.statusCode || 502);
  const mail = response.data, text = plainText(mail.text, mail.html), messageId = stableId(job.workspaceId, "resend", mail.id);
  const likelyVerification = /forwarding.*(?:confirmation|verification)|(?:confirmation|verification).*forwarding|verify.*forwarding|confirm.*forwarding/i.test(mail.subject) ||
    (/forwarding-noreply@google\.com/i.test(mail.from) && /forward/i.test(text));
  if (likelyVerification) {
    // A likely verification is quarantined even when authenticity is uncertain.
    const rawLink = (text + " " + (mail.html || "").slice(0, 30000)).match(/https:\/\/(?:mail|mail-settings)\.google\.com\/mail\/vf-[^\s<>"']+/i)?.[0]?.replace(/&amp;/g, "&") || "";
    const link = safeGoogleConfirmationLink(rawLink);
    const code = text.match(/(?:confirmation|verification)\s*(?:code)?\s*[:：]\s*(\d{6,12})/i)?.[1] || "";
    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    await commit(async (db, tx) => {
      await db.upsertRow({ ...params("forwarding_verifications", messageId, tx), permissions: [], data: {
        workspaceId: job.workspaceId, endpointId: job.integrationId, version: job.connectionVersion, expiresAt,
        confirmationJson: JSON.stringify({ code, link, expiresAt, authenticity: "Untrusted email; verify your provider’s forwarding request before using this confirmation." }),
      } });
      const endpoint = await db.getRow(params("inbound_endpoints", job.integrationId, tx));
      await db.updateRow({ ...params("inbound_endpoints", job.integrationId, tx), data: { status: endpoint.status === "receiving" ? "receiving" : "awaiting_test", errorCode: "", lastReceivedAt: new Date().toISOString() } });
      await db.updateRow({ ...params("webhook_events", receiptId, tx), data: { status: "processed" } });
      await audit(db, tx, job.workspaceId, job.requestedBy, "inbox.verification_received", messageId, messageId);
    });
    return;
  }
  if (mail.attachments.length > 10) throw new InputError("Too many message attachments.", 413);
  let total = 0;
  for (const attachment of mail.attachments) {
    total += attachment.size;
    if (total > 15 * 1024 * 1024) throw new InputError("Message attachments exceed the total limit.", 413);
    const filename = (attachment.filename || "attachment").replace(/[\u0000-\u001f/\\]/g, "_").slice(0, 255);
    const documentId = stableId(messageId, attachment.id), prior = await optionalRow("documents", documentId);
    if (prior?.status === "stored") continue;
    let status = "stored", fileId = "";
    try { validateDocument(filename, attachment.content_type, attachment.size); } catch { status = "unsupported"; }
    if (status === "stored") {
      const detail = await client.emails.receiving.attachments.get({ emailId: mail.id, id: attachment.id }, { signal: AbortSignal.timeout(15000) });
      if (detail.error || !detail.data || detail.data.size !== attachment.size) throw new Error("Attachment metadata unavailable");
      const bytes = await boundedDownload(detail.data.download_url, attachment.size);
      const extension = filename.split(".").at(-1)?.toLowerCase();
      if ((extension === "pdf" && bytes.subarray(0, 5).toString() !== "%PDF-") ||
        (["docx", "xlsx"].includes(extension || "") && !bytes.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])))) status = "rejected";
      if (extension === "txt") { try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { status = "rejected"; } }
      if (status === "stored") {
        fileId = documentId;
        // Register the file before upload so interrupted imports remain deletable.
        await commit(async (db, tx) => { await db.upsertRow({ ...params("documents", documentId, tx), permissions: [], data: {
          workspaceId: job.workspaceId, connectionVersion: job.connectionVersion, messageId: mail.id, attachmentId: attachment.id,
          filename, mimeType: attachment.content_type.slice(0, 128), size: attachment.size, fileId, status: "importing",
        } }); });
        const storage = new Storage(dataClient()), existing = await storage.getFile({ bucketId: documentBucketId, fileId }).catch((e) => { if (e?.code === 404) return null; throw e; });
        if (!existing) await storage.createFile({ bucketId: documentBucketId, fileId, file: InputFile.fromBuffer(bytes, filename), permissions: [] });
        else if (existing.sizeOriginal !== bytes.length || existing.$permissions.length) throw new Error("Private file validation failed");
      }
    }
    await commit(async (db, tx) => { await db.upsertRow({ ...params("documents", documentId, tx), permissions: [], data: {
      workspaceId: job.workspaceId, connectionVersion: job.connectionVersion, messageId: mail.id, attachmentId: attachment.id,
      filename, mimeType: attachment.content_type.slice(0, 128), size: attachment.size, fileId, status,
    } }); });
  }
  await commit(async (db, tx) => {
    const endpoint = await db.getRow(params("inbound_endpoints", job.integrationId, tx));
    const isTest = !!endpoint.testToken && text.includes(endpoint.testToken) && Date.parse(mail.created_at) >= Date.parse(endpoint.testStartedAt);
    await db.upsertRow({ ...params("mail_messages", messageId, tx), permissions: [], data: {
      workspaceId: job.workspaceId, connectionVersion: job.connectionVersion, providerId: mail.id, threadId: stableId(mail.headers?.["references"] || mail.message_id || mail.id),
      sender: mail.from.slice(0, 512), subject: mail.subject.slice(0, 998), receivedAt: new Date(mail.created_at).toISOString(), unread: true, financial: false,
      contentJson: JSON.stringify({ text, snippet: text.slice(0, 200), to: payload.address, source: "resend", bodyTruncated: (mail.text || mail.html || "").length > 5000, messageId: (mail.message_id || "").slice(0, 255),
        inReplyTo: (mail.headers?.["in-reply-to"] || "").slice(0, 512), forwardedFor: (mail.received_for || []).slice(0, 3).map((v) => v.slice(0, 254)), provenance: "Provider envelope; embedded original sender claims are untrusted." }),
    } });
    await db.updateRow({ ...params("inbound_endpoints", job.integrationId, tx), data: {
      lastReceivedAt: new Date().toISOString(), errorCode: "", ...(isTest ? { status: "receiving", testToken: "" } : {}),
    } });
    await db.updateRow({ ...params("webhook_events", receiptId, tx), data: { status: "processed" } });
    if (!isTest) await enqueue({ ...job, kind: "financial-analyze", key: messageId, payload: { messageId } }, db, tx);
    await audit(db, tx, job.workspaceId, job.requestedBy, isTest ? "inbox.test_received" : "message.received", messageId, messageId);
    if (isTest) await notify(db, tx, job.workspaceId, messageId, "Workspace email is receiving", "Your delivery challenge arrived. AssentPay cannot inspect your email provider’s forwarding settings.");
  });
}
