import type { Column, Table } from "../data/schema";
const v = (key: string, size = 36): Column => ({
  key,
  type: "varchar",
  size,
  required: true,
});
const date = (key: string): Column => ({
  key,
  type: "datetime",
  required: true,
});
const snapshot: Column = {
  key: "snapshotJson",
  type: "mediumtext",
  encrypt: true,
  required: true,
};
const common = [v("workspaceId"), v("workflowId")];
const index = {
  key: "workflow_unique",
  type: "unique" as const,
  columns: ["workspaceId", "workflowId"],
};
// Additive manifest registered in the migration plan; operator must review/apply explicitly.
export const paypalSendMigrationId = "007_paypal_invoice_send";
export const paypalSendTables: Table[] = [
  {
    id: "paypal_send_reviews",
    columns: [
      ...common,
      v("connectionVersion", 32),
      snapshot,
      v("snapshotHash", 64),
      date("expiresAt"),
    ],
    indexes: [index],
  },
  {
    id: "paypal_send_approvals",
    columns: [
      ...common,
      v("actorId"),
      v("connectionVersion", 32),
      snapshot,
      v("snapshotHash", 64),
      v("status", 32),
      date("attemptedAt"),
    ],
    indexes: [index],
  },
  {
    id: "paypal_invoice_views",
    columns: [
      ...common,
      v("providerId", 128),
      v("paymentLink", 2048),
      date("verifiedAt"),
    ],
    indexes: [index],
  },
];
