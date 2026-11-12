import { paypalSendTables } from "../automation/paypal-send-schema";
import { slackApprovalTables } from "../automation/slack-schema";
import {
  AppwriteException,
  Query,
  type TablesDB,
  type Storage,
} from "node-appwrite";
import { tables } from "./schema";
import { automationTables, documentBucketId } from "../automation/schema";
import { financialTables } from "../automation/financial-schema";
import { stableId } from "../automation/store";
import { recordId } from "../workspaces/ids";

import { safetyTables } from "../automation/safety-schema";
export const dataTables = [
  ...tables,
  ...automationTables,
  ...financialTables,
  ...safetyTables,
  ...paypalSendTables,
  ...slackApprovalTables,
];
export const workspaceTables = dataTables.filter(table =>
  table.columns.some(column => column.key === "workspaceId"),
);
export type CleanupDependencies = {
  db: TablesDB;
  storage: Storage;
  databaseId: string;
  check: () => Promise<void>;
  commit: <T>(run: (db: TablesDB, tx: string) => Promise<T>) => Promise<T>;
};
const missing = (error: unknown, types: string[]) =>
  error instanceof AppwriteException &&
  error.code === 404 &&
  types.includes(error.type);
export async function deleteRowIfPresent(
  db: TablesDB,
  databaseId: string,
  tableId: string,
  rowId: string,
  transactionId?: string,
) {
  try {
    await db.deleteRow({ databaseId, tableId, rowId, transactionId });
  } catch (error) {
    if (!missing(error, ["row_not_found", "document_not_found"])) throw error;
  }
}

/** Delete the first remaining page each time: deleting a cursor row must never skip data. */
export async function purgeRows(
  deps: CleanupDependencies,
  tableId: string,
  queries: string[],
) {
  for (;;) {
    await deps.check();
    let page;
    try {
      page = await deps.db.listRows({
        databaseId: deps.databaseId,
        tableId,
        queries: [...queries, Query.limit(25)],
      });
    } catch (error) {
      if (missing(error, ["table_not_found", "collection_not_found"])) return;
      throw error;
    }
    if (!page.rows.length) return;
    if (tableId === "documents") {
      for (const row of page.rows) {
        // Cover files uploaded just before a worker failed to save its fileId.
        const ids = new Set(
          [
            row.fileId,
            row.$id,
            stableId(row.workspaceId, row.connectionVersion, row.$id),
          ].filter((id): id is string => typeof id === "string" && !!id),
        );
        for (const fileId of ids) {
          await deps.check();
          try {
            await deps.storage.deleteFile({
              bucketId: documentBucketId,
              fileId,
            });
          } catch (error) {
            if (
              !missing(error, [
                "storage_file_not_found",
                "storage_bucket_not_found",
              ])
            )
              throw error;
          }
        }
      }
    }
    await deps.commit(async (db, tx) => {
      for (const row of page.rows) {
        await deleteRowIfPresent(db, deps.databaseId, tableId, row.$id, tx);
        if (tableId === "onboarding")
          await deleteRowIfPresent(
            db,
            deps.databaseId,
            "schema_migrations",
            recordId("b", row.$id),
            tx,
          );
      }
    });
  }
}

export async function purgeWorkspace(
  deps: CleanupDependencies,
  workspaceId: string,
) {
  // The exclusive storage lease has drained workers before files/credentials disappear.
  for (const table of workspaceTables)
    await purgeRows(deps, table.id, [Query.equal("workspaceId", workspaceId)]);
  await purgeRows(deps, "onboarding", [
    Query.equal("workspaceId", workspaceId),
  ]);
  await deps.commit((db, tx) =>
    deleteRowIfPresent(db, deps.databaseId, "workspaces", workspaceId, tx),
  );
}

export async function purgeAccountReferences(
  deps: CleanupDependencies,
  userId: string,
) {
  // Personal Slack authority and recipient-bearing capabilities are not financial audit records.
  for (const table of slackApprovalTables)
    await purgeRows(deps, table.id, [Query.equal("ownerId", userId)]);
  // Legacy snapshots in the database must not retain personal credentials or OAuth state.
  const legacyIds: string[] = [];
  let cursor: string | undefined;
  do {
    let page;
    try {
      page = await deps.db.listRows({
        databaseId: deps.databaseId,
        tableId: "onboarding",
        queries: [
          Query.limit(100),
          ...(cursor ? [Query.cursorAfter(cursor)] : []),
        ],
      });
    } catch (error) {
      if (missing(error, ["table_not_found", "collection_not_found"])) break;
      throw error;
    }
    for (const row of page.rows) {
      const payload = JSON.parse(row.payload);
      if (
        [payload.userId, payload.connectedBy, payload.requestedBy].includes(
          userId,
        )
      )
        legacyIds.push(row.$id);
    }
    cursor = page.rows.length === 100 ? page.rows.at(-1)?.$id : undefined;
  } while (cursor);
  for (const id of legacyIds)
    await deps.commit(async (db, tx) => {
      await deleteRowIfPresent(db, deps.databaseId, "onboarding", id, tx);
      await deleteRowIfPresent(
        db,
        deps.databaseId,
        "schema_migrations",
        recordId("b", id),
        tx,
      );
    });
  // Revoke the departing user's personal credentials and imported connection data.
  for (;;) {
    await deps.check();
    const page = await deps.db.listRows({
      databaseId: deps.databaseId,
      tableId: "integrations",
      queries: [Query.equal("connectedBy", userId), Query.limit(25)],
    });
    if (!page.rows.length) break;
    for (const integration of page.rows) {
      for (const table of workspaceTables.filter(table =>
        table.columns.some(column => column.key === "connectionVersion"),
      )) {
        // Financial evidence is workspace-owned, not a personal connection import. Retain original hashes/snapshots for audit and GET-only reconciliation.
        if (
          [
            "integrations",
            "integration_secrets",
            "financial_actions",
            "paypal_send_approvals",
            "paypal_send_reviews",
          ].includes(table.id)
        )
          continue;
        await purgeRows(deps, table.id, [
          Query.equal("workspaceId", integration.workspaceId),
          Query.equal("connectionVersion", integration.connectionVersion),
        ]);
      }
      await deps.commit(async (db, tx) => {
        await deleteRowIfPresent(
          db,
          deps.databaseId,
          "integration_secrets",
          integration.$id,
          tx,
        );
        await deleteRowIfPresent(
          db,
          deps.databaseId,
          "integrations",
          integration.$id,
          tx,
        );
      });
    }
  }
  for (const table of dataTables) {
    for (const field of ["userId", "requestedBy"]) {
      if (table.columns.some(column => column.key === field))
        await purgeRows(deps, table.id, [Query.equal(field, userId)]);
    }
    for (const field of ["actorId", "createdBy"]) {
      if (!table.columns.some(column => column.key === field)) continue;
      for (;;) {
        await deps.check();
        const page = await deps.db.listRows({
          databaseId: deps.databaseId,
          tableId: table.id,
          queries: [Query.equal(field, userId), Query.limit(25)],
        });
        if (!page.rows.length) break;
        await deps.commit(async (db, tx) => {
          for (const row of page.rows)
            await db.updateRow({
              databaseId: deps.databaseId,
              tableId: table.id,
              rowId: row.$id,
              transactionId: tx,
              data: {
                [field]: "deleted-user",
                ...(table.id === "inbound_endpoints"
                  ? {
                      status: "disabled",
                      version: stableId(row.$id, tx),
                      testToken: "",
                    }
                  : {}),
              },
            });
        });
      }
    }
  }
}
