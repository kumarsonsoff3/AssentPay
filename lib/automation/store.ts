import { createHash, randomBytes } from "node:crypto";
import {
  Query,
  type Models,
  type TablesDB,
} from "node-appwrite";
import { dataDatabase, databaseId } from "../data/client";
import { currentOperation } from "../data/coordinator";
import { InputError, validId } from "../workspaces/validation";
export const stableId = (...parts: string[]) =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32);
export function params(tableId: string): {
  databaseId: string;
  tableId: string;
};
export function params(
  tableId: string,
  rowId: string,
  transactionId?: string,
): {
  databaseId: string;
  tableId: string;
  rowId: string;
  transactionId?: string;
};
export function params(
  tableId: string,
  rowId?: string,
  transactionId?: string,
) {
  return {
    databaseId: databaseId(),
    tableId,
    ...(rowId ? { rowId } : {}),
    ...(transactionId ? { transactionId } : {}),
  };
}
export const missing = (e: unknown) =>
  typeof e === "object" && e !== null && "code" in e && "type" in e &&
  e.code === 404 && e.type === "row_not_found";
export async function optionalRow(
  table: string,
  id: string,
  db = dataDatabase(),
  tx?: string,
) {
  try {
    return await db.getRow(params(table, id, tx));
  } catch (e) {
    if (missing(e)) return null;
    throw e;
  }
}
export async function signal(
  db: TablesDB,
  tx: string,
  workspaceId: string,
  kind: string,
) {
  await db.upsertRow({
    ...params("workspace_events", workspaceId, tx),
    permissions: [],
    data: { workspaceId, kind, revision: randomBytes(16).toString("hex") },
  });
}
export async function audit(
  db: TablesDB,
  tx: string,
  workspaceId: string,
  actorId: string,
  action: string,
  entityId: string,
  correlationId: string,
  details: Record<string, string | number | boolean> = {},
) {
  await db.createRow({
    ...params("audit_events", stableId(correlationId, action, entityId), tx),
    permissions: [],
    data: {
      workspaceId,
      actorId,
      action,
      entityId,
      correlationId,
      occurredAt: new Date().toISOString(),
      detailsJson: JSON.stringify(details),
    },
  });
  await signal(db, tx, workspaceId, action);
}
export async function notify(
  db: TablesDB,
  tx: string,
  workspaceId: string,
  id: string,
  title: string,
  description: string,
  kind = "automation",
) {
  await db.upsertRow({
    ...params("notifications", stableId(id), tx),
    permissions: [],
    data: { workspaceId, title, description, kind, entityId: id },
  });
}
export type Job = Models.Row & {
  workspaceId: string;
  integrationId: string;
  connectionVersion: string;
  kind: "gmail-sync" | "provider-event" | "document-import" | "resend-ingest" | "financial-analyze" | "paypal-execute" | "workflow-notify" | "workflow-reminder" | "paypal-reconcile" | "paypal-recover" | "paypal-payout-check" | "paypal-send-review" | "paypal-send" | "paypal-send-recover" | "financial-slack-notify" | "slack-card-delivery";
  requestedBy: string;
  status: string;
  attempts: number;
  nextAttemptAt: string;
  leaseUntil: string;
  leaseToken: string;
  requestedAt: string;
  errorCode: string;
  payloadJson: string;
};
export async function enqueue(
  input: {
    workspaceId: string;
    integrationId: string;
    connectionVersion: string;
    requestedBy: string;
    kind: Job["kind"];
    key: string;
    payload?: Record<string, unknown>;
    force?: boolean;
  },
  db?: TablesDB,
  tx?: string,
): Promise<string> {
  if (!db || !tx)
    return currentOperation().commit((d, t) => enqueue(input, d, t));
  const id = stableId(
      input.workspaceId,
      input.connectionVersion,
      input.kind,
      input.key,
    ),
    prior = await optionalRow("automation_jobs", id, db, tx),
    now = new Date().toISOString();
  if (prior) {
    if (prior.status === "failed" && !input.force) return id;
    await db.updateRow({
      ...params("automation_jobs", id, tx),
      data:
        ["running","queued","retry"].includes(prior.status)
          ? { requestedAt: now }
          : {
              status: "queued",
              attempts: 0,
              errorCode: "",
              nextAttemptAt: now,
              requestedAt: now,
            },
    });
  } else
    await db.createRow({
      ...params("automation_jobs", id, tx),
      permissions: [],
      data: {
        workspaceId: input.workspaceId,
        integrationId: input.integrationId,
        connectionVersion: input.connectionVersion,
        kind: input.kind,
        requestedBy: input.requestedBy,
        status: "queued",
        attempts: 0,
        nextAttemptAt: now,
        leaseUntil: new Date(0).toISOString(),
        leaseToken: "",
        requestedAt: now,
        errorCode: "",
        payloadJson: JSON.stringify(input.payload || {}),
      },
    });
  await signal(db, tx, input.workspaceId, "job.queued");
  return id;
}
export const isPayoutEvent = (eventType: string) => /^PAYMENT\.(PAYOUTSBATCH|PAYOUTS-ITEM)\./.test(eventType);

export async function receiveEvent(input: {
  workspaceId: string;
  integrationId: string;
  connectionVersion: string;
  requestedBy: string;
  provider: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  gmail?: boolean;
}) {
  return currentOperation().commit(async (db, tx) => {
    const id = stableId(
      input.workspaceId,
      input.provider,
      input.eventId,
      input.connectionVersion,
    );
    if (await optionalRow("webhook_events", id, db, tx))
      return { duplicate: true };
    const meta = await db.getRow(
      params("integrations", input.integrationId, tx),
    );
    if (
      meta.workspaceId !== input.workspaceId ||
      meta.connectionVersion !== input.connectionVersion ||
      meta.disconnectedAt
    )
      throw new InputError("Connection changed.", 409);
    await db.createRow({
      ...params("webhook_events", id, tx),
      permissions: [],
      data: {
        workspaceId: input.workspaceId,
        provider: input.provider,
        eventId: input.eventId.slice(0, 255),
        eventType: input.eventType.slice(0, 128),
        status: "received",
        payloadJson: JSON.stringify(input.payload),
      },
    });
    await enqueue(
      {
        ...input,
        kind: input.gmail ? "gmail-sync" : input.provider === "paypal" && (input.eventType.startsWith("INVOICING.") || isPayoutEvent(input.eventType)) ? "paypal-reconcile" : "provider-event",
        key: input.gmail ? "mailbox" : id,
        payload: { receiptId: id },
      },
      db,
      tx,
    );
    return { duplicate: false };
  });
}
export async function retryJob(workspaceId: string, id: string) {
  validId(id);
  return currentOperation().commit(async (db, tx) => {
    const job = await db.getRow(params("automation_jobs", id, tx));
    if (job.workspaceId !== workspaceId)
      throw new InputError("Job not found.", 404);
    if (!["failed", "cancelled"].includes(job.status))
      throw new InputError("Only failed jobs can be retried.", 409);
    await db.updateRow({
      ...params("automation_jobs", id, tx),
      data: {
        status: "queued",
        attempts: 0,
        errorCode: "",
        nextAttemptAt: new Date().toISOString(),
        requestedAt: new Date().toISOString(),
      },
    });
    await audit(
      db,
      tx,
      workspaceId,
      job.requestedBy,
      "job.retried",
      id,
      randomBytes(16).toString("hex"),
    );
    return id;
  });
}
export const listWorkspace = (
  tableId: string,
  workspaceId: string,
  queries: string[] = [],
) =>
  dataDatabase().listRows({
    ...params(tableId),
    queries: [Query.equal("workspaceId", workspaceId), ...queries],
  });
