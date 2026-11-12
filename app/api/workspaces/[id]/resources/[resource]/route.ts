import { apiUser, workspaceAccess } from "@/lib/workspaces/server";
import { readResources, requireResource } from "@/lib/automation/resources";
import { apiError, json } from "@/lib/workspaces/http";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; resource: string }> },
) {
  try {
    const { id, resource } = await params,
      user = await apiUser();
    await workspaceAccess(id, user.$id);
    return json(
      await readResources(
        id,
        requireResource(resource),
        user.$id,
        new URL(request.url).searchParams.get("cursor") || undefined,
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
