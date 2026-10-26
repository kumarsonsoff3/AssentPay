import { apiUser, workspaceAccess } from "@/lib/workspaces/server";
import { apiError, inputBody, json, rateLimit } from "@/lib/workspaces/http";
import { withStorageOperation } from "@/lib/data/coordinator";
import { changeInbox, inboxSummary } from "@/lib/automation/inbox";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params, user = await apiUser();
    await workspaceAccess(id, user.$id, ["owner", "admin"]);
    return json({ inbox: await inboxSummary(id) });
  } catch (e) { return apiError(e); }
}
export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params, input = await inputBody(request), user = await apiUser();
    await workspaceAccess(id, user.$id, ["owner", "admin"]);
    rateLimit("inbox", user.$id, 20);
    await withStorageOperation("mutation", () => changeInbox(id, user.$id, String(input.action), input.sourceEmail, input.sourceProvider));
    return json({ inbox: await inboxSummary(id) });
  } catch (e) { return apiError(e); }
}
