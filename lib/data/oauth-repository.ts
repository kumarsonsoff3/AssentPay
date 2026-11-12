import type { TablesDB } from "node-appwrite";
import {
  protectVerifier,
  resolveVerifier,
} from "../integrations/oauth-verifier";
import { envelopeKeyId } from "../integrations/crypto";
import { validId } from "../workspaces/validation";
import { StoredDataError } from "./model";
import { currentOperation, nonce } from "./coordinator";
import type { Authorize } from "./repositories";
import { assertCredentialExecution } from "./credential-execution";
export type OAuthRequest = {
  workspaceId: string;
  userId: string;
  provider: "gmail" | "slack";
  browserHash: string;
  sessionHash: string;
  verifier: string;
  expiresAt: number;
};
export type OAuthBinding = Pick<
  OAuthRequest,
  "userId" | "provider" | "browserHash" | "sessionHash"
>;
export function validateOAuth(state: OAuthRequest, userId: string) {
  validId(state.workspaceId);
  validId(state.userId);
  if (
    state.userId !== userId ||
    !["gmail", "slack"].includes(state.provider) ||
    !/^[a-f0-9]{64}$/.test(state.browserHash) ||
    !/^[a-f0-9]{64}$/.test(state.sessionHash) ||
    !/^[A-Za-z0-9_-]{64}$/.test(state.verifier) ||
    !Number.isFinite(state.expiresAt) ||
    state.expiresAt <= Date.now() ||
    state.expiresAt > Date.now() + 600000
  )
    throw new StoredDataError();
}
export class OAuthStateRepository {
  constructor(
    private db: TablesDB,
    private databaseId: string,
    private currentUserId: string,
    private authorize: Authorize,
  ) {}
  async create(id: string, state: OAuthRequest) {
    assertCredentialExecution();
    validId(id);
    validateOAuth(state, this.currentUserId);
    const envelope = protectVerifier(
      state.verifier,
      id,
      state.workspaceId,
      state.provider,
    );
    await currentOperation().commit(async (db, tx) => {
      await this.authorize(state.workspaceId, ["owner", "admin"]);
      await db.createRow({
        databaseId: this.databaseId,
        tableId: "oauth_states",
        rowId: id,
        transactionId: tx,
        permissions: [],
        data: {
          workspaceId: state.workspaceId,
          userId: state.userId,
          provider: state.provider,
          browserHash: state.browserHash,
          sessionHash: state.sessionHash,
          verifierEnvelope: null,
          protectedVerifier: envelope,
          keyId: envelopeKeyId(envelope),
          expiresAt: new Date(state.expiresAt).toISOString(),
          status: "pending",
          revision: nonce(),
          schemaVersion: 1,
        },
      });
    });
  }
  async claim(id: string, expected: OAuthBinding): Promise<OAuthRequest> {
    assertCredentialExecution();
    validId(id);
    if (expected.userId !== this.currentUserId) throw new StoredDataError();
    return currentOperation().commit(async (db, tx) => {
      const params = {
        databaseId: this.databaseId,
        tableId: "oauth_states",
        rowId: id,
        transactionId: tx,
      };
      const row = await db.getRow(params);
      if (
        row.schemaVersion !== 1 ||
        row.status !== "pending" ||
        row.$permissions.length ||
        row.userId !== expected.userId ||
        row.provider !== expected.provider ||
        row.browserHash !== expected.browserHash ||
        row.sessionHash !== expected.sessionHash ||
        !Number.isFinite(Date.parse(row.expiresAt)) ||
        Date.parse(row.expiresAt) <= Date.now() ||
        typeof row.protectedVerifier !== "string" ||
        row.keyId !== envelopeKeyId(row.protectedVerifier)
      )
        throw new StoredDataError();
      validId(row.workspaceId);
      await this.authorize(row.workspaceId, ["owner", "admin"]);
      const verifier = resolveVerifier(
        row.protectedVerifier,
        id,
        row.workspaceId,
        expected.provider,
      );
      await db.updateRow({
        ...params,
        data: {
          status: "claimed",
          claimedAt: new Date().toISOString(),
          verifierEnvelope: null,
          protectedVerifier: null,
          revision: nonce(),
        },
      });
      return {
        workspaceId: row.workspaceId,
        userId: expected.userId,
        provider: expected.provider,
        verifier,
        browserHash: expected.browserHash,
        sessionHash: expected.sessionHash,
        expiresAt: Date.parse(row.expiresAt),
      };
    });
  }
}
