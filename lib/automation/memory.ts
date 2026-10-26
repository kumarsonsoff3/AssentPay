import { randomBytes } from "node:crypto";
import type { TablesDB } from "node-appwrite";
import { InputError } from "../workspaces/validation";
import { audit, params } from "./store";

export async function forgetMemory(db: TablesDB, tx: string, workspaceId: string, memoryId: string, actorId: string) {
  const row = await db.getRow(params("agent_memory", memoryId, tx));
  if (row.workspaceId !== workspaceId) throw new InputError("Memory not found.", 404);
  await db.updateRow({ ...params("agent_memory", memoryId, tx), data: { status: "forgotten", factsJson: "{}" } });
  await audit(db, tx, workspaceId, actorId, "memory.forgotten", memoryId, randomBytes(16).toString("hex"));
}
