import { paypalApplicationIdentity } from "../integrations/paypal-identity";
import { randomBytes } from "node:crypto";
import { dataClient, dataDatabase, databaseId } from "../data/client";
import { currentOperation } from "../data/coordinator";
import { RuntimeStore } from "../data/runtime";
import { workerAuthorization } from "../integrations/health";
import { openCredentials } from "../integrations/credentials";
import { connectionId } from "../integrations/records";
import { InputError } from "../workspaces/validation";
import { audit, enqueue, params, stableId, type Job } from "./store";
import {
  assertInvoiceMatches,
  boundRequest,
  digest,
  reconciliationState,
} from "./financial-safety";
import { paypalBase, paypalToken } from "./paypal-client";
import { sendId, saveInvoicePaymentLink, type PayPalInvoice as Invoice } from "./paypal-invoice-link";
export { sendId } from "./paypal-invoice-link";
import { reserveInvoiceObligation } from "./invoice-obligation";
import type { GuardedCommit } from "./gmail-sync";

const uncertainState = (current: string) =>
  [
    "paid",
    "partially_paid",
    "externally_marked_paid",
    "refunded",
    "partially_refunded",
    "cancelled",
    "invoice_sent",
    "unpaid",
    "payment_pending",
    "scheduled",
  ].includes(current)
    ? current
    : "send_reconciliation_required";
const states: Record<string, string> = {
  DRAFT: "draft_created",
  SENT: "invoice_sent",
  SCHEDULED: "scheduled",
  UNPAID: "unpaid",
  PAYMENT_PENDING: "payment_pending",
  PARTIALLY_PAID: "partially_paid",
  PAID: "paid",
  MARKED_AS_PAID: "externally_marked_paid",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "partially_refunded",
};
async function authority(workspace: string, actor: string) {
  await workerAuthorization(dataClient(), actor)(workspace, ["owner"]);
  const found = await new RuntimeStore(
    dataDatabase(),
    databaseId(),
    actor,
    workerAuthorization(dataClient(), actor),
  ).execution(workspace, "paypal");
  if (!found || found.record.environment !== "sandbox")
    throw new InputError(
      "Only the connected sandbox merchant can execute invoices.",
      403,
    );
  const c = openCredentials(workspace, "paypal", found.record.credentials);
  if (
    !c.clientId ||
    found.record.externalId !== paypalApplicationIdentity(c.clientId)
  )
    throw new InputError(
      "Reconnect sandbox credentials to bind the application identity. Merchant identity remains unverified; live execution is disabled.",
      403,
    );
  return {
    token: await paypalToken(c.clientId!, c.clientSecret!),
    version: found.record.version,
    applicationIdentity: found.record.externalId,
  };
}
export async function readProviderInvoice(
  token: string,
  id: string,
): Promise<Invoice> {
  if (!/^INV2-[A-Z0-9-]{8,100}$/.test(id))
    throw new InputError("Invalid invoice ID.");
  const r = await fetch(
    paypalBase + "/v2/invoicing/invoices/" + encodeURIComponent(id),
    {
      headers: { Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    },
  );
  if (!r.ok) throw new InputError("Invoice verification unavailable.", 503);
  return r.json();
}
export async function requestSendReview(
  workspaceId: string,
  workflowId: string,
  actorId: string,
  recover = false,
) {
  return currentOperation().commit(async (db, tx) => {
    await workerAuthorization(dataClient(), actorId)(workspaceId, ["owner"]);
    const w = await db.getRow(params("financial_workflows", workflowId, tx)),
      m = await db.getRow(
        params("integrations", connectionId(workspaceId, "paypal"), tx),
      );
    if (
      w.workspaceId !== workspaceId ||
      m.workspaceId !== workspaceId ||
      m.environment !== "sandbox" ||
      m.status !== "connected" ||
      m.disconnectedAt
    )
      throw new InputError("Sandbox workflow unavailable.", 409);
    if (!recover && (w.status !== "draft_created" || w.action === "review"))
      throw new InputError(
        "Only an unsent draft can be reviewed for sending.",
        409,
      );
    if (recover) {
      const a = await db.getRow(
        params("paypal_send_approvals", sendId(workspaceId, workflowId), tx),
      );
      if (
        a.workspaceId !== workspaceId ||
        a.connectionVersion !== m.connectionVersion ||
        !["unknown", "in_flight"].includes(a.status)
      )
        throw new InputError("No uncertain send to reconcile.", 409);
      await audit(
        db,
        tx,
        workspaceId,
        actorId,
        "paypal.send_recovery_requested",
        workflowId,
        randomBytes(16).toString("hex"),
        {
          approvingActorId: String(a.actorId),
          recoveryActorId: actorId,
          snapshotHash: String(a.snapshotHash),
        },
      );
    }
    await enqueue(
      {
        workspaceId,
        integrationId: m.$id,
        connectionVersion: m.connectionVersion,
        requestedBy: actorId,
        kind: recover ? "paypal-send-recover" : "paypal-send-review",
        key: stableId(workflowId, recover ? "recover" : "review", actorId),
        payload: { workflowId },
        force: true,
      },
      db,
      tx,
    );
  });
}
async function verifiedContext(
  db: ReturnType<typeof dataDatabase>,
  tx: string,
  workspace: string,
  workflowId: string,
  version: string,
) {
  const id = stableId(workspace, workflowId),
    w = await db.getRow(params("financial_workflows", workflowId, tx)),
    a = await db.getRow(params("financial_actions", id, tx)),
    b = await db.getRow(params("approval_bindings", id, tx));
  const m = await db.getRow(
    params("integrations", connectionId(workspace, "paypal"), tx),
  );
  if (
    [w, a, b, m].some(r => r.workspaceId !== workspace) ||
    a.status !== "completed" ||
    a.workflowId !== workflowId ||
    a.providerId !== w.providerId ||
    a.connectionVersion !== version ||
    m.connectionVersion !== version ||
    m.environment !== "sandbox" ||
    m.status !== "connected" ||
    m.disconnectedAt
  )
    throw new InputError("Original merchant or invoice binding changed.", 403);
  return { w, request: boundRequest(a.requestJson, b.requestHash).request };
}
export async function prepareInvoiceSend(job: Job, commit: GuardedCommit) {
  const { workflowId } = JSON.parse(job.payloadJson),
    auth = await authority(job.workspaceId, job.requestedBy);
  if (auth.version !== job.connectionVersion)
    throw new InputError("Merchant changed.", 403);
  const w = await dataDatabase().getRow(
    params("financial_workflows", workflowId),
  );
  if (w.workspaceId !== job.workspaceId)
    throw new InputError("Workflow unavailable.", 404);
  const invoice = await readProviderInvoice(auth.token, w.providerId);
  return commit(async (db, tx) => {
    const { w: current, request } = await verifiedContext(
      db,
      tx,
      job.workspaceId,
      workflowId,
      auth.version,
    );
    assertInvoiceMatches(invoice, request, current.providerId);
    if (current.status !== "draft_created" || current.action === "review" || invoice.status !== "DRAFT")
      throw new InputError("Invoice is not an unsent draft.", 409);
    const snapshot = {
      operation: "send_invoice",
      workspaceId: job.workspaceId,
      workflowId,
      connectionVersion: auth.version,
      applicationIdentity: auth.applicationIdentity,
      merchantIdentityVerified: false,
      providerId: invoice.id,
      invoice,
      body: { send_to_recipient: true, send_to_invoicer: true },
    };
    await db.upsertRow({
      ...params("paypal_send_reviews", sendId(job.workspaceId, workflowId), tx),
      permissions: [],
      data: {
        workspaceId: job.workspaceId,
        workflowId,
        connectionVersion: auth.version,
        snapshotJson: JSON.stringify(snapshot),
        snapshotHash: digest(JSON.stringify(snapshot)),
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      },
    });
  });
}
export async function approveInvoiceSend(
  workspaceId: string,
  workflowId: string,
  actorId: string,
  snapshotHash: unknown,
  decisionGuard?: Parameters<GuardedCommit>[0],
) {
  return currentOperation().commit(async (db, tx) => {
    await workerAuthorization(dataClient(), actorId)(workspaceId, ["owner"]);
    if (decisionGuard) await decisionGuard(db, tx);
    const id = sendId(workspaceId, workflowId),
      review = await db.getRow(params("paypal_send_reviews", id, tx));
    const { w, request } = await verifiedContext(
      db,
      tx,
      workspaceId,
      workflowId,
      review.connectionVersion,
    );
    if (
      w.status !== "draft_created" || w.action === "review" ||
      review.workspaceId !== workspaceId ||
      review.workflowId !== workflowId ||
      review.snapshotHash !== snapshotHash ||
      digest(review.snapshotJson) !== snapshotHash ||
      Date.parse(review.expiresAt) <= Date.now()
    )
      throw new InputError(
        "Send review expired or changed. Verify the draft again.",
        409,
      );
    await reserveInvoiceObligation(db, tx, w, request.primary_recipients[0].billing_info.email_address);
    await db.createRow({
      ...params("paypal_send_approvals", id, tx),
      permissions: [],
      data: {
        workspaceId,
        workflowId,
        actorId,
        connectionVersion: review.connectionVersion,
        snapshotJson: review.snapshotJson,
        snapshotHash,
        status: "authorized",
        attemptedAt: new Date(0).toISOString(),
      },
    });
    await enqueue(
      {
        workspaceId,
        integrationId: connectionId(workspaceId, "paypal"),
        connectionVersion: review.connectionVersion,
        requestedBy: actorId,
        kind: "paypal-send",
        key: workflowId,
        payload: { workflowId },
      },
      db,
      tx,
    );
    await db.updateRow({
      ...params("financial_workflows", workflowId, tx),
      data: { status: "send_approved" },
    });
    await audit(
      db,
      tx,
      workspaceId,
      actorId,
      "paypal.send_approved",
      workflowId,
      randomBytes(16).toString("hex"),
      { snapshotHash: String(snapshotHash) },
    );
  });
}
function validateSend(
  a: Record<string, unknown>,
  job: Job,
  workflowId: string,
  recover = false,
) {
  if (
    a.workspaceId !== job.workspaceId ||
    a.workflowId !== workflowId ||
    a.connectionVersion !== job.connectionVersion ||
    (!recover && a.actorId !== job.requestedBy) ||
    digest(String(a.snapshotJson)) !== a.snapshotHash
  )
    throw new InputError("Send approval changed.", 403);
  const s = JSON.parse(String(a.snapshotJson));
  if (
    s.operation !== "send_invoice" ||
    s.workspaceId !== job.workspaceId ||
    s.workflowId !== workflowId ||
    s.connectionVersion !== job.connectionVersion ||
    JSON.stringify(s.body) !==
      JSON.stringify({ send_to_recipient: true, send_to_invoicer: true })
  )
    throw new InputError("Invalid send operation binding.", 403);
  return s;
}
export async function executeInvoiceSend(
  job: Job,
  commit: GuardedCommit,
  recover = false,
) {
  const { workflowId } = JSON.parse(job.payloadJson),
    id = sendId(job.workspaceId, workflowId),
    auth = await authority(job.workspaceId, job.requestedBy);
  if (auth.version !== job.connectionVersion)
    throw new InputError("Merchant changed.", 403);
  const claim = await commit(async (db, tx) => {
    const a = await db.getRow(params("paypal_send_approvals", id, tx)),
      s = validateSend(a, job, workflowId, recover),
      { w, request } = await verifiedContext(
        db,
        tx,
        job.workspaceId,
        workflowId,
        auth.version,
      );
    if (s.applicationIdentity !== auth.applicationIdentity)
      throw new InputError(
        "Approved sandbox application identity changed.",
        403,
      );
    if (w.providerId !== s.providerId)
      throw new InputError("Invoice changed.", 403);
    if (a.status === "completed") return null;
    if (!recover && a.status !== "authorized") {
      await db.updateRow({
        ...params("financial_workflows", workflowId, tx),
        data: { status: uncertainState(w.status) },
      });
      return null;
    }
    if (recover && !["in_flight", "unknown"].includes(a.status))
      throw new InputError("Send is not uncertain.", 409);
    if (!recover && (w.status !== "send_approved" || w.action === "review"))
      throw new InputError("Send not approved.", 403);
    if (!recover) {
      await reserveInvoiceObligation(db, tx, w, request.primary_recipients[0].billing_info.email_address);
      await db.updateRow({
        ...params("paypal_send_approvals", id, tx),
        data: { status: "in_flight", attemptedAt: new Date().toISOString() },
      });
    }
    return { ...s, request, approvingActorId: a.actorId, approvalHash: a.snapshotHash };
  });
  if (!claim) return;
  try {
    const before = await readProviderInvoice(auth.token, claim.providerId);
    if (!recover) {
      assertInvoiceMatches(before, claim.request, claim.providerId);
      if (
        JSON.stringify(before) !== JSON.stringify(claim.invoice) ||
        before.status !== "DRAFT"
      )
        throw new Error("Provider snapshot changed; send held");
      await commit(async (db, tx) => {
        const workflow = await db.getRow(params("financial_workflows", workflowId, tx));
        if (workflow.workspaceId !== job.workspaceId || workflow.action === "review")
          throw new InputError("Sending is held for obligation review.", 409);
      });
      // No documented PayPal-Request-Id on send: never retry this POST.
      const r = await fetch(
        paypalBase +
          "/v2/invoicing/invoices/" +
          encodeURIComponent(claim.providerId) +
          "/send",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + auth.token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(claim.body),
          signal: AbortSignal.timeout(20000),
          redirect: "error",
        },
      );
      if (!r.ok) throw new Error("Uncertain send");
    }
    const invoice = recover
      ? before
      : await readProviderInvoice(auth.token, claim.providerId);
    await commit(async (db, tx) => {
      const a = await db.getRow(params("paypal_send_approvals", id, tx));
      validateSend(a, job, workflowId, recover);
      if (
        a.snapshotHash !== claim.approvalHash ||
        a.actorId !== claim.approvingActorId
      )
        throw new InputError("Approval changed during reconciliation.", 403);
      if (a.status === "completed") return;
      if (!["in_flight", "unknown"].includes(a.status))
        throw new InputError("Send state changed.", 409);
      const { w, request } = await verifiedContext(
        db,
        tx,
        job.workspaceId,
        workflowId,
        auth.version,
      );
      assertInvoiceMatches(invoice, request, claim.providerId);
      const state = states[invoice.status];
      if (!state || invoice.status === "DRAFT")
        throw new InputError(
          "Send remains unconfirmed; no resend is permitted.",
          409,
        );
      await db.updateRow({
        ...params("paypal_send_approvals", id, tx),
        data: { status: "completed" },
      });
      const nextStatus = reconciliationState(w.status, state);
      await db.updateRow({
        ...params("financial_workflows", workflowId, tx), data: { status: nextStatus },
      });
      await saveInvoicePaymentLink(db, tx, job.workspaceId, workflowId, job.requestedBy, invoice, nextStatus);
      await audit(
        db,
        tx,
        job.workspaceId,
        job.requestedBy,
        "paypal.send_verified",
        workflowId,
        id,
        {
          providerStatus: invoice.status,
          approvingActorId: String(claim.approvingActorId),
          recoveryActorId: recover ? job.requestedBy : "",
          recovery: recover,
        },
      );
    });
  } catch {
    await commit(async (db, tx) => {
      const a = await db.getRow(params("paypal_send_approvals", id, tx));
      validateSend(a, job, workflowId, recover);
      if (
        a.snapshotHash !== claim.approvalHash ||
        a.actorId !== claim.approvingActorId
      )
        throw new InputError("Approval changed during recovery.", 403);
      const { w } = await verifiedContext(
        db,
        tx,
        job.workspaceId,
        workflowId,
        auth.version,
      );
      if (a.status === "completed") return; // A concurrent verified GET wins over any late failure/stale draft.
      if (!["in_flight", "unknown"].includes(a.status))
        throw new InputError("Send state changed.", 409);
      await db.updateRow({
        ...params("paypal_send_approvals", id, tx),
        data: { status: "unknown" },
      });
      await db.updateRow({
        ...params("financial_workflows", workflowId, tx),
        data: { status: uncertainState(w.status) },
      });
    });
  }
}
