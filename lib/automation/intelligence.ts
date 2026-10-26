import { pdfText } from "./pdf-text";
import { officeText } from "./office-text";
import { FINANCIAL_INSTRUCTIONS, senderFinancialHistory, triageReasons } from "./financial-triage";
import { createHash } from "node:crypto";
import { Query, Storage } from "node-appwrite";
import { z } from "zod";
import { dataClient, dataDatabase } from "../data/client";
import { InputError } from "../workspaces/validation";
import { audit, enqueue, notify, optionalRow, params, stableId, type Job } from "./store";
import { documentBucketId } from "./schema";
import type { GuardedCommit } from "./gmail-sync";
import { analysisConfiguration, requestAnalysis, type AnalysisContent } from "./ai-provider";
export { extractionSchema, type Extraction } from "./extraction";
import { extractionSchema } from "./extraction";
export const proposalHash = (proposal: string) => createHash("sha256").update(proposal).digest("hex");
export async function analyzeMessage(job: Job, commit: GuardedCommit) {
  const { messageId } = JSON.parse(job.payloadJson), mail = await optionalRow("mail_messages", messageId);
  if (!mail || mail.workspaceId !== job.workspaceId || mail.connectionVersion !== job.connectionVersion) throw new InputError("Message unavailable.", 404);
  if (await optionalRow("message_analyses", messageId)) return;
  const config = analysisConfiguration();
  const body = JSON.parse(mail.contentJson);
  const [documents, memory, recent, senderHistory] = await Promise.all([
    dataDatabase().listRows({ ...params("documents"), queries: [Query.equal("workspaceId", job.workspaceId), Query.equal("messageId", mail.providerId), Query.limit(11)] }),
    dataDatabase().listRows({ ...params("agent_memory"), queries: [Query.equal("workspaceId", job.workspaceId), Query.equal("status", "active"), Query.greaterThan("expiresAt", new Date().toISOString()), Query.orderDesc("$updatedAt"), Query.limit(20)] }),
    dataDatabase().listRows({ ...params("financial_workflows"), queries: [Query.equal("workspaceId", job.workspaceId), Query.orderDesc("$createdAt"), Query.limit(20)] }),
    senderFinancialHistory(job.workspaceId, mail),
  ]);
  const sources: Record<string, string> = { [messageId]: `Subject: ${mail.subject}\n${body.text}` }, warnings: string[] = [];
  if (body.bodyTruncated) warnings.push("Email text was truncated; review the complete original message before any financial action.");
  const content: AnalysisContent[] = [];
  let attachmentBytes = 0;
  let processedDocuments = 0;
  for (const doc of documents.rows) {
    if (processedDocuments >= 3) { warnings.push("Only three documents can be analyzed in one message; review the remaining attachments manually."); break; }
    if (doc.status !== "stored") { warnings.push(`Attachment ${doc.$id} is ${doc.status}; it has not been analyzed.`); continue; }
    if (doc.connectionVersion !== job.connectionVersion) continue;
    attachmentBytes += doc.size;
    if (attachmentBytes > 10 * 1024 * 1024) { warnings.push("Document analysis byte limit reached."); break; }
    if (!["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(doc.mimeType)) { warnings.push(`Document ${doc.$id} requires manual review.`); continue; }
    processedDocuments++;
    const bytes = new Uint8Array(await new Storage(dataClient()).getFileDownload({ bucketId: documentBucketId, fileId: doc.fileId }));
    if (doc.mimeType === "text/plain") {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      sources[doc.$id] = text.slice(0, 20000);
      if (text.length > 20000) warnings.push(`Text document ${doc.$id} was truncated; review the complete attachment.`);
    }
    else if (doc.mimeType !== "application/pdf") {
      try {
        const result = await officeText(bytes, doc.mimeType.includes("wordprocessingml") ? "docx" : "xlsx");
        if (result.text.trim()) sources[doc.$id] = result.text;
        warnings.push(...result.warnings.map(warning => `Document ${doc.$id}: ${warning}`));
      } catch { warnings.push(`Office document ${doc.$id} could not be extracted; manual review required.`); }
    } else {
      // Load the native parser only in the document worker; cap pages and text.
      try {
        const result = await pdfText(bytes); sources[doc.$id] = result.text; if (result.total > 20 || result.truncated) warnings.push(`Document ${doc.$id} exceeds PDF page/text extraction limits.`);
      } catch { warnings.push(`Native PDF extraction failed for ${doc.$id}; document vision required.`); }
      if (!sources[doc.$id] || sources[doc.$id].trim().length < 80) {
        // Vision fallback is opt-in because it sends document bytes to the model.
        if (config.documentVision && doc.size <= 2 * 1024 * 1024) {
          content.push({ type: "input_file", filename: `${doc.$id}.pdf`, file_data: `data:application/pdf;base64,${Buffer.from(bytes).toString("base64")}` });
          sources[doc.$id] = "PDF supplied as document vision input; evidence requires human review.";
          warnings.push(`Document vision evidence from ${doc.$id} needs human confirmation.`);
        } else warnings.push(`Scanned PDF ${doc.$id} requires manual review or enabled document vision.`);
      }
    }
  }
  content.unshift({ type: "input_text", text: JSON.stringify({ sources, untrustedSenderFinancialHistory: senderHistory, attachments: documents.rows.map(doc => ({ sourceId: doc.$id, filename: doc.filename, status: doc.status, textExtracted: !!sources[doc.$id] })), untrustedWorkspaceContext: memory.rows.map((m) => ({ id: m.$id, sourceId: m.sourceId, facts: JSON.parse(m.factsJson) })), recentWorkflows: recent.rows.map((w) => ({ id: w.$id, counterparty: w.counterparty, amount: w.amount, currency: w.currency, status: w.status })), warnings }) });
  const output = await requestAnalysis(
    FINANCIAL_INSTRUCTIONS,
    content, z.toJSONSchema(extractionSchema), config,
  );
  const parsed = extractionSchema.safeParse(output);
  if (!parsed.success) throw new InputError("Financial analysis did not match the required schema.", 502, "AI_INVALID_OUTPUT");
  const extracted = parsed.data;
  const evidenceValid = extracted.evidence.length > 0 && extracted.evidence.every((e) => sources[e.sourceId]?.includes(e.quote) && e.quote.trim().length > 0);
  const reasons = triageReasons(extracted, senderHistory, documents.rows.map(doc => ({ filename: String(doc.filename), status: String(doc.status), textExtracted: !!sources[doc.$id] })), `${mail.subject}\n${body.text || ""}`);
  const financial = reasons.length > 0;
  const currentFinancialEvidence = !["business", "irrelevant", "uncertain"].includes(extracted.category);
  const fingerprint = stableId(job.workspaceId, extracted.counterparty?.toLowerCase() || "", extracted.reference?.toLowerCase() || stableId(String(mail.subject).toLowerCase(), String(body.text).replace(/\s+/g, " ").trim()), extracted.amount || "", extracted.currency || "");
  const duplicate = await dataDatabase().listRows({ ...params("financial_workflows"), queries: [Query.equal("workspaceId", job.workspaceId), Query.equal("fingerprint", fingerprint), Query.limit(1)] });
  let ready = currentFinancialEvidence && extracted.direction === "receivable" && !!extracted.counterparty && !!extracted.amount && Number(extracted.amount) > 0 && !!extracted.currency && extracted.confidence >= 0.85 && extracted.uncertainties.length === 0 && warnings.length === 0 && evidenceValid && !duplicate.rows.length;
  let action = ready ? "create_draft_invoice" : "review";
  let proposal = JSON.stringify({ extraction: extracted, warnings, evidenceValid, triage: { reasons, senderHistory }, sourceMessageId: messageId, duplicateOf: duplicate.rows[0]?.$id || null, intendedAction: action,
    consequence: ready ? "Create a PayPal sandbox draft invoice for the customer email selected by the owner. No invoice is sent and no money moves." : "Review evidence and resolve uncertainty. No provider execution is authorized." });
  await commit(async (db, tx) => {
    // The guarded transaction makes all outputs and the next job durable together.
    if (await optionalRow("message_analyses", messageId, db, tx)) return;
    const currentDuplicates = await db.listRows({ ...params("financial_workflows"), transactionId: tx, queries: [Query.equal("workspaceId", job.workspaceId), Query.equal("fingerprint", fingerprint), Query.limit(1)] });
    const isDuplicate = currentDuplicates.rows.length > 0;
    if (isDuplicate) { ready = false; action = "review"; const revised = JSON.parse(proposal); revised.duplicateOf = currentDuplicates.rows[0].$id; revised.intendedAction = "review"; revised.consequence = "Possible duplicate financial request; review the existing workflow. No provider execution is authorized."; proposal = JSON.stringify(revised); }
    await db.createRow({ ...params("message_analyses", messageId, tx), permissions: [], data: { workspaceId: job.workspaceId, messageId, category: extracted.category, status: ready ? "extracted" : "review", resultJson: proposal } });
    await db.updateRow({ ...params("mail_messages", messageId, tx), data: { financial } });
    if (financial) {
      await db.createRow({ ...params("financial_workflows", messageId, tx), permissions: [], data: { workspaceId: job.workspaceId, messageId, status: isDuplicate ? "duplicate_review" : ready ? "pending_approval" : "needs_review", action,
        counterparty: extracted.counterparty || "Unknown", amount: extracted.amount || "", currency: extracted.currency || "", providerId: "", fingerprint, proposalJson: proposal } });
      await enqueue({ ...job, kind: "financial-slack-notify", key: messageId, payload: { workflowId: messageId } }, db, tx);
      await notify(db, tx, job.workspaceId, messageId, ready ? "Financial action awaiting approval" : "Financial message needs review", "Review source evidence and the proposed action in your dashboard.", "approval");
    }
    await db.upsertRow({ ...params("agent_memory", messageId, tx), permissions: [], data: { workspaceId: job.workspaceId, sourceId: messageId, status: "active", expiresAt: new Date(Date.now() + 90 * 86400000).toISOString(), factsJson: JSON.stringify({ category: extracted.category, senderEmail: senderHistory.senderEmail, counterparty: extracted.counterparty, reference: extracted.reference, amount: extracted.amount, currency: extracted.currency, confidence: extracted.confidence, authority: "unconfirmed_extraction" }) } });
    await audit(db, tx, job.workspaceId, job.requestedBy, "message.analyzed", messageId, messageId, { category: extracted.category, evidenceValid, action });
  });
}
