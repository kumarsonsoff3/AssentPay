import { Query } from "node-appwrite";
import { dataDatabase } from "../data/client";
import { currentOperation } from "../data/coordinator";
import { notify, params } from "./store";
export async function maintainFinancialData() {
  const now = new Date().toISOString();
  for (const table of ["forwarding_verifications", "ingress_limits"]) {
    const page = await dataDatabase().listRows({ ...params(table), queries: [Query.lessThanEqual("expiresAt", now), Query.limit(25)] });
    for (const row of page.rows) await currentOperation().commit(async (db, tx) => {
      const latest = await db.getRow(params(table, row.$id, tx));
      if (Date.parse(latest.expiresAt) <= Date.now()) await db.deleteRow(params(table, row.$id, tx));
    });
  }
  const expired = await dataDatabase().listRows({ ...params("agent_memory"), queries: [Query.equal("status", "active"), Query.lessThanEqual("expiresAt", now), Query.limit(25)] });
  for (const row of expired.rows) await currentOperation().commit(async (db, tx) => {
    await db.updateRow({ ...params("agent_memory", row.$id, tx), data: { status: "expired", factsJson: "{}" } });
  });
  const abandoned = await dataDatabase().listRows({ ...params("notification_deliveries"), queries: [Query.equal("status", "sending"), Query.lessThanEqual("attemptedAt", new Date(Date.now() - 10 * 60000).toISOString()), Query.limit(10)] });
  for (const row of abandoned.rows) await currentOperation().commit(async (db, tx) => {
    const latest = await db.getRow(params("notification_deliveries", row.$id, tx));
    if (latest.status !== "sending") return;
    await db.updateRow({ ...params("notification_deliveries", row.$id, tx), data: { status: "unknown" } });
    await notify(db, tx, row.workspaceId, row.$id, "Notification outcome needs review", "A worker stopped during delivery. The proposal remains in your dashboard; automatic replay is blocked.");
  });
}
