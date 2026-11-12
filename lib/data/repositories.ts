import { assertCredentialExecution } from "./credential-execution";
import { AppwriteException, Query, type TablesDB } from "node-appwrite";
import { connectionId, type IntegrationRecord } from "../integrations/records";
import { type Provider, type WorkspaceRole } from "../workspaces/types";
import { validId } from "../workspaces/validation";
import { hasGmailScopes } from "../integrations/providers";
import { envelopeKeyId } from "../integrations/crypto";
import { audit, enqueue } from "../automation/store";
import {
  profileFromRow,
  profileToRow,
  parseStoredIntegration,
  parseIntegrationMetadata,
  StoredDataError,
  type ProfileRecord,
} from "./model";
import {
  currentOperation,
  nonce,
  RevisionConflictError,
  rowMissing,
} from "./coordinator";
export type Authorize = (
  workspaceId: string,
  roles?: WorkspaceRole[],
) => Promise<void>;
const roles = (provider: Provider): WorkspaceRole[] =>
  provider === "paypal" ? ["owner"] : ["owner", "admin"];
function metadata(
  row: Record<string, unknown>,
  workspaceId: string,
  provider?: Provider,
) {
  if (
    row.workspaceId !== workspaceId ||
    (provider && row.provider !== provider) ||
    row.schemaVersion !== 1 ||
    !Array.isArray(row.scopes) ||
    row.scopes.some((s) => typeof s !== "string") ||
    !/^[a-f0-9]{32}$/.test(String(row.revision)) ||
    !Array.isArray(row.$permissions) ||
    row.$permissions.length ||
    (row.disconnectedAt != null &&
      !Number.isFinite(Date.parse(String(row.disconnectedAt))))
  )
    throw new StoredDataError();
  return {
    record: parseIntegrationMetadata({
      ...row,
      version: row.connectionVersion,
      scopes: row.scopes.join(row.provider === "slack" ? "," : " "),
      externalId: row.externalId ?? undefined,
      channelId: row.channelId ?? undefined,
      channel: row.channel ?? undefined,
    }),
    revision: String(row.revision),
    disconnected: Boolean(row.disconnectedAt),
  };
}
export class WorkspaceRepository {
  constructor(
    private db: TablesDB,
    private databaseId: string,
    private authorize: Authorize,
    private actorId = "service",
  ) {}
  async get(workspaceId: string) {
    validId(workspaceId);
    await this.authorize(workspaceId);
    try {
      const row = await this.db.getRow({
        databaseId: this.databaseId,
        tableId: "workspaces",
        rowId: workspaceId,
      });
      if (!/^[a-f0-9]{32}$/.test(row.revision) || row.$permissions.length)
        throw new StoredDataError();
      return { profile: profileFromRow(row), revision: row.revision };
    } catch (e) {
      if (rowMissing(e)) return null;
      throw e;
    }
  }
  async create(
    workspaceId: string,
    profile: ProfileRecord,
    initialize?: (db: TablesDB, tx: string) => Promise<unknown>,
  ) {
    validId(workspaceId);
    await currentOperation().commit(async (db, tx) => {
      await this.authorize(workspaceId, ["owner"]);
      await db.createRow({
        databaseId: this.databaseId,
        tableId: "workspaces",
        rowId: workspaceId,
        transactionId: tx,
        data: profileToRow(profile, nonce()),
        permissions: [],
      });
      await audit(
        db,
        tx,
        workspaceId,
        this.actorId,
        "workspace.created",
        workspaceId,
        nonce(),
      );
      await initialize?.(db, tx);
    });
  }
  async update(
    workspaceId: string,
    profile: ProfileRecord,
    expectedRevision: string,
  ) {
    validId(workspaceId);
    await currentOperation().commit(async (db, tx) => {
      await this.authorize(workspaceId, ["owner", "admin"]);
      const params = {
        databaseId: this.databaseId,
        tableId: "workspaces",
        rowId: workspaceId,
        transactionId: tx,
      };
      const prior = await db.getRow(params);
      if (prior.revision !== expectedRevision)
        throw new RevisionConflictError();
      const updated = profileToRow(profile, nonce());
      updated.settingsJson = JSON.stringify({ ...JSON.parse(prior.settingsJson), ...JSON.parse(updated.settingsJson) });
      await db.updateRow({ ...params, data: updated });
      await audit(
        db,
        tx,
        workspaceId,
        this.actorId,
        "workspace.profile_updated",
        workspaceId,
        nonce(),
      );
    });
  }
}
export class IntegrationRepository {
  constructor(
    private db: TablesDB,
    private databaseId: string,
    private authorize: Authorize,
    private actorId = "service",
  ) {}
  async metadata(workspaceId: string, provider: Provider) {
    validId(workspaceId);
    await this.authorize(workspaceId);
    try {
      return metadata(
        await this.db.getRow({
          databaseId: this.databaseId,
          tableId: "integrations",
          rowId: connectionId(workspaceId, provider),
        }),
        workspaceId,
        provider,
      );
    } catch (e) {
      if (rowMissing(e)) return null;
      throw e;
    }
  }
  async save(
    workspaceId: string,
    value: IntegrationRecord,
    expectedRevision: string | null,
  ) {
    assertCredentialExecution();
    validId(workspaceId);
    const record = parseStoredIntegration(value);
    await currentOperation().commit(async (db, tx) => {
      await this.authorize(workspaceId, roles(record.provider));
      const params = {
        databaseId: this.databaseId,
        rowId: connectionId(workspaceId, record.provider),
        transactionId: tx,
      };
      let prior;
      try {
        prior = await db.getRow({ ...params, tableId: "integrations" });
      } catch (e) {
        if (!rowMissing(e)) throw e;
      }
      if (prior) metadata(prior, workspaceId, record.provider);
      if ((prior?.revision ?? null) !== expectedRevision)
        throw new RevisionConflictError();
      const revision = nonce(),
        { credentials, version, scopes, ...fields } = record;
      const data = {
        ...fields,
        externalId: fields.externalId ?? null,
        channelId: fields.channelId ?? null,
        channel: fields.channel ?? null,
        workspaceId,
        schemaVersion: 1,
        revision,
        connectionVersion: version,
        scopes: scopes
          .split(record.provider === "slack" ? "," : " ")
          .filter(Boolean),
        disconnectedAt: null,
      };
      if (prior)
        await db.updateRow({ ...params, tableId: "integrations", data });
      else
        await db.createRow({
          ...params,
          tableId: "integrations",
          data,
          permissions: [],
        });
      await db.upsertRow({
        ...params,
        tableId: "integration_secrets",
        permissions: [],
        data: {
          workspaceId,
          provider: record.provider,
          schemaVersion: 1,
          revision,
          connectionVersion: version,
          credentialEnvelope: "protected",
          protectedEnvelope: credentials,
          keyId: envelopeKeyId(credentials),
        },
      });
      await audit(
        db,
        tx,
        workspaceId,
        record.connectedBy,
        prior ? "integration.updated" : "integration.connected",
        connectionId(workspaceId, record.provider),
        revision,
        { provider: record.provider },
      );
      if (
        record.provider === "gmail" &&
        (!prior || prior.connectionVersion !== record.version)
      )
        await enqueue(
          {
            workspaceId,
            integrationId: connectionId(workspaceId, "gmail"),
            connectionVersion: record.version,
            requestedBy: record.connectedBy,
            kind: "gmail-sync",
            key: "mailbox",
          },
          db,
          tx,
        );
    });
  }
  /** Execution path only. Summaries and connection checks never call this from HTTP. */
  async readForExecution(workspaceId: string, provider: Provider) {
    assertCredentialExecution();
    validId(workspaceId);
    await this.authorize(workspaceId, roles(provider));
    const meta = await this.metadata(workspaceId, provider);
    if (!meta || meta.disconnected) return null;
    const secret = await this.db.getRow({
      databaseId: this.databaseId,
      tableId: "integration_secrets",
      rowId: connectionId(workspaceId, provider),
    });
    if (
      secret.workspaceId !== workspaceId ||
      secret.provider !== provider ||
      secret.schemaVersion !== 1 ||
      secret.$permissions.length ||
      secret.connectionVersion !== meta.record.version ||
      secret.revision !== meta.revision ||
      typeof secret.protectedEnvelope !== "string" ||
      secret.credentialEnvelope !== "protected" ||
      secret.keyId !== envelopeKeyId(secret.protectedEnvelope)
    )
      throw new StoredDataError();
    return {
      record: parseStoredIntegration({
        ...meta.record,
        credentials: secret.protectedEnvelope,
      }),
      revision: meta.revision,
    };
  }
  async summaries(workspaceId: string) {
    validId(workspaceId);
    await this.authorize(workspaceId);
    const page = await this.db.listRows({
      databaseId: this.databaseId,
      tableId: "integrations",
      queries: [Query.equal("workspaceId", workspaceId), Query.limit(100)],
    });
    return page.rows
      .map((r) => metadata(r, workspaceId))
      .filter((r) => !r.disconnected)
      .map(({ record: r }) => ({
        provider: r.provider,
        label: r.label,
        status:
          r.provider === "gmail" && !hasGmailScopes(r.scopes)
            ? ("needs_attention" as const)
            : r.status,
        environment: r.environment,
        checkedAt: r.checkedAt,
        ...(r.channel ? { channel: r.channel } : {}),
      }));
  }
  async disconnect(
    workspaceId: string,
    provider: Provider,
    expectedRevision?: string,
  ) {
    validId(workspaceId);
    await currentOperation().commit(async (db, tx) => {
      await this.authorize(workspaceId, roles(provider));
      const params = {
        databaseId: this.databaseId,
        rowId: connectionId(workspaceId, provider),
        transactionId: tx,
      };
      let row;
      try {
        row = await db.getRow({ ...params, tableId: "integrations" });
      } catch (e) {
        if (!rowMissing(e)) throw e;
      }
      if (expectedRevision && row?.revision !== expectedRevision)
        throw new RevisionConflictError();
      const disconnected = row
        ? metadata(row, workspaceId, provider).disconnected
        : false;
      // Keep the generation fence, but retain no provider account details.
      const hasAccountDetails =
        row &&
        (row.label !== "Disconnected" ||
          row.externalId != null ||
          row.channelId != null ||
          row.channel != null ||
          row.scopes.length > 0);
      if (row && (!disconnected || hasAccountDetails))
        await db.updateRow({
          ...params,
          tableId: "integrations",
          data: {
            label: "Disconnected",
            externalId: null,
            channelId: null,
            channel: null,
            scopes: [],
            disconnectedAt: row.disconnectedAt || new Date().toISOString(),
            status: "needs_attention",
            connectionVersion: disconnected ? row.connectionVersion : nonce(),
            revision: nonce(),
          },
        });
      try {
        await db.deleteRow({ ...params, tableId: "integration_secrets" });
      } catch (e) {
        if (!rowMissing(e)) throw e;
      }
      if (row && !disconnected)
        await audit(
          db,
          tx,
          workspaceId,
          this.actorId,
          "integration.disconnected",
          connectionId(workspaceId, provider),
          nonce(),
          { provider },
        );
    });
  }
}
export const isConflict = (e: unknown) =>
  e instanceof RevisionConflictError ||
  (e instanceof AppwriteException && e.code === 409);
