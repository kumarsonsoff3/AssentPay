import type { Table, Column } from "../data/schema";
const v = (key: string, size = 64, encrypt = false): Column => ({
  key,
  type: "varchar",
  size,
  required: true,
  ...(encrypt ? { encrypt: true } : {}),
});
const shared = [
  v("workspaceId", 36),
  v("ownerId", 36),
  v("teamId", 64),
  v("slackUserId", 64),
  v("connectionVersion", 32),
  v("identityVersion", 64),
  v("status", 16),
];
// Additive immutable migration; review/apply requires explicit operator consent.
// Private tables and receipt must be verified before direct Slack decisions.
export const slackApprovalMigrationId = "008_slack_approvals";
export const slackApprovalTables: Table[] = [
  {
    id: "slack_identities",
    columns: [...shared, v("fence", 64)],
    indexes: [
      {
        key: "workspace_owner",
        type: "unique",
        columns: ["workspaceId", "ownerId"],
      },
      { key: "owner", type: "key", columns: ["ownerId"] },
      {
        key: "workspace_connection",
        type: "key",
        columns: ["workspaceId", "connectionVersion"],
      },
    ],
  },
  {
    id: "slack_action_tokens",
    columns: [
      ...shared,
      v("merchantVersion", 32),
      v("kind", 16),
      v("workflowId", 36),
      v("proposalHash", 64),
      v("recipientEmail", 254, true),
      v("tokenHash", 64),
      { key: "expiresAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "token_hash", type: "unique", columns: ["tokenHash"] },
      { key: "expiry", type: "key", columns: ["expiresAt"] },
      { key: "owner", type: "key", columns: ["ownerId"] },
      {
        key: "workspace_connection",
        type: "key",
        columns: ["workspaceId", "connectionVersion"],
      },
    ],
  },
];
