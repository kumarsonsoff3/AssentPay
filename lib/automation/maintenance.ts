import { Query } from "node-appwrite";
import { retainTransientFinancialData, type RetentionCursor } from "./financial-retention";
import { databaseId, dataDatabase } from "../data/client";
import { currentOperation } from "../data/coordinator";
import { notify, optionalRow, params } from "./store";

let transientCursor: RetentionCursor = {};

export async function maintainFinancialData() {
  const db = dataDatabase();
  const operation = currentOperation();
  const transient = await retainTransientFinancialData({
    db, databaseId: databaseId(), commit: run => operation.commit(run),
  }, transientCursor);
  transientCursor = transient.cursor;

  const now = new Date().toISOString();
  const abandonedBefore = new Date(Date.now() - 10 * 60000).toISOString();
  const [verifications, limits, expired, abandoned] = await Promise.all([
    db.listRows({ ...params("forwarding_verifications"), total: false, queries: [Query.lessThanEqual("expiresAt", now), Query.limit(25)] }),
    db.listRows({ ...params("ingress_limits"), total: false, queries: [Query.lessThanEqual("expiresAt", now), Query.limit(25)] }),
    db.listRows({ ...params("agent_memory"), total: false, queries: [
      Query.equal("status", ["active", "paused"]), Query.lessThanEqual("expiresAt", now), Query.limit(25),
    ] }),
    db.listRows({ ...params("notification_deliveries"), total: false, queries: [
      Query.equal("status", "sending"), Query.lessThanEqual("attemptedAt", abandonedBefore), Query.limit(10),
    ] }),
  ]);

  // Keep batches bounded and re-read eligibility in the write transaction.
  for (const [table, rows] of [
    ["forwarding_verifications", verifications.rows],
    ["ingress_limits", limits.rows],
  ] as const) {
    if (!rows.length) continue;
    await operation.commit(async (db, tx) => {
      for (const row of rows) {
        const latest = await optionalRow(table, row.$id, db, tx);
        if (latest && Date.parse(latest.expiresAt) <= Date.parse(now)) {
          await db.deleteRow(params(table, row.$id, tx));
        }
      }
    });
  }

  if (expired.rows.length) await operation.commit(async (db, tx) => {
    for (const row of expired.rows) {
      const latest = await optionalRow("agent_memory", row.$id, db, tx);
      if (!latest || latest.workspaceId !== row.workspaceId || !["active", "paused"].includes(latest.status) ||
          !(Date.parse(latest.expiresAt) <= Date.parse(now))) continue;
      await db.updateRow({ ...params("agent_memory", row.$id, tx), data: { status: "expired", factsJson: "{}" } });
    }
  });

  if (abandoned.rows.length) await operation.commit(async (db, tx) => {
    for (const row of abandoned.rows) {
      const latest = await optionalRow("notification_deliveries", row.$id, db, tx);
      if (!latest || latest.workspaceId !== row.workspaceId || latest.status !== "sending" ||
          !(Date.parse(latest.attemptedAt) <= Date.parse(abandonedBefore))) continue;
      await db.updateRow({ ...params("notification_deliveries", row.$id, tx), data: { status: "unknown" } });
      await notify(db, tx, row.workspaceId, row.$id, "Notification outcome needs review", "A worker stopped during delivery. The proposal remains in your dashboard; automatic replay is blocked.");
    }
  });

  return { scanned: transient.scanned, deleted: transient.deleted, scrubbed: transient.scrubbed, continuing: Object.keys(transient.cursor) };
}
