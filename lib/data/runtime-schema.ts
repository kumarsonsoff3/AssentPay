import { journal, type Table } from "./schema";
// Separate immutable migration: do not change 001's manifest or checksum.
export const runtimeMigrationId = "002_storage_runtime";
export const runtimeJournal: Table = {
  ...journal,
  indexes: [{ key: "runtime_status", type: "key", columns: ["status"] }],
};
