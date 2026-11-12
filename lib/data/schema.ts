export type Column = {
  key: string;
  type: "varchar" | "mediumtext" | "text" | "boolean" | "integer" | "datetime";
  required: boolean;
  size?: number;
  array?: boolean;
  encrypt?: boolean;
};
export type Index = { key: string; type: "key" | "unique"; columns: string[] };
export type Table = { id: string; columns: Column[]; indexes: Index[] };
const v = (key: string, size = 36, required = true): Column => ({
  key,
  type: "varchar",
  size,
  required,
});
const field = (key: string, type: Column["type"], required = true): Column => ({
  key,
  type,
  required,
});
const common = [field("schemaVersion", "integer"), v("revision", 32)];
export const migrationId = "001_normalized_core";
export const journal: Table = {
  id: "schema_migrations",
  columns: [
    v("checksum", 64),
    v("status", 16),
    v("holder", 32),
    field("leaseUntil", "datetime"),
    v("checkpoint", 128),
  ],
  indexes: [],
};
export const tables: Table[] = [
  {
    id: "workspaces",
    columns: [
      ...common,
      v("businessName", 128),
      v("website", 512),
      v("industry", 128),
      v("country", 2),
      v("currency", 3),
      v("timezone", 64),
      v("approvalThresholdMinor", 32),
      field("currencyExponent", "integer"),
      field("profileSaved", "boolean"),
      field("onboardingComplete", "boolean"),
      field("settingsJson", "text"),
    ],
    indexes: [],
  },
  {
    id: "integrations",
    columns: [
      ...common,
      v("workspaceId"),
      v("provider", 16),
      v("environment", 16),
      v("label", 320),
      v("externalId", 320, false),
      v("channelId", 320, false),
      v("channel", 320, false),
      { ...v("scopes", 512), array: true },
      v("status", 32),
      field("checkedAt", "datetime"),
      v("connectedBy"),
      v("connectionVersion", 32),
      field("disconnectedAt", "datetime", false),
    ],
    indexes: [
      {
        key: "workspace_provider",
        type: "unique",
        columns: ["workspaceId", "provider"],
      },
      {
        key: "workspace_status",
        type: "key",
        columns: ["workspaceId", "status"],
      },
      {
        key: "provider_account",
        type: "key",
        columns: ["provider", "environment", "externalId"],
      },
    ],
  },
  {
    id: "integration_secrets",
    columns: [
      ...common,
      v("workspaceId"),
      v("provider", 16),
      v("connectionVersion", 32),
      field("credentialEnvelope", "mediumtext"),
      v("keyId", 32),
    ],
    indexes: [],
  },
  {
    id: "oauth_states",
    columns: [
      ...common,
      v("workspaceId"),
      v("userId"),
      v("provider", 16),
      v("browserHash", 64),
      v("sessionHash", 64),
      field("verifierEnvelope", "text", false),
      v("keyId", 32),
      field("expiresAt", "datetime"),
      v("status", 16),
      field("claimedAt", "datetime", false),
    ],
    indexes: [{ key: "expires", type: "key", columns: ["expiresAt"] }],
  },
];

type ExistingTable = {
  enabled: boolean;
  rowSecurity: boolean;
  $permissions: string[];
  columns: (Column & { status: string })[];
  indexes: (Index & { status: string })[];
};
export function inspectTable(
  expected: Table,
  actual: ExistingTable,
): { missingColumns: Column[]; missingIndexes: Index[]; pending: boolean } {
  if (!actual.enabled || !actual.rowSecurity || actual.$permissions.length)
    throw new Error(`Unsafe table configuration: ${expected.id}`);
  const missingColumns: Column[] = [],
    missingIndexes: Index[] = [];
  let pending = false;
  for (const col of expected.columns) {
    const found = actual.columns.find((c) => c.key === col.key);
    if (!found) {
      missingColumns.push(col);
      continue;
    }
    if (
      found.status === "failed" ||
      found.type !== col.type ||
      found.required !== col.required ||
      Boolean(found.array) !== Boolean(col.array) ||
      (col.encrypt !== undefined && Boolean(found.encrypt) !== col.encrypt) ||
      (col.size !== undefined && found.size !== col.size)
    )
      throw new Error(`Column drift: ${expected.id}.${col.key}`);
    pending ||= found.status !== "available";
  }
  for (const index of expected.indexes) {
    const found = actual.indexes.find((i) => i.key === index.key);
    if (!found) {
      missingIndexes.push(index);
      continue;
    }
    if (
      found.status === "failed" ||
      found.type !== index.type ||
      JSON.stringify(found.columns) !== JSON.stringify(index.columns)
    )
      throw new Error(`Index drift: ${expected.id}.${index.key}`);
    pending ||= found.status !== "available";
  }
  return { missingColumns, missingIndexes, pending };
}
