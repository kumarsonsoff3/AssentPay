import type { TablesDB } from "node-appwrite";
import { connectionId } from "../integrations/records";
import { enqueue, optionalRow, params, stableId } from "./store";

export const sendId = (workspaceId: string, workflowId: string) =>
  stableId(workspaceId, workflowId, "send_invoice_v1");

export const invoiceCanBePaid = (status: unknown) =>
  ["invoice_sent", "unpaid", "payment_pending", "partially_paid"].includes(String(status));

export type PayPalInvoice = {
  id: string;
  status: string;
  detail?: { reference?: string; metadata?: { recipient_view_url?: string } };
};

export function verifiedSandboxInvoiceUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.origin === "https://www.sandbox.paypal.com" &&
      !url.username && !url.password &&
      /^\/invoice\/(p|view)\//.test(url.pathname) ? url.href : null;
  } catch {
    return null;
  }
}

export async function storedInvoicePaymentLink(
  workspaceId: string, workflowId: string, providerId: unknown, status: unknown,
  db?: TablesDB, tx?: string,
) {
  if (!invoiceCanBePaid(status) || typeof providerId !== "string" || !providerId.startsWith("INV2-")) return null;
  const view = await optionalRow("paypal_invoice_views", sendId(workspaceId, workflowId), db, tx);
  return view?.workspaceId === workspaceId && view.workflowId === workflowId && view.providerId === providerId
    ? verifiedSandboxInvoiceUrl(view.paymentLink) : null;
}

export async function enqueueSlackWorkflowUpdate(
  db: TablesDB, tx: string, workspaceId: string, workflowId: string,
  requestedBy: string, phase: "approval" | "payment",
) {
  const integrationId = connectionId(workspaceId, "slack");
  const slack = await optionalRow("integrations", integrationId, db, tx);
  if (!slack || slack.workspaceId !== workspaceId || slack.provider !== "slack" ||
      slack.status !== "connected" || slack.disconnectedAt) return;
  await enqueue({
    workspaceId, integrationId, requestedBy, connectionVersion: slack.connectionVersion,
    kind: "financial-slack-notify", key: stableId(workflowId, phase), payload: { workflowId, phase },
  }, db, tx);
}

/** Invoice and status must already have been verified against the approved request. */
export async function saveInvoicePaymentLink(
  db: TablesDB, tx: string, workspaceId: string, workflowId: string,
  requestedBy: string, invoice: PayPalInvoice, status: string,
) {
  const id = sendId(workspaceId, workflowId);
  const link = invoiceCanBePaid(status) && ["SENT", "UNPAID", "PAYMENT_PENDING", "PARTIALLY_PAID"].includes(invoice.status)
    ? verifiedSandboxInvoiceUrl(invoice.detail?.metadata?.recipient_view_url) : null;
  if (!link) return;
  const previous = await optionalRow("paypal_invoice_views", id, db, tx);
  if (previous && (previous.workspaceId !== workspaceId || previous.workflowId !== workflowId ||
      previous.providerId !== invoice.id || previous.paymentLink === link)) return;
  await db.upsertRow({
    ...params("paypal_invoice_views", id, tx), permissions: [],
    data: { workspaceId, workflowId, providerId: invoice.id, paymentLink: link, verifiedAt: new Date().toISOString() },
  });
  if (!previous?.paymentLink) await enqueueSlackWorkflowUpdate(db, tx, workspaceId, workflowId, requestedBy, "payment");
}
