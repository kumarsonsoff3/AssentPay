import { Query, type TablesDB, type Models } from "node-appwrite";
import { createHash } from "node:crypto";
import { stableId } from "./store";
import { connectionId } from "../integrations/records";

// Deliberately excludes financial actions, approvals, bindings, claims and audit rows.
const transientTables = ["slack_action_tokens", "paypal_send_reviews"] as const;
type TransientTable = (typeof transientTables)[number];
type RetentionRow = Models.Row & Record<string, unknown>;
export type RetentionCursor = Partial<
  Record<TransientTable | "automation_jobs", string>
>;
export type RetentionDependencies = {
  db: TablesDB;
  databaseId: string;
  commit: <T>(run: (db: TablesDB, tx: string) => Promise<T>) => Promise<T>;
};
const absent = (error: unknown, types: string[]) => {
  const e = error as { code?: number; type?: string } | null;
  return e?.code === 404 && types.includes(e.type || "");
};
const rowMissing = (error: unknown) =>
  absent(error, ["row_not_found", "document_not_found"]);

/** One bounded page per table per tick. Cursors are optimization, not authority.
 * Stable ID ordering needs no surviving cursor row. Lower IDs are visited on wrap.
 * Missing optional tables are skipped before migration; other failures propagate.
 * A missing approval TABLE never means that there is no approval.
 */
export async function retainTransientFinancialData(
  deps: RetentionDependencies,
  cursor: RetentionCursor = {},
  now = Date.now(),
) {
  const next: RetentionCursor = {};
  const deleted = { slack_action_tokens: 0, paypal_send_reviews: 0 };
  const scanned = {
    slack_action_tokens: 0,
    paypal_send_reviews: 0,
    automation_jobs: 0,
  };
  let scrubbed = 0;
  const base = (tableId: string, rowId: string, transactionId: string) => ({
    databaseId: deps.databaseId,
    tableId,
    rowId,
    transactionId,
  });
  const eligible = (row: RetentionRow) =>
    row.status === "consumed" ||
    (Number.isFinite(Date.parse(String(row.expiresAt))) &&
      Date.parse(String(row.expiresAt)) <= now);
  const jobReference = (job: RetentionRow) => {
    let payload;
    try {
      payload = JSON.parse(String(job.payloadJson));
    } catch {
      return null;
    }
    if (
      !payload ||
      typeof payload !== "object" ||
      typeof payload.tokenId !== "string" ||
      !/^[a-f0-9]{32}$/.test(payload.tokenId)
    )
      return null;
    if (
      payload.token !== undefined &&
      (typeof payload.token !== "string" ||
        !/^[a-f0-9]{64}$/.test(payload.token) ||
        createHash("sha256")
          .update(payload.token)
          .digest("hex")
          .slice(0, 32) !== payload.tokenId)
    )
      return null;
    if (
      job.kind !== "slack-card-delivery" ||
      job.integrationId !== connectionId(String(job.workspaceId), "slack") ||
      job.$id !==
        stableId(
          String(job.workspaceId),
          String(job.connectionVersion),
          String(job.kind),
          payload.tokenId,
        )
    )
      return null;
    return payload as { tokenId: string; token?: unknown };
  };
  const matches = (job: RetentionRow, token: RetentionRow) =>
    job.workspaceId === token.workspaceId &&
    job.requestedBy === token.ownerId &&
    job.connectionVersion === token.connectionVersion;
  const scrub = async (
    db: TablesDB,
    tx: string,
    job: RetentionRow,
    token?: RetentionRow,
  ) => {
    const payload = jobReference(job);
    if (
      !payload ||
      (token && (!matches(job, token) || payload.tokenId !== token.$id))
    )
      return false;
    // Raw capabilities must match the bound digest when a capability row exists.
    if (
      token &&
      payload.token !== undefined &&
      (typeof payload.token !== "string" ||
        createHash("sha256").update(payload.token).digest("hex") !==
          token.tokenHash)
    )
      return false;
    const reference = JSON.stringify({ tokenId: payload.tokenId });
    if (job.payloadJson !== reference) {
      await db.updateRow({
        ...base("automation_jobs", job.$id, tx),
        data: { payloadJson: reference },
      });
      scrubbed++;
    }
    return true;
  };
  for (const table of transientTables) {
    let page;
    try {
      page = await deps.db.listRows({
        databaseId: deps.databaseId,
        tableId: table,
        queries: [
          Query.orderAsc("$id"),
          Query.limit(25),
          ...(cursor[table] ? [Query.greaterThan("$id", cursor[table]!)] : []),
        ],
      });
    } catch (error) {
      if (absent(error, ["table_not_found", "collection_not_found"])) continue;
      throw error;
    }
    scanned[table] = page.rows.length;
    if (page.rows.length === 25) next[table] = page.rows.at(-1)!.$id;
    for (const candidate of page.rows) {
      await deps.commit(async (db, tx) => {
        let row;
        try {
          row = await db.getRow(base(table, candidate.$id, tx));
        } catch (error) {
          if (rowMissing(error)) return;
          throw error;
        }
        if (
          row.workspaceId !== candidate.workspaceId ||
          (table === "paypal_send_reviews" &&
            row.workflowId !== candidate.workflowId)
        )
          return;
        const expired =
          Number.isFinite(Date.parse(row.expiresAt)) &&
          Date.parse(row.expiresAt) <= now;
        if (table === "slack_action_tokens") {
          if (!expired && row.status !== "consumed") return;
          const jobId = stableId(
            row.workspaceId,
            row.connectionVersion,
            "slack-card-delivery",
            row.$id,
          );
          let job;
          try {
            job = await db.getRow(base("automation_jobs", jobId, tx));
          } catch (error) {
            if (!rowMissing(error)) throw error;
          }
          // Do not delete the row while leaving a mismatched/foreign job unexamined.
          if (job && !(await scrub(db, tx, job, row))) return;
        } else {
          let approval;
          try {
            approval = await db.getRow(
              base("paypal_send_approvals", row.$id, tx),
            );
          } catch (error) {
            if (!rowMissing(error)) throw error;
          }
          // Keep every referenced review, including unknown/in-flight or malformed
          // approvals. Immutable approval snapshots and all audit/dedupe rows stay.
          if (approval) return;
          let workflow;
          try {
            workflow = await db.getRow(
              base("financial_workflows", row.workflowId, tx),
            );
          } catch (error) {
            if (!rowMissing(error)) throw error;
          }
          if (workflow && workflow.workspaceId !== row.workspaceId) return;
          const superseded = !workflow || workflow.status !== "draft_created";
          if (!expired && !superseded) return;
        }
        await db.deleteRow(base(table, row.$id, tx));
        deleted[table]++;
      });
    }
  }
  // Independent bounded pass catches jobs whose capability was already pruned by
  // an older worker, account cleanup, or another retention transaction. Never use
  // candidate payloads for mutation: reread both current job and capability in tx.
  // Scan the system-ID index; no new kind/order compound index or migration needed.
  const jobs = await deps.db.listRows({
    databaseId: deps.databaseId,
    tableId: "automation_jobs",
    queries: [
      Query.orderAsc("$id"),
      Query.limit(25),
      ...(cursor.automation_jobs
        ? [Query.greaterThan("$id", cursor.automation_jobs)]
        : []),
    ],
  });
  scanned.automation_jobs = jobs.rows.length;
  if (jobs.rows.length === 25) next.automation_jobs = jobs.rows.at(-1)!.$id;
  for (const candidate of jobs.rows)
    await deps.commit(async (db, tx) => {
      let job;
      try {
        job = await db.getRow(base("automation_jobs", candidate.$id, tx));
      } catch (error) {
        if (rowMissing(error)) return;
        throw error;
      }
      if (
        job.workspaceId !== candidate.workspaceId ||
        job.requestedBy !== candidate.requestedBy ||
        job.connectionVersion !== candidate.connectionVersion
      )
        return;
      const payload = jobReference(job);
      if (!payload) return;
      let token;
      try {
        token = await db.getRow(
          base("slack_action_tokens", payload.tokenId, tx),
        );
      } catch (error) {
        if (!rowMissing(error)) throw error;
      }
      if (token && (!matches(job, token) || !eligible(token))) return;
      await scrub(db, tx, job, token);
    });
  return { cursor: next, deleted, scanned, scrubbed };
}
