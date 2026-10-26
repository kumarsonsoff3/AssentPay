import { randomBytes } from "node:crypto";
import { Query, Users } from "node-appwrite";
import { dataClient, dataDatabase, databaseId } from "../data/client";
import { currentOperation } from "../data/coordinator";
import { RuntimeStore } from "../data/runtime";
import { workerAuthorization } from "../integrations/health";
import { openCredentials } from "../integrations/credentials";
import { InputError } from "../workspaces/validation";
import { connectionId } from "../integrations/records";
import { audit, enqueue, notify, optionalRow, params, stableId, type Job } from "./store";
import { proposalHash } from "./intelligence";
import { paypalBase, paypalToken } from "./paypal-client";
import { resendClient } from "./resend";
import type { GuardedCommit } from "./gmail-sync";

export async function decideWorkflow(workspaceId: string, workflowId: string, actorId: string, input: Record<string, unknown>) {
  return currentOperation().commit(async (db, tx) => {
    const workflow = await db.getRow(params("financial_workflows", workflowId, tx));
    if (workflow.workspaceId !== workspaceId) throw new InputError("Workflow not found.", 404);
    if (input.proposalHash !== proposalHash(workflow.proposalJson)) throw new InputError("Proposal changed. Reload before deciding.", 409);
    if (!["approve", "reject"].includes(String(input.action))) throw new InputError("Invalid decision.");
    if (!["pending_approval", "needs_review", "duplicate_review"].includes(workflow.status)) throw new InputError("This workflow has already been decided.", 409);
    const approved = input.action === "approve";
    if (approved && (workflow.status !== "pending_approval" || workflow.action !== "create_draft_invoice")) throw new InputError("This message requires review and cannot execute a financial action.", 409);
    const decisionId = stableId(workspaceId, workflowId), recipient = String(input.recipientEmail || "").trim();
    if (approved && (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient) || recipient.length > 254)) throw new InputError("Select the customer email address for this exact draft invoice.");
    if (await optionalRow("approval_decisions", decisionId, db, tx)) throw new InputError("This workflow already has a decision.", 409);
    await db.createRow({ ...params("approval_decisions", decisionId, tx), permissions: [], data: { workspaceId, workflowId, actorId, decision: approved ? "approved" : "rejected", proposalHash: input.proposalHash, decidedAt: new Date().toISOString() } });
    if (approved) {
      const integrationId = connectionId(workspaceId, "paypal"), connection = await db.getRow(params("integrations", integrationId, tx));
      if (connection.workspaceId !== workspaceId || connection.provider !== "paypal" || connection.disconnectedAt || connection.environment !== "sandbox" || connection.status !== "connected") throw new InputError("Connect a healthy PayPal sandbox account before approving.", 409);
      const value = String(workflow.amount), currency = String(workflow.currency);
      const exponent = ["JPY", "HUF", "TWD"].includes(currency) ? 0 : 2;
      if (!/^[A-Z]{3}$/.test(currency) || !/^\d{1,12}(?:\.\d{1,2})?$/.test(value) || Number(value) <= 0 || (value.split(".")[1]?.length || 0) > exponent) throw new InputError("The extracted amount needs manual currency precision review.", 409);
      const extraction = JSON.parse(workflow.proposalJson).extraction;
      const request = { detail: { currency_code: currency, reference: `assentpay-${workflowId}` },
        primary_recipients: [{ billing_info: { email_address: recipient } }],
        items: [{ name: String(extraction.purpose || "Approved service").slice(0, 200), quantity: "1", unit_amount: { currency_code: currency, value } }] };
      await db.createRow({ ...params("financial_actions", decisionId, tx), permissions: [], data: { workspaceId, workflowId, connectionVersion: connection.connectionVersion, requestId: decisionId,
        status: "authorized", providerId: "", attemptedAt: new Date(0).toISOString(), requestJson: JSON.stringify({ request, recipient, proposalHash: input.proposalHash, approvedBy: actorId }) } });
      await enqueue({ workspaceId, integrationId, connectionVersion: connection.connectionVersion, requestedBy: actorId, kind: "paypal-execute", key: workflowId, payload: { workflowId } }, db, tx);
    }
    await db.updateRow({ ...params("financial_workflows", workflowId, tx), data: { status: approved ? "approved" : "rejected" } });
    await audit(db, tx, workspaceId, actorId, approved ? "workflow.approved" : "workflow.rejected", workflowId, randomBytes(16).toString("hex"), { proposalHash: String(input.proposalHash), action: String(workflow.action) });
  });
}
async function providerToken(job: Job, provider: "paypal" | "slack") {
  const authorize = workerAuthorization(dataClient(), job.requestedBy);
  const store = new RuntimeStore(dataDatabase(), databaseId(), job.requestedBy, authorize);
  const found = await store.execution(job.workspaceId, provider);
  if (!found) throw new InputError("Provider connection unavailable.", 403);
  if (provider === "paypal" && (found.record.version !== job.connectionVersion || found.record.environment !== "sandbox")) throw new InputError("PayPal connection changed.", 403);
  const credentials = openCredentials(job.workspaceId, provider, found.record.credentials);
  return { found, credentials, token: provider === "paypal" ? await paypalToken(credentials.clientId!, credentials.clientSecret!) : credentials.accessToken! };
}
async function getInvoice(token: string, id: string) {
  if (!/^INV2-[A-Z0-9-]{8,100}$/.test(id)) throw new InputError("Invalid PayPal invoice reference.");
  const response = await fetch(`${paypalBase}/v2/invoicing/invoices/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000), redirect: "error" });
  if (!response.ok) throw new Error("PayPal invoice retrieval unavailable");
  return await response.json() as { id: string; status: string; detail?: { reference?: string } };
}
export async function executeFinancialAction(job: Job, commit: GuardedCommit) {
  const { workflowId } = JSON.parse(job.payloadJson), actionId = stableId(job.workspaceId, workflowId);
  const { token } = await providerToken(job, "paypal");
  const claim = await commit(async (db, tx) => {
    const action = await db.getRow(params("financial_actions", actionId, tx)), workflow = await db.getRow(params("financial_workflows", workflowId, tx)), decision = await db.getRow(params("approval_decisions", actionId, tx));
    if (action.workspaceId !== job.workspaceId || workflow.workspaceId !== job.workspaceId || decision.workspaceId !== job.workspaceId || action.connectionVersion !== job.connectionVersion || decision.actorId !== job.requestedBy || decision.decision !== "approved" || decision.proposalHash !== proposalHash(workflow.proposalJson)) throw new InputError("Execution authorization changed.", 403);
    if (action.status === "completed") return null;
    if (action.status !== "authorized") {
      await db.updateRow({ ...params("financial_workflows", workflowId, tx), data: { status: "reconciliation_required" } });
      await notify(db, tx, job.workspaceId, `${workflowId}:unknown`, "PayPal action needs reconciliation", "A previous attempt may have reached PayPal. Review the provider account before another action.");
      return null;
    }
    if (workflow.status !== "approved") throw new InputError("Workflow is not approved.", 403);
    await db.updateRow({ ...params("financial_actions", actionId, tx), data: { status: "in_flight", attemptedAt: new Date().toISOString() } });
    await db.updateRow({ ...params("financial_workflows", workflowId, tx), data: { status: "executing" } });
    await audit(db, tx, job.workspaceId, job.requestedBy, "paypal.action_claimed", workflowId, actionId);
    return action;
  });
  if (!claim) return;
  const { request } = JSON.parse(claim.requestJson);
  let providerId = "";
  try {
    const response = await fetch(`${paypalBase}/v2/invoicing/invoices`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation", "PayPal-Request-Id": claim.requestId },
      body: JSON.stringify(request), signal: AbortSignal.timeout(20000), redirect: "error" });
    if (!response.ok) throw new Error("PayPal write outcome requires review");
    const result = await response.json() as { id?: string; href?: string; links?: { rel: string; href: string }[] };
    providerId = result.id || "";
    if (!providerId) {
      const href = result.links?.find((l) => l.rel === "self")?.href || result.href;
      if (href) { const u = new URL(href); if (u.origin === paypalBase && u.pathname.startsWith("/v2/invoicing/invoices/")) providerId = u.pathname.split("/").at(-1) || ""; }
    }
    const invoice = await getInvoice(token, providerId);
    if (invoice.detail?.reference !== `assentpay-${workflowId}`) throw new Error("Invoice correlation mismatch");
    await commit(async (db, tx) => {
      await db.updateRow({ ...params("financial_actions", actionId, tx), data: { status: "completed", providerId } });
      await db.updateRow({ ...params("financial_workflows", workflowId, tx), data: { status: "draft_created", providerId } });
      await notify(db, tx, job.workspaceId, `${workflowId}:draft`, "PayPal draft created", "The approved sandbox invoice is a draft. It has not been sent and no payment has been made.", "financial");
      await audit(db, tx, job.workspaceId, job.requestedBy, "paypal.draft_created", workflowId, actionId);
    });
  } catch {
    await commit(async (db, tx) => {
      await db.updateRow({ ...params("financial_actions", actionId, tx), data: { status: "unknown", providerId } });
      await db.updateRow({ ...params("financial_workflows", workflowId, tx), data: { status: "reconciliation_required", providerId } });
      await notify(db, tx, job.workspaceId, `${workflowId}:unknown`, "PayPal action needs reconciliation", "The result could not be confirmed. Automatic replay is blocked to prevent duplicate invoices.");
      await audit(db, tx, job.workspaceId, job.requestedBy, "paypal.outcome_unknown", workflowId, actionId);
    });
  }
}
export async function reconcilePaypal(job: Job, commit: GuardedCommit) {
  const { receiptId } = JSON.parse(job.payloadJson), receipt = await optionalRow("webhook_events", receiptId);
  if (!receipt || receipt.workspaceId !== job.workspaceId) throw new InputError("Event unavailable.", 404);
  if (receipt.status === "processed") return;
  const payload = JSON.parse(receipt.payloadJson), providerId = payload.resourceId;
  if (typeof providerId !== "string" || !providerId.startsWith("INV2-")) return;
  const { token } = await providerToken(job, "paypal"), invoice = await getInvoice(token, providerId);
  const page = await dataDatabase().listRows({ ...params("financial_workflows"), queries: [Query.equal("workspaceId", job.workspaceId), Query.equal("providerId", providerId), Query.limit(2)] });
  if (page.rows.length !== 1) return;
  const workflow = page.rows[0];
  const states: Record<string, string> = { DRAFT: "draft_created", SENT: "invoice_sent", PAID: "paid", MARKED_AS_PAID: "externally_marked_paid", PARTIALLY_PAID: "partially_paid", CANCELLED: "cancelled", REFUNDED: "refunded", PARTIALLY_REFUNDED: "partially_refunded", UNPAID: "unpaid", PAYMENT_PENDING: "payment_pending", SCHEDULED: "scheduled" };
  const status = states[invoice.status];
  if (!status || invoice.detail?.reference !== `assentpay-${workflow.$id}`) throw new InputError("Unrecognized invoice state or correlation.");
  await commit(async (db, tx) => {
    const latest = await db.getRow(params("webhook_events", receiptId, tx));
    if (latest.status === "processed") return;
    await db.updateRow({ ...params("financial_workflows", workflow.$id, tx), data: { status } });
    await db.updateRow({ ...params("webhook_events", receiptId, tx), data: { status: "processed" } });
    await audit(db, tx, job.workspaceId, job.requestedBy, "paypal.reconciled", workflow.$id, receiptId, { status });
    if (workflow.status !== status) await notify(db, tx, job.workspaceId, receiptId, "PayPal invoice updated", `Verified provider status: ${invoice.status}. PayPal remains the source of payment receipts.`, "financial");
  });
}
async function notificationClaim(job: Job, commit: GuardedCommit, id: string, workflowId: string, channel: string, connectionVersion?: string) {
  return commit(async (db, tx) => {
    if (channel === "slack") {
      const connection = await db.getRow(params("integrations", connectionId(job.workspaceId, "slack"), tx));
      if (connection.workspaceId !== job.workspaceId || connection.connectionVersion !== connectionVersion || connection.disconnectedAt) throw new InputError("Slack connection changed.", 403);
    }
    const previous = await optionalRow("notification_deliveries", id, db, tx);
    if (previous && !["retry", "failed"].includes(previous.status)) return false; // Ambiguous sends are never replayed.
    if (previous) {
      await db.updateRow({ ...params("notification_deliveries", id, tx), data: { status: "sending", attemptedAt: new Date().toISOString() } });
      return true;
    }
    await db.createRow({ ...params("notification_deliveries", id, tx), permissions: [], data: { workspaceId: job.workspaceId, workflowId, channel, status: "sending", providerId: "", attemptedAt: new Date().toISOString() } });
    return true;
  });
}
export async function deliverWorkflowNotification(job: Job, commit: GuardedCommit) {
  const { workflowId } = JSON.parse(job.payloadJson), workflow = await optionalRow("financial_workflows", workflowId);
  if (!workflow || workflow.workspaceId !== job.workspaceId) throw new InputError("Workflow unavailable.", 404);
  const url = new URL("/dashboard/approvals", process.env.APP_URL);
  const message = `AssentPay: ${workflow.status === "pending_approval" ? "approval requested" : "financial review required"}. ${workflow.currency} ${workflow.amount || "Amount uncertain"}. Action: ${workflow.action}. Review counterparty, source evidence and uncertainty in the authenticated dashboard: ${url.toString()}`;
  const metadata = await optionalRow("integrations", connectionId(job.workspaceId, "slack"));
  if (metadata && !metadata.disconnectedAt && metadata.status === "connected" && metadata.channelId) {
    const sentId = stableId(workflowId, metadata.connectionVersion, "slack-notified");
    const { token, found } = await providerToken(job, "slack");
    if (found.record.version !== metadata.connectionVersion) throw new InputError("Slack connection changed.", 403);
    if (await notificationClaim(job, commit, sentId, workflowId, "slack", metadata.connectionVersion)) {
      let failureStatus = "unknown";
      try {
        const response = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ channel: metadata.channelId, text: message, mrkdwn: false, unfurl_links: false, unfurl_media: false }), signal: AbortSignal.timeout(15000), redirect: "error" });
        const result = await response.json() as { ok: boolean; ts?: string; error?: string };
        if (!response.ok || !result.ok) {
          failureStatus = response.status === 429 || result.error === "ratelimited" ? "retry" : response.status < 500 ? "failed" : "unknown";
          throw new Error("Slack notification unavailable");
        }
        await commit(async (db, tx) => {
          await db.updateRow({ ...params("notification_deliveries", sentId, tx), data: { status: "delivered", providerId: result.ts || "" } });
          await audit(db, tx, job.workspaceId, job.requestedBy, "workflow.slack_notified", workflowId, sentId);
        });
      } catch {
        await commit(async (db, tx) => { await db.updateRow({ ...params("notification_deliveries", sentId, tx), data: { status: failureStatus } }); await notify(db, tx, job.workspaceId, sentId, "Slack delivery needs review", failureStatus === "retry" ? "Slack rate limited delivery; a background retry is queued." : "The proposal is available in your dashboard. Review delivery configuration before retrying; uncertain sends are never replayed."); });
        if (failureStatus === "retry") throw new Error("Notification rate limited");
        if (failureStatus === "failed") throw new InputError("Slack rejected notification delivery.", 400);
      }
    }
  }
  const profile = await optionalRow("workspaces", job.workspaceId), preferences = profile ? JSON.parse(profile.settingsJson) : {};
  if (preferences.emailNotifications && process.env.RESEND_FROM_EMAIL) {
    const sentId = stableId(workflowId, "email-notified"), user = await new Users(dataClient()).get({ userId: job.requestedBy });
    if (await notificationClaim(job, commit, sentId, workflowId, "email")) {
      let failureStatus = "unknown";
      try {
        const sent = await resendClient().emails.send({ from: process.env.RESEND_FROM_EMAIL, to: user.email, subject: "AssentPay financial workflow needs review", text: message }, { idempotencyKey: sentId });
        if (sent.error || !sent.data) {
          failureStatus = sent.error?.statusCode === 429 ? "retry" : [400, 401, 403, 422].includes(sent.error?.statusCode || 0) ? "failed" : "unknown";
          throw new Error("Workflow email delivery unavailable");
        }
        await commit(async (db, tx) => { await db.updateRow({ ...params("notification_deliveries", sentId, tx), data: { status: "sent", providerId: sent.data.id } }); await audit(db, tx, job.workspaceId, job.requestedBy, "workflow.email_notified", workflowId, sentId); });
      } catch {
        await commit(async (db, tx) => { await db.updateRow({ ...params("notification_deliveries", sentId, tx), data: { status: failureStatus } }); await notify(db, tx, job.workspaceId, sentId, "Email delivery needs review", "Review the operational sender configuration. Rate limits retry automatically; uncertain sends are held. The proposal remains available in the dashboard."); });
        if (failureStatus === "retry") throw new Error("Notification rate limited");
        if (failureStatus === "failed") throw new InputError("Resend rejected notification delivery.", 400);
      }
    }
  }
}
