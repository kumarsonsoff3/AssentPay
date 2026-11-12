import { createHash, randomBytes } from "node:crypto";
import type { TablesDB } from "node-appwrite";
import { z } from "zod";
import { InputError } from "../workspaces/validation";
import { optionalRow, audit, params } from "./store";
const plain = z.string().trim().max(500).refine(value => !/[<>]/.test(value) && !Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127), "Use plain text, not HTML.");
export const contextFields = ["counterparty", "reference", "note"] as const;
const correction = z.object({ counterparty: plain, reference: plain, note: plain }).strict();
const base = { version: z.string().regex(/^[a-f0-9]{64}$/) };
const mutation = z.discriminatedUnion("action", [
  z.object({ ...base, action: z.literal("correct"), context: correction }).strict(),
  z.object({ ...base, action: z.literal("pause") }).strict(),
  z.object({ ...base, action: z.literal("resume"), confirmed: z.literal(true) }).strict(),
  z.object({ ...base, action: z.literal("forget"), confirmed: z.literal(true) }).strict(),
]);
type Row = Record<string, unknown>;
export function memoryVersion(row: Row) {
  return createHash("sha256").update(JSON.stringify([row.$id, row.$updatedAt, row.status, row.expiresAt, row.factsJson])).digest("hex");
}
function facts(row: Row): Record<string, unknown> {
  try { const value = JSON.parse(String(row.factsJson)); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; } catch { return {}; }
}
export function memoryView(row: Row) {
  const data = row.status === "forgotten" ? {} : facts(row);
  return { id: String(row.$id), updatedAt: String(row.$updatedAt || ""), sourceId: String(row.sourceId || ""), status: row.status, expiresAt: row.expiresAt,
    expired: !(Date.parse(String(row.expiresAt)) > Date.now()), version: memoryVersion(row), facts: data,
    provenance: data.userContext ? "user_corrected_context" : "unconfirmed_extraction" };
}
export async function memoryContextAllowed(workspaceId: string, sourceId: string) {
  const memory = await optionalRow("agent_memory", sourceId);
  // Corrected facts must not be contradicted by original sender/workflow history.
  return !!memory && memory.workspaceId === workspaceId && memory.status === "active" && Date.parse(memory.expiresAt) > Date.now() && !facts(memory).userContext;
}
export function aiMemoryContext(row: Row, workspaceId: string) {
  if (row.workspaceId !== workspaceId || row.status !== "active" || !(Date.parse(String(row.expiresAt)) > Date.now())) return null;
  const data = facts(row);
  const corrected = data.userContext && typeof data.userContext === "object" ? data.userContext as Record<string, unknown> : null;
  const context = corrected ? Object.fromEntries(contextFields.map(field => [field, corrected[field]])) : data;
  return { id: row.$id, sourceId: row.sourceId, authority: "context_only_never_financial_evidence", provenance: corrected ? "user_corrected_context" : "unconfirmed_extraction", facts: context };
}
// Do not upsert: paused, expired, corrected and erased records are durable tombstones.
export async function rememberExtractedMemory(db: TablesDB, tx: string, workspaceId: string, sourceId: string, extracted: Record<string, unknown>) {
  const prior = await optionalRow("agent_memory", sourceId, db, tx);
  if (prior) { if (prior.workspaceId !== workspaceId) throw new InputError("Memory not found.", 404); return; }
  await db.createRow({ ...params("agent_memory", sourceId, tx), permissions: [], data: { workspaceId, sourceId, status: "active", expiresAt: new Date(Date.now() + 90 * 86400000).toISOString(), factsJson: JSON.stringify(extracted) } });
}
export async function mutateMemory(db: TablesDB, tx: string, workspaceId: string, memoryId: string, actorId: string, role: string, input: unknown) {
  if (!["owner", "admin"].includes(role)) throw new InputError("Only owners and admins can manage memory.", 403);
  const parsed = mutation.safeParse(input);
  if (!parsed.success) throw new InputError("Invalid memory change. Reload and use bounded plain-text fields with confirmation.");
  const change = parsed.data, row = await db.getRow(params("agent_memory", memoryId, tx));
  if (row.workspaceId !== workspaceId) throw new InputError("Memory not found.", 404);
  if (memoryVersion(row) !== change.version) throw new InputError("This memory changed. Reload before trying again.", 409);
  if (row.status === "forgotten") throw new InputError("Forgotten memory cannot be restored or edited.", 409);
  const data: Record<string, string> = {};
  if (change.action === "forget") { data.status = "forgotten"; data.factsJson = "{}"; }
  else if (change.action === "pause") {
    if (row.status !== "active") throw new InputError("Only active memory can be paused.", 409);
    data.status = "paused";
  } else if (change.action === "resume") {
    if (row.status !== "paused" || !(Date.parse(row.expiresAt) > Date.now())) throw new InputError("Only unexpired paused memory can resume. Expired memory cannot be revived.", 409);
    data.status = "active";
  } else {
    if (!["active", "paused"].includes(row.status) || !(Date.parse(row.expiresAt) > Date.now())) throw new InputError("Expired memory cannot be corrected or revived.", 409);
    data.factsJson = JSON.stringify({ ...facts(row), userContext: { ...change.context, authority: "user_context_not_source_evidence", correctedBy: actorId, correctedAt: new Date().toISOString(), revision: randomBytes(16).toString("hex") } });
  }
  await db.updateRow({ ...params("agent_memory", memoryId, tx), data });
  const actions = { correct: "corrected", pause: "paused", resume: "resumed", forget: "forgotten" } as const;
  // Audits hold metadata, not raw fact values: forget preserves accountability.
  await audit(db, tx, workspaceId, actorId, "memory." + actions[change.action], memoryId, randomBytes(16).toString("hex"), { previousVersion: change.version, sourceId: String(row.sourceId), fields: change.action === "correct" ? contextFields.join(",") : "", financialAuthorityChanged: false });
  return memoryView({ ...row, ...data });
}
// Internal compatibility helper; public changes require version and confirmation.
export async function forgetMemory(db: TablesDB, tx: string, workspaceId: string, memoryId: string, actorId: string) {
  const row = await db.getRow(params("agent_memory", memoryId, tx));
  return mutateMemory(db, tx, workspaceId, memoryId, actorId, "owner", { action: "forget", version: memoryVersion(row), confirmed: true });
}
