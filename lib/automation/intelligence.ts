import { payoutsEnabled, supportsSupplierPayout } from "./paypal-payout";
import { aiMemoryContext, rememberExtractedMemory, memoryContextAllowed } from "./memory";
import { sameFinancialValue, supportedBillingIntent, financialClaimId, billingEvidenceWarnings, quotesObligationReference } from "./financial-safety";
import { pdfText } from "./pdf-text";
import { officeText } from "./office-text";
import { FINANCIAL_INSTRUCTIONS, senderFinancialHistory, triageReasons } from "./financial-triage";
import { createHash } from "node:crypto";
import { Query, Storage, type Models } from "node-appwrite";
import { z } from "zod";
import { dataClient, dataDatabase } from "../data/client";
import { InputError } from "../workspaces/validation";
import { audit, enqueue, notify, optionalRow, params, stableId, type Job } from "./store";
import { documentBucketId } from "./schema";
import type { GuardedCommit } from "./gmail-sync";
import { analysisConfiguration, requestAnalysis, type AnalysisContent } from "./ai-provider";
export { extractionSchema, type Extraction } from "./extraction";
import { extractionSchema, isCurrencyCode } from "./extraction";
import { rupeeEvidence } from "./rupee-evidence";
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
  if (documents.rows.some(doc => doc.connectionVersion === job.connectionVersion && doc.status === "discovered" && /\.(pdf|txt|docx|xlsx)$/i.test(doc.filename) && doc.size > 0 && doc.size <= 5 * 1024 * 1024)) throw new InputError("Waiting for attachment import.", 503, "DOCUMENT_IMPORT_PENDING");
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
  const recentPermissions = await Promise.all(recent.rows.map(workflow => memoryContextAllowed(job.workspaceId, workflow.messageId)));
  const allowedRecent = recent.rows.filter((_, index) => recentPermissions[index]);
  content.unshift({ type: "input_text", text: JSON.stringify({ sources, untrustedSenderFinancialHistory: senderHistory, attachments: documents.rows.map(doc => ({ sourceId: doc.$id, filename: doc.filename, status: doc.status, textExtracted: !!sources[doc.$id] })), untrustedWorkspaceContext: memory.rows.map((m) => aiMemoryContext(m, job.workspaceId)).filter((m) => m !== null), recentWorkflows: allowedRecent.map((w) => ({ id: w.$id, counterparty: w.counterparty, amount: w.amount, currency: w.currency, status: w.status })), warnings }) });
  const output = await requestAnalysis(
    FINANCIAL_INSTRUCTIONS,
    content, z.toJSONSchema(extractionSchema), config,
  );
  const parsed = extractionSchema.safeParse(output);
  if (!parsed.success) throw new InputError("Financial analysis did not match the required schema.", 502, "AI_INVALID_OUTPUT");
  const extracted = { ...parsed.data, currency: isCurrencyCode(parsed.data.currency) ? parsed.data.currency : null };
  const evidenceValid = extracted.evidence.length > 0 && extracted.evidence.every((e) => sources[e.sourceId]?.includes(e.quote) && e.quote.trim().length > 0);
  const quotes = evidenceValid ? extracted.evidence.map(e => e.quote) : [];
  const sourceTexts = Object.values(sources);
  let rupee = rupeeEvidence(extracted.amount, quotes, sourceTexts, false);
  if (rupee === "ambiguous" && (!extracted.currency || extracted.currency === "INR")) {
    const workspace = await optionalRow("workspaces", job.workspaceId);
    rupee = rupeeEvidence(extracted.amount, quotes, sourceTexts, workspace?.country === "IN" && workspace.currency === "INR");
  }
  if (rupee === "explicit" || rupee === "workspace") extracted.currency = "INR";
  else if (rupee === "ambiguous" && extracted.currency === "INR") extracted.currency = null;
  const reasons = triageReasons(extracted, senderHistory, documents.rows.map(doc => ({ filename: String(doc.filename), status: String(doc.status), textExtracted: !!sources[doc.$id] })), `${mail.subject}\n${body.text || ""}`);
  const financial = reasons.length > 0;
  const billingRequest = supportedBillingIntent(extracted);
  const supplierPayout = payoutsEnabled() && supportsSupplierPayout(extracted);
  const counterparty = extracted.counterparty?.trim() || "";
  const reference = extracted.reference?.trim().toLowerCase() || "";
  const tracksObligation = billingRequest || supplierPayout || extracted.category === "agreement";
  const evidenceWarnings = tracksObligation ? billingEvidenceWarnings(extracted, sources) : [];
  warnings.push(...evidenceWarnings);
  if (tracksObligation && !counterparty) warnings.push("Identify the counterparty before approving a billing request.");
  const obligationEvidence = tracksObligation && !!counterparty && evidenceValid && evidenceWarnings.length === 0;
  const fingerprint = stableId(job.workspaceId, counterparty.toLowerCase(), reference || messageId, "obligation-v2");

  await commit(async (db, tx) => {
    if (await optionalRow("message_analyses", messageId, db, tx)) return;

    const claimId = financialClaimId(job.workspaceId, fingerprint);
    const claim = obligationEvidence ? await optionalRow("financial_claims", claimId, db, tx) : null;
    if (claim && claim.workspaceId !== job.workspaceId) throw new InputError("Obligation claim unavailable.", 409);
    let related: Models.DefaultRow[] = [];
    if (obligationEvidence) {
      // Keep historical rows in the duplicate check after upgrading a worker.
      const [page, exact] = await Promise.all([
        db.listRows({ ...params("financial_workflows"), transactionId: tx,
          queries: [Query.equal("workspaceId", job.workspaceId), Query.equal("counterparty", counterparty), Query.limit(100)] }),
        db.listRows({ ...params("financial_workflows"), transactionId: tx,
          queries: [Query.equal("workspaceId", job.workspaceId), Query.equal("fingerprint", fingerprint), Query.limit(2)] }),
      ]);
      if (page.rows.length >= 100) warnings.push("Obligation history exceeds the review limit. Verify this reference manually.");
      const history = new Map([...page.rows, ...exact.rows].map(row => [row.$id, row]));
      related = [...history.values()].filter(row => {
        if (row.workspaceId !== job.workspaceId) return false;
        try {
          const proposal = JSON.parse(row.proposalJson);
          return proposal.obligationEvidence !== false && proposal.extraction?.reference?.trim().toLowerCase() === reference;
        } catch {
          warnings.push("A historical proposal could not be checked. Verify this reference manually.");
          return false;
        }
      });
    }
    const primary = claim ? await optionalRow("financial_workflows", claim.workflowId, db, tx)
      : related.find(row => row.action === "create_draft_invoice" || !!row.providerId) || related[0];
    if (claim && primary?.workspaceId !== job.workspaceId) throw new InputError("Obligation workflow unavailable.", 409);
    const hasMatchingValue = (row: Models.DefaultRow) => sameFinancialValue(String(row.amount), String(row.currency), extracted.amount || "", extracted.currency || "");
    let primaryIsAgreement = false;
    if (primary) {
      try {
        const saved = JSON.parse(primary.proposalJson);
        const prior = extractionSchema.safeParse(saved.extraction);
        primaryIsAgreement = prior.success && prior.data.category === "agreement"
          && saved.evidenceValid === true && saved.obligationEvidence !== false
          && saved.warnings?.length === 0 && prior.data.uncertainties.length === 0
          && prior.data.evidence.some(e => quotesObligationReference(e.quote, reference));
      } catch {
        warnings.push("The matching proposal could not be checked. Verify this reference manually.");
      }
    }
    const qualifiesForApproval = (billingRequest || supplierPayout) && obligationEvidence && warnings.length === 0 && extracted.confidence >= 0.85 && extracted.uncertainties.length === 0;

    // An agreement can corroborate a later request. Transfer its claim only once
    // and only when there is no conflicting history or prior provider action.
    const agreement = qualifiesForApproval && primary?.status === "needs_review" && primary.action === "review"
      && !primary.providerId && primaryIsAgreement
      && hasMatchingValue(primary) && related.every(row => row.$id === primary.$id) ? primary : null;
    const duplicateOf = agreement ? null : primary?.$id || null;
    const ready = qualifiesForApproval && !duplicateOf;
    const action = ready ? supplierPayout ? "pay_supplier" : "create_draft_invoice" : "review";
    const isDuplicate = !!duplicateOf;

    if (primary && !hasMatchingValue(primary)) {
      const beforeDraft = ["pending_approval", "approved"].includes(primary.status);
      const canHoldSend = ["executing", "draft_created", "send_approved", "reconciliation_required"].includes(primary.status);
      const agreementConflict = primaryIsAgreement && primary.status === "needs_review";
      if (beforeDraft || canHoldSend || agreementConflict) {
        await db.updateRow({ ...params("financial_workflows", primary.$id, tx),
          data: { action: "review", ...(beforeDraft || agreementConflict ? { status: beforeDraft ? "needs_review" : "duplicate_review" } : {}) } });
      }
      warnings.push("Another source reports a different amount or currency for this obligation.");
      await notify(db, tx, job.workspaceId, primary.$id + ":conflict", "Conflicting obligation values",
        "Review both sources and any existing PayPal invoice before taking further action.", "approval");
    }

    if (financial && obligationEvidence && !isDuplicate) {
      if (claim) await db.updateRow({ ...params("financial_claims", claimId, tx), data: { workflowId: messageId } });
      else await db.createRow({ ...params("financial_claims", claimId, tx), permissions: [], data: { workspaceId: job.workspaceId, workflowId: messageId, fingerprint } });
    }
    const proposal = JSON.stringify({
      extraction: extracted, warnings, evidenceValid, obligationEvidence, rupeeEvidence: rupee, triage: { reasons, senderHistory },
      sourceMessageId: messageId, duplicateOf, agreementWorkflowId: agreement?.$id || null, intendedAction: action,
      consequence: ready ? supplierPayout ? "Send the exact approved sandbox payout to the supplier email selected by the owner." : "Create a PayPal sandbox draft invoice for the customer email selected by the owner. No invoice is sent and no money moves."
        : isDuplicate ? "Possible duplicate financial request. Review the existing workflow before taking any action."
        : "Review the source evidence. This proposal has no financial authorization.",
    });
    await db.createRow({ ...params("message_analyses", messageId, tx), permissions: [], data: { workspaceId: job.workspaceId, messageId, category: extracted.category, status: ready ? "extracted" : financial ? "review" : "ignored", resultJson: proposal } });
    await db.updateRow({ ...params("mail_messages", messageId, tx), data: { financial } });
    if (financial) {
      await db.createRow({ ...params("financial_workflows", messageId, tx), permissions: [], data: { workspaceId: job.workspaceId, messageId, status: isDuplicate ? "duplicate_review" : ready ? "pending_approval" : "needs_review", action,
        counterparty: counterparty || "Unknown", amount: extracted.amount || "", currency: extracted.currency || "", providerId: "", fingerprint, proposalJson: proposal } });
      if (!isDuplicate) await enqueue({ ...job, kind: "financial-slack-notify", key: messageId, payload: { workflowId: messageId } }, db, tx);
      if (!isDuplicate) await notify(db, tx, job.workspaceId, messageId, ready ? "Financial action awaiting approval" : "Financial message needs review", "Review source evidence and the proposed action in your dashboard.", "approval");
    }
    if (financial) await rememberExtractedMemory(db, tx, job.workspaceId, messageId, {
      ...(extracted.category === "agreement" ? { dueDate: extracted.dueDate, paymentTerms: extracted.paymentTerms } : {}),
      category: extracted.category, senderEmail: senderHistory.senderEmail, counterparty: extracted.counterparty, reference: extracted.reference, amount: extracted.amount, currency: extracted.currency, confidence: extracted.confidence, authority: "unconfirmed_extraction" });
    await audit(db, tx, job.workspaceId, job.requestedBy, "message.analyzed", messageId, messageId, { category: extracted.category, evidenceValid, action });
  });
}
