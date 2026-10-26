import { Teams, Users, Query, type Client } from "node-appwrite";
import { dataClient, dataDatabase, databaseId } from "../data/client";
import { RuntimeStore } from "../data/runtime";
import {
  storageState,
  withStorageOperation,
  StorageMaintenanceError,
} from "../data/coordinator";
import { isConflict } from "../data/repositories";
import { isProvider, type WorkspaceRole } from "../workspaces/types";
import { validId, InputError } from "../workspaces/validation";
import { assertWorkspaceMembership } from "../workspaces/access";
import { openCredentials, sealCredentials } from "./credentials";
import {
  gmailProfile,
  refreshGmail,
  slackHealth,
  refreshSlack,
  hasGmailScopes,
  paypalVerify,
} from "./providers";
import type { IntegrationRecord } from "./records";
export type ConnectionCheck = {
  workspaceId: string;
  provider: string;
  version: string;
  requestedBy: string;
  storageEpoch?: string;
};
export function workerAuthorization(client: Client, requestedBy: string) {
  return async (workspaceId: string, roles?: WorkspaceRole[]) => {
    validId(requestedBy);
    validId(workspaceId);
    const user = await new Users(client).get({ userId: requestedBy });
    if (!user.status || !user.emailVerification)
      throw new InputError("Execution access removed.", 403);
    const result = await new Teams(client).listMemberships({
      teamId: workspaceId,
      queries: [
        Query.equal("userId", requestedBy),
        Query.equal("confirm", true),
        Query.limit(1),
      ],
    });
    assertWorkspaceMembership(result.memberships[0], workspaceId, requestedBy, roles);
  };
}
export async function runConnectionCheck(payload: ConnectionCheck) {
  validId(payload.workspaceId);
  validId(payload.requestedBy);
  if (!isProvider(payload.provider) || !/^[a-f0-9]{32}$/.test(payload.version))
    throw new Error("Invalid connection check");
  const provider = payload.provider,
    state = await storageState();
  if (!payload.storageEpoch || payload.storageEpoch !== state.epoch)
    return { status: "superseded" };
  if (state.mode === "frozen" || state.mode === "draining")
    return { status: "storage_paused" };
  try {
    return await withStorageOperation("worker", async (op) => {
      if (op.state.epoch !== payload.storageEpoch)
        return { status: "superseded" };
      const authorize = workerAuthorization(dataClient(), payload.requestedBy);
      const store = new RuntimeStore(
        dataDatabase(),
        databaseId(),
        payload.requestedBy,
        authorize,
      );
      await authorize(
        payload.workspaceId,
        provider === "paypal" ? ["owner"] : ["owner", "admin"],
      );
      const meta = await store.integration(payload.workspaceId, provider);
      if (!meta || meta.disconnected || meta.record.version !== payload.version)
        return { status: "superseded" };
      const found = await store.execution(payload.workspaceId, provider);
      if (!found || found.record.version !== payload.version)
        return { status: "superseded" };
      let credentials = openCredentials(
        payload.workspaceId,
        provider,
        found.record.credentials,
      );
      await authorize(
        payload.workspaceId,
        provider === "paypal" ? ["owner"] : ["owner", "admin"],
      );
      await op.check();
      let status: IntegrationRecord["status"] = "connected";
      try {
        if (provider === "gmail") {
          if (!hasGmailScopes(found.record.scopes))
            throw new Error("Reconnect required");
          if (
            !credentials.expiresAt ||
            credentials.expiresAt < Date.now() + 60000
          )
            credentials = await refreshGmail(credentials);
          await gmailProfile(credentials.accessToken!);
        } else if (provider === "slack") {
          // Retain a rotated refresh token even if the subsequent health check fails.
          credentials = await refreshSlack(credentials);
          await slackHealth(credentials);
        } else
          await paypalVerify(credentials.clientId!, credentials.clientSecret!);
      } catch {
        status = "needs_attention";
      }
      await store.saveIntegration(
        payload.workspaceId,
        {
          ...found.record,
          status,
          checkedAt: new Date().toISOString(),
          credentials: sealCredentials(
            payload.workspaceId,
            provider,
            credentials,
          ),
        },
        found.revision,
      );
      return { status };
    });
  } catch (e) {
    if (isConflict(e)) return { status: "superseded" };
    if (e instanceof StorageMaintenanceError)
      return { status: "storage_paused" };
    if (e instanceof InputError && e.status === 403)
      return { status: "access_removed" };
    throw new Error("Connection check could not complete safely.");
  }
}
