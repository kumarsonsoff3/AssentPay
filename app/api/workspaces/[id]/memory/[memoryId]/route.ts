import { apiUser, workspaceAccess } from "@/lib/workspaces/server";
import { apiError, inputBody, json, rateLimit } from "@/lib/workspaces/http";
import { withStorageOperation } from "@/lib/data/coordinator";
import { mutateMemory } from "@/lib/automation/memory";
import { validId } from "@/lib/workspaces/validation";
export async function POST(
  request: Request,
  { params: route }: { params: Promise<{ id: string; memoryId: string }> },
) {
  try {
    const { id, memoryId } = await route,
      input = await inputBody(request),
      user = await apiUser();
    const { role } = await workspaceAccess(id, user.$id, ["owner", "admin"]);
    validId(memoryId);
    rateLimit("memory", user.$id, 20);
    const memory = await withStorageOperation("mutation", op =>
      op.commit((db, tx) =>
        mutateMemory(db, tx, id, memoryId, user.$id, role, input),
      ),
    );
    return json({ memory });
  } catch (e) {
    return apiError(e);
  }
}
