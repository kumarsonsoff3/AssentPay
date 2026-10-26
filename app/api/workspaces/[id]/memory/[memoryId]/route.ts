import { apiUser, workspaceAccess } from "@/lib/workspaces/server";
import { apiError, inputBody, json, rateLimit } from "@/lib/workspaces/http";
import { withStorageOperation } from "@/lib/data/coordinator";
import { forgetMemory } from "@/lib/automation/memory";
import { InputError, validId } from "@/lib/workspaces/validation";
export async function POST(request: Request, { params: route }: { params: Promise<{ id: string; memoryId: string }> }) {
  try {
    const { id, memoryId } = await route, input = await inputBody(request), user = await apiUser();
    await workspaceAccess(id, user.$id, ["owner", "admin"]); validId(memoryId); rateLimit("memory", user.$id, 20);
    if (input.action !== "forget") throw new InputError("Invalid memory action.");
    await withStorageOperation("mutation", (op) => op.commit((db, tx) => forgetMemory(db, tx, id, memoryId, user.$id)));
    return json({ status: "forgotten" });
  } catch (e) { return apiError(e); }
}
