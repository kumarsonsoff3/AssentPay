import { Query, type TablesDB } from "node-appwrite";

/** Read-only bounded sampling. Expired reviews may be approval-referenced: these
 * counts are observations, never authorization to delete or retry provider jobs. */
export async function inspectRetention(
  db: TablesDB,
  databaseId: string,
  pages = 4,
  now = Date.now(),
) {
  if (!Number.isInteger(pages) || pages < 1 || pages > 100)
    throw new Error("Choose 1–100 pages per table.");
  const tables = [
    "slack_action_tokens",
    "paypal_send_reviews",
    "automation_jobs",
  ] as const;
  const result = [];
  for (const tableId of tables) {
    const sample = {
      table: tableId,
      available: true,
      scanned: 0,
      complete: false,
      expired: 0,
      consumed: 0,
      invalidExpiry: 0,
      rawSlackPayloads: 0,
      oldestExpiryLagSeconds: 0,
    };
    let after: string | undefined;
    for (let pageNumber = 0; pageNumber < pages; pageNumber++) {
      let page;
      try {
        page = await db.listRows({
          databaseId,
          tableId,
          queries: [
            Query.orderAsc("$id"),
            Query.limit(25),
            ...(after ? [Query.greaterThan("$id", after)] : []),
          ],
        });
      } catch (error) {
        const failure = error as { code?: number; type?: string };
        if (
          pageNumber === 0 &&
          tableId !== "automation_jobs" &&
          failure.code === 404 &&
          ["table_not_found", "collection_not_found"].includes(
            failure.type || "",
          )
        ) {
          sample.available = false;
          break;
        }
        throw error;
      }
      sample.scanned += page.rows.length;
      for (const row of page.rows) {
        if (tableId === "automation_jobs") {
          if (row.kind !== "slack-card-delivery") continue;
          try {
            if (typeof JSON.parse(row.payloadJson)?.token === "string")
              sample.rawSlackPayloads++;
          } catch {
            /* Never print malformed payloads. */
          }
        } else {
          const expiry = Date.parse(row.expiresAt);
          if (!Number.isFinite(expiry)) sample.invalidExpiry++;
          else if (expiry <= now) {
            sample.expired++;
            sample.oldestExpiryLagSeconds = Math.max(
              sample.oldestExpiryLagSeconds,
              Math.floor((now - expiry) / 1000),
            );
          }
          if (tableId === "slack_action_tokens" && row.status === "consumed")
            sample.consumed++;
        }
      }
      if (page.rows.length < 25) {
        sample.complete = true;
        break;
      }
      after = page.rows.at(-1)!.$id;
    }
    result.push(sample);
  }
  return {
    mode: "read-only-sample",
    pageSize: 25,
    maxPagesPerTable: pages,
    tables: result,
  };
}
