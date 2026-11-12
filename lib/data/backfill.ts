import { createHash } from "node:crypto";
import { envelopeKeyId } from "../integrations/crypto";
import { recordId } from "../workspaces/ids";
import { connectionId } from "../integrations/records";
import {
  parseStoredProfile,
  parseStoredIntegration,
  profileToRow,
  StoredDataError,
} from "./model";
export type LegacyRow = {
  $id: string;
  $updatedAt: string;
  $permissions: string[];
  kind: string;
  workspaceId: string;
  payload: string;
  version?: string;
};
export type BackfillTarget = { tableId: string; rowId: string; data: object };
export function mapLegacyRow(
  row: LegacyRow,
  teamIds: Set<string>,
  protectedStorage = false,
): { digest: string; targets: BackfillTarget[] } {
  if (!teamIds.has(row.workspaceId) || row.$permissions.length)
    throw new StoredDataError();
  const digest = createHash("sha256")
    .update(
      JSON.stringify([
        row.$id,
        row.kind,
        row.workspaceId,
        row.payload,
        row.version ?? "",
      ]),
    )
    .digest("hex");
  if (row.kind === "oauth_state") return { digest, targets: [] }; // Never duplicate a claimable secret.
  const value = JSON.parse(row.payload);
  if (row.kind === "workspace") {
    if (row.$id !== recordId("w", row.workspaceId)) throw new StoredDataError();
    return {
      digest,
      targets: [
        {
          tableId: "workspaces",
          rowId: row.workspaceId,
          data: profileToRow(parseStoredProfile(value), digest.slice(0, 32)),
        },
      ],
    };
  }
  if (row.kind !== "integration") throw new StoredDataError();
  const p = parseStoredIntegration(value);
  if (
    row.$id !== connectionId(row.workspaceId, p.provider) ||
    row.version !== p.version
  )
    throw new StoredDataError();
  const { credentials, version, scopes, ...metadata } = p;
  return {
    digest,
    targets: [
      {
        tableId: "integrations",
        rowId: row.$id,
        data: {
          ...metadata,
          externalId: metadata.externalId ?? null,
          channelId: metadata.channelId ?? null,
          channel: metadata.channel ?? null,
          schemaVersion: 1,
          workspaceId: row.workspaceId,
          connectionVersion: version,
          revision: digest.slice(0, 32),
          scopes: scopes
            .split(p.provider === "slack" ? "," : " ")
            .filter(Boolean),
          disconnectedAt: null,
        },
      },
      {
        tableId: "integration_secrets",
        rowId: row.$id,
        data: {
          schemaVersion: 1,
          workspaceId: row.workspaceId,
          provider: p.provider,
          connectionVersion: version,
          revision: digest.slice(0, 32),
          credentialEnvelope: protectedStorage ? "protected" : credentials,
          ...(protectedStorage ? { protectedEnvelope: credentials } : {}),
          keyId: envelopeKeyId(credentials),
        },
      },
    ],
  };
}
export function matchesTarget(
  actual: Record<string, unknown>,
  expected: object,
) {
  const datetimeColumns = new Set([
    "checkedAt",
    "disconnectedAt",
    "expiresAt",
    "claimedAt",
  ]);
  return (
    Array.isArray(actual.$permissions) &&
    !actual.$permissions.length &&
    Object.entries(expected).every(([key, value]) => {
      // Appwrite normalizes ISO Z strings to +00:00 on datetime columns.
      if (
        datetimeColumns.has(key) &&
        typeof value === "string" &&
        typeof actual[key] === "string"
      )
        return (
          Number.isFinite(Date.parse(value)) &&
          Date.parse(actual[key] as string) === Date.parse(value)
        );
      return (
        JSON.stringify(actual[key] ?? null) === JSON.stringify(value ?? null)
      );
    })
  );
}
