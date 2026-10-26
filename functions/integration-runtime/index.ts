import { Client } from "node-appwrite";
import { createHash, randomBytes } from "node:crypto";
import {
  withDataClient,
  dataDatabase,
  databaseId,
} from "../../lib/data/client";
import { withCredentialExecution } from "../../lib/data/credential-execution";
import {
  withStorageOperation,
  storageState,
  StorageMaintenanceError,
  RevisionConflictError,
  STORAGE_PROTOCOL,
} from "../../lib/data/coordinator";
import { RuntimeStore } from "../../lib/data/runtime";
import {
  workerAuthorization,
  runConnectionCheck,
  type ConnectionCheck,
} from "../../lib/integrations/health";
import {
  gmailExchange,
  slackExchange,
  paypalVerify,
} from "../../lib/integrations/providers";
import { sealCredentials } from "../../lib/integrations/credentials";
import { assertEncryption } from "../../lib/integrations/crypto";
import { InputError, validId, text } from "../../lib/workspaces/validation";
import { object } from "../../lib/data/model";
import { secretMigrationId } from "../../lib/data/secret-schema";
import { isConflict } from "../../lib/data/repositories";
import { dispatchAutomation } from "../../lib/automation/runner";
import { acceptPaypalEvent } from "../../lib/automation/paypal";
type Context = {
  req: {
    headers: Record<string, string>;
    bodyText?: string;
    bodyJson?: unknown;
    method: string;
  };
  res: { json: (body: unknown, status?: number) => unknown };
};
export default async function handler({ req, res }: Context) {
  try {
    // Appwrite supplies this ephemeral scoped key; it is never accepted in the
    // JSON body, logged, persisted, or returned. Execute permissions are empty.
    const key = req.headers["x-appwrite-key"],
      endpoint =
        process.env.APPWRITE_FUNCTION_API_ENDPOINT ||
        process.env.APPWRITE_ENDPOINT;
    const project =
      process.env.APPWRITE_FUNCTION_PROJECT_ID ||
      process.env.APPWRITE_PROJECT_ID;
    if (!key || !endpoint || !project)
      return res.json({ error: "Execution unavailable." }, 403);
    const client = new Client()
      .setEndpoint(endpoint)
      .setProject(project)
      .setKey(key);
    if (["schedule", "event"].includes(req.headers["x-appwrite-trigger"]))
      return await withDataClient(client, () =>
        withCredentialExecution(async () => {
          assertEncryption();
          if(req.headers["x-appwrite-trigger"]==="event"&&req.headers["x-appwrite-event"]?.includes(".automation_jobs.")) {
            const event=object(req.bodyJson??JSON.parse(req.bodyText||"{}"));
            if(event.status!=="queued")return res.json({status:"ignored"});
          }
          return res.json(await dispatchAutomation());
        }),
      );
    if (req.method !== "POST")
      return res.json({ error: "Execution unavailable." }, 403);
    const raw = req.bodyText ?? JSON.stringify(req.bodyJson);
    if (!raw || Buffer.byteLength(raw) > 65536)
      return res.json({ error: "Invalid operation." }, 400);
    const input = object(req.bodyJson ?? JSON.parse(raw));
    return await withDataClient(client, () =>
      withCredentialExecution(async () => {
        assertEncryption();
        if (input.action === "automation-dispatch")
          return res.json(await dispatchAutomation());
        if (input.action === "paypal-webhook")
          return res.json(await acceptPaypalEvent(input));
        if (input.action === "status") {
          const schema = await dataDatabase().getRow({
            databaseId: databaseId(),
            tableId: "schema_migrations",
            rowId: secretMigrationId,
          });
          if (schema.status !== "applied") throw new Error();
          const state = await storageState();
          return res.json({
            protocol: STORAGE_PROTOCOL,
            mode: state.mode,
            storage: state.storage,
            credentialRuntime: "appwrite-function",
          });
        }
        const userId = validId(text(input, "requestedBy", 36));
        const authorize = workerAuthorization(client, userId),
          store = new RuntimeStore(
            dataDatabase(),
            databaseId(),
            userId,
            authorize,
          );
        if (input.action === "check")
          return res.json(
            await runConnectionCheck({
              ...input,
              requestedBy: userId,
            } as ConnectionCheck),
          );
        if (input.action === "oauth-begin") {
          if (input.provider === "gmail" && process.env.GMAIL_OAUTH_ENABLED !== "true") throw new InputError("Gmail OAuth is disabled. Use forwarding.", 403);
          const workspaceId = validId(text(input, "workspaceId", 36)),
            id = validId(text(input, "stateId", 36));
          const provider = input.provider;
          if (provider !== "gmail" && provider !== "slack")
            throw new InputError("Invalid provider.");
          await authorize(workspaceId, ["owner", "admin"]);
          return withStorageOperation("mutation", async () => {
            const verifier = randomBytes(48).toString("base64url");
            await store.createOAuth(id, {
              workspaceId,
              userId,
              provider,
              verifier,
              expiresAt: Date.now() + 600000,
              browserHash: text(input, "browserHash", 64),
              sessionHash: text(input, "sessionHash", 64),
            });
            return res.json({
              codeChallenge: createHash("sha256")
                .update(verifier)
                .digest("base64url"),
            });
          });
        }
        if (input.action === "oauth-complete") {
          const provider = input.provider;
          if (provider !== "gmail" && provider !== "slack")
            throw new InputError("Invalid provider.");
          return withStorageOperation("oauth_callback", async () => {
            const record = await store.claimOAuth(
              validId(text(input, "stateId", 36)),
              {
                userId,
                provider,
                browserHash: text(input, "browserHash", 64),
                sessionHash: text(input, "sessionHash", 64),
              },
            );
            if (input.cancelled === true)
              return res.json({
                workspaceId: record.workspaceId,
                result: "cancelled",
              });
            const code = text(input, "code", 4096);
            if (!code) throw new InputError("Invalid connection request.");
            const previous = await store.integration(
              record.workspaceId,
              provider,
            );
            const configured = process.env.APP_URL;
            if (!configured) throw new Error();
            const redirect = new URL(
              `/api/integrations/${provider}/callback`,
              configured,
            ).toString();
            const value =
              provider === "gmail"
                ? await gmailExchange(code, redirect, record.verifier)
                : await slackExchange(code, redirect);
            await authorize(record.workspaceId, ["owner", "admin"]);
            await store.saveIntegration(
              record.workspaceId,
              {
                provider,
                label: value.label,
                status: "connected",
                environment: "production",
                checkedAt: new Date().toISOString(),
                scopes: value.scopes,
                externalId: value.externalId,
                channel: "channel" in value ? value.channel : undefined,
                channelId: "channelId" in value ? value.channelId : undefined,
                credentials: sealCredentials(
                  record.workspaceId,
                  provider,
                  value.credentials,
                ),
                connectedBy: userId,
                version: randomBytes(16).toString("hex"),
              },
              previous?.revision ?? null,
            );
            return res.json({
              workspaceId: record.workspaceId,
              result: "success",
            });
          });
        }
        if (input.action === "paypal-connect") {
          const workspaceId = validId(text(input, "workspaceId", 36));
          await authorize(workspaceId, ["owner"]);
          const clientId = text(input, "clientId", 1024),
            clientSecret = text(input, "clientSecret", 1024),
            label = text(input, "merchantLabel", 128);
          if (
            !clientId ||
            clientId.includes(":") ||
            /\s/.test(clientId) ||
            !clientSecret ||
            /\s/.test(clientSecret)
          )
            throw new InputError("Enter valid PayPal sandbox credentials.");
          return withStorageOperation("mutation", async () => {
            const previous = await store.integration(workspaceId, "paypal"),
              app = await paypalVerify(clientId, clientSecret);
            await store.saveIntegration(
              workspaceId,
              {
                provider: "paypal",
                label,
                status: "connected",
                environment: "sandbox",
                checkedAt: new Date().toISOString(),
                externalId: app.app_id,
                scopes: "sandbox:app",
                credentials: sealCredentials(workspaceId, "paypal", {
                  clientId,
                  clientSecret,
                }),
                connectedBy: userId,
                version: randomBytes(16).toString("hex"),
              },
              previous?.revision ?? null,
            );
            return res.json({ status: "connected" });
          });
        }
        throw new InputError("Unknown operation.", 400);
      }),
    );
  } catch (e) {
    if (e instanceof StorageMaintenanceError)
      return res.json({ error: e.message, code: e.code }, 503);
    if (e instanceof RevisionConflictError || isConflict(e))
      return res.json(
        {
          error: "Connection changed; retry from the workspace.",
          code: "REVISION_CONFLICT",
        },
        409,
      );
    if (e instanceof InputError)
      return res.json({ error: e.message }, e.status);
    // Provider bodies, SDK errors and credentials never enter execution logs/results.
    return res.json(
      { error: "The integration operation could not complete safely." },
      503,
    );
  }
}
