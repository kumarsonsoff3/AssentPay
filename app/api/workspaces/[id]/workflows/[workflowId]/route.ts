import { apiUser, workspaceAccess } from "@/lib/workspaces/server";
import { apiError, inputBody, json, rateLimit } from "@/lib/workspaces/http";
import { withStorageOperation } from "@/lib/data/coordinator";
import { decideWorkflow } from "@/lib/automation/workflows";
import { validId } from "@/lib/workspaces/validation";
export async function POST(request: Request, { params }: { params: Promise<{ id: string; workflowId: string }> }) {
  try {
    const { id, workflowId } = await params, input = await inputBody(request), user = await apiUser();
    await workspaceAccess(id, user.$id, ["owner"]); rateLimit("workflow-decision", user.$id, 20); validId(workflowId);
    await withStorageOperation("mutation", () => decideWorkflow(id, workflowId, user.$id, input));
    return json({ status: "saved" });
  } catch (e) { return apiError(e); }
}
