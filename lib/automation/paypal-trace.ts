import { InputError } from "../workspaces/validation";
import { sendId } from "./paypal-invoice-link";
import { optionalRow, stableId } from "./store";

export type PayPalTrace = {
  approval: { status: string; at: string } | null;
  submission: { status: string; attemptedAt: string; providerId: string } | null;
  send: { status: string; attemptedAt: string } | null;
  paymentLinkVerifiedAt: string;
};

export async function readPayPalTrace(workspaceId: string, workflowId: string): Promise<PayPalTrace> {
  const workflow = await optionalRow("financial_workflows", workflowId);
  if (!workflow || workflow.workspaceId !== workspaceId) throw new InputError("Workflow not found.", 404);
  const actionId = stableId(workspaceId, workflowId);
  const invoiceId = sendId(workspaceId, workflowId);
  const [decision, action, send, link] = await Promise.all([
    optionalRow("approval_decisions", actionId),
    optionalRow("financial_actions", actionId),
    optionalRow("paypal_send_approvals", invoiceId),
    optionalRow("paypal_invoice_views", invoiceId),
  ]);
  const scope = (row: Record<string, unknown> | null) => row?.workspaceId === workspaceId && row.workflowId === workflowId;
  const timestamp = (value: unknown) => Date.parse(String(value)) > 0 ? String(value) : "";
  return {
    approval: decision && scope(decision) ? { status: String(decision.decision), at: timestamp(decision.decidedAt) } : null,
    submission: action && scope(action) ? {
      status: String(action.status), attemptedAt: timestamp(action.attemptedAt),
      providerId: String(action.providerId || ""),
    } : null,
    send: send && scope(send) ? { status: String(send.status), attemptedAt: timestamp(send.attemptedAt) } : null,
    paymentLinkVerifiedAt: link && scope(link) && link.providerId === workflow.providerId ? timestamp(link.verifiedAt) : "",
  };
}
