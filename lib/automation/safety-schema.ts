import type { Table } from "../data/schema";
export const safetyMigrationId = "006_financial_safety";
// Separate additive manifest; never change deployed migration checksums.
export const safetyTables: Table[] = [
  {
    id: "financial_claims",
    columns: [
      { key: "workspaceId", type: "varchar", size: 36, required: true },
      { key: "workflowId", type: "varchar", size: 36, required: true },
      { key: "fingerprint", type: "varchar", size: 64, required: true },
    ],
    indexes: [
      {
        key: "workspace_fingerprint",
        type: "unique",
        columns: ["workspaceId", "fingerprint"],
      },
    ],
  },
  {
    id: "approval_bindings",
    columns: [
      { key: "workspaceId", type: "varchar", size: 36, required: true },
      { key: "requestHash", type: "varchar", size: 64, required: true },
    ],
    indexes: [],
  },
];
