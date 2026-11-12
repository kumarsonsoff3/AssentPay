import { requestSendReview, approveInvoiceSend } from "@/lib/automation/paypal-send";
import {
  recoverPaypal, decideWorkflow, requestPayoutCheck, reviseWorkflowAmount,
  prepareReviewedWorkflow, requestWorkflowReanalysis, requestInvoiceCheck,
} from "@/lib/automation/workflows";
import { apiUser, workspaceAccess } from "@/lib/workspaces/server";
import { apiError, inputBody, json, rateLimit } from "@/lib/workspaces/http";
import { withStorageOperation } from "@/lib/data/coordinator";
import { readPayPalTrace } from "@/lib/automation/paypal-trace";
import { validId } from "@/lib/workspaces/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; workflowId: string }> }) {
  try {
    const { id, workflowId } = await params;
    const user = await apiUser();
    await workspaceAccess(id, user.$id, ["owner"]);
    validId(workflowId);
    rateLimit("paypal-trace", user.$id, 60);
    return json(await readPayPalTrace(id, workflowId));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; workflowId: string }> }) {
  try {
    const { id, workflowId } = await params;
    const input = await inputBody(request);
    const user = await apiUser();
    await workspaceAccess(id, user.$id, ["owner"]);
    rateLimit("workflow-decision", user.$id, 20);
    validId(workflowId);

    const result = await withStorageOperation("mutation", async () => {
      const args = [id, workflowId, user.$id] as const;
      switch (input.action) {
        case "reanalyze":
          return { jobId: await requestWorkflowReanalysis(...args, input.proposalHash) };
        case "prepare_terms":
          return prepareReviewedWorkflow(...args, { ...input, action: input.financialAction });
        case "review_send":
          return requestSendReview(...args);
        case "approve_send":
          return approveInvoiceSend(...args, input.snapshotHash);
        case "recover_send":
          return requestSendReview(...args, true);
        case "revise_amount":
          return reviseWorkflowAmount(...args, input.proposalHash, input.amount);
        case "verify_invoice":
          return { jobId: await requestInvoiceCheck(...args) };
        case "verify_payout":
          return requestPayoutCheck(...args, String(input.providerId || ""));
        case "recover":
          return recoverPaypal(...args, String(input.providerId || ""));
        default:
          return decideWorkflow(...args, input);
      }
    });
    return json(result || { status: "saved" });
  } catch (error) {
    return apiError(error);
  }
}
