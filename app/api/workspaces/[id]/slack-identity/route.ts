import { apiUser, workspaceAccess } from "@/lib/workspaces/server";
import { apiError, inputBody, json, rateLimit } from "@/lib/workspaces/http";
import { withStorageOperation } from "@/lib/data/coordinator";
import { manageSlackIdentity } from "@/lib/automation/slack-approvals";
import { validId } from "@/lib/workspaces/validation";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; validId(id);
    const input = await inputBody(request), user = await apiUser();
    await workspaceAccess(id, user.$id, ["owner"]);
    rateLimit("slack-identity", user.$id, 10);
    return json(await withStorageOperation("mutation", () => manageSlackIdentity(id, user.$id, input)));
  } catch (error) { return apiError(error); }
}
