import { tables, type Table } from "./schema";
export const secretMigrationId = "003_encrypted_secrets";
export const secretTables: Table[] = [
  {
    ...tables.find((t) => t.id === "integration_secrets")!,
    columns: [
      ...tables.find((t) => t.id === "integration_secrets")!.columns,
      {
        key: "protectedEnvelope",
        type: "mediumtext",
        required: false,
        encrypt: true,
      },
    ],
  },
  {
    ...tables.find((t) => t.id === "oauth_states")!,
    columns: [
      ...tables.find((t) => t.id === "oauth_states")!.columns,
      {
        key: "protectedVerifier",
        type: "text",
        required: false,
        encrypt: true,
      },
    ],
  },
];
