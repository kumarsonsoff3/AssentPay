import { requestSendReview, approveInvoiceSend } from '@/lib/automation/paypal-send';
import { apiUser, workspaceAccess } from "@/lib/workspaces/server";
import { apiError, inputBody, json, rateLimit } from "@/lib/workspaces/http";
import { withStorageOperation } from "@/lib/data/coordinator";
import { recoverPaypal, decideWorkflow, requestPayoutCheck, reviseWorkflowAmount } from "@/lib/automation/workflows";
import { validId } from "@/lib/workspaces/validation";
export async function POST(request: Request, { params }: { params: Promise<{ id: string; workflowId: string }> }) {
  try {
    const { id, workflowId } = await params, input = await inputBody(request), user = await apiUser();
    await workspaceAccess(id, user.$id, ["owner"]); rateLimit("workflow-decision", user.$id, 20); validId(workflowId);
    await withStorageOperation("mutation", () => input.action === "review_send" ? requestSendReview(id, workflowId, user.$id) : input.action === "approve_send" ? approveInvoiceSend(id, workflowId, user.$id, input.snapshotHash) : input.action === "recover_send" ? requestSendReview(id, workflowId, user.$id, true) : input.action === "revise_amount" ? reviseWorkflowAmount(id, workflowId, user.$id, input.proposalHash, input.amount) : input.action === "verify_payout" ? requestPayoutCheck(id, workflowId, user.$id, String(input.providerId || "")) : input.action === "recover" ? recoverPaypal(id, workflowId, user.$id, String(input.providerId || "")) : decideWorkflow(id, workflowId, user.$id, input));
    return json({ status: "saved" });
  } catch (e) { return apiError(e); }
}
