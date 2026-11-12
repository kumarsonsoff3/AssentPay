import { apiUser, workspaceAccess } from "@/lib/workspaces/server";
import { apiError, json } from "@/lib/workspaces/http";
import { readAnalytics } from "@/lib/dashboard/analytics-server";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params, user = await apiUser();
    await workspaceAccess(id, user.$id);
    return json(await readAnalytics(id));
  } catch (error) { return apiError(error); }
}
