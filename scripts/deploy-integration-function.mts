import {
  Client,
  Functions,
  Runtime,
  ProjectKeyScopes,
  Query,
} from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { databaseId } from "../lib/data/client";
import { integrationFunctionId } from "../lib/integrations/function-client";
import { analysisConfiguration } from "../lib/automation/ai-provider";
const args = process.argv.slice(2),
  apply = args.includes("--apply"),
  stageOnly = args.includes("--stage"),
  project = process.env.APPWRITE_PROJECT_ID,
  database = databaseId(),
  functionId = integrationFunctionId();
if (
  args.some(
    a =>
      !["--apply", "--stage", "--dry-run", "--status"].includes(a) &&
      !a.startsWith("--project=") &&
      !a.startsWith("--database="),
  )
)
  throw new Error("Unknown deployment option.");
if (
  [
    apply,
    stageOnly,
    args.includes("--dry-run"),
    args.includes("--status"),
  ].filter(Boolean).length > 1
)
  throw new Error("Choose one deployment operation.");
if (
  (apply || stageOnly) &&
  (!project ||
    !args.includes(`--project=${project}`) ||
    !args.includes(`--database=${database}`))
)
  throw new Error("Staging and applying require explicit matching targets.");
const functions = new Functions(
  new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT!)
    .setProject(project!)
    .setKey(
      process.env.APPWRITE_SCHEMA_API_KEY || process.env.APPWRITE_API_KEY!,
    ),
);
const settings = {
  name: "AssentPay private integration runtime",
  runtime: Runtime.Node22,
  execute: [],
  events: [`tablesdb.${database}.tables.automation_jobs.rows.*.create`],
  interval: 5,
  timeout: 120,
  enabled: true,
  logging: false,
  entrypoint: "index.js",
  commands:
    "npm ci --omit=dev --include=optional --ignore-scripts && node verify-runtime.mjs",
  scopes: [
    ProjectKeyScopes.RowsRead,
    ProjectKeyScopes.RowsWrite,
    ProjectKeyScopes.TeamsRead,
    ProjectKeyScopes.UsersRead,
    ProjectKeyScopes.FilesRead,
    ProjectKeyScopes.FilesWrite,
  ],
};
let stage = "inspect";
let packageDirectory: string | undefined;
function buildPackage(archive: string) {
  const build = spawnSync(
    process.execPath,
    ["scripts/build-integration-function.mjs"],
    { stdio: "inherit" },
  );
  if (build.status !== 0) throw new Error("Function build failed.");
  const tar = spawnSync(
    "tar",
    [
      "-czf",
      archive,
      "-C",
      ".function-build/integration-runtime",
      "index.js",
      "package.json",
      "package-lock.json",
      "verify-runtime.mjs",
    ],
    { stdio: "pipe" },
  );
  if (tar.status !== 0) throw new Error("Function packaging failed.");
}
try {
  if (args.includes("--status")) {
    const fn = await functions.get({ functionId });
    const [deploy, analysisVariables] = await Promise.all([
      fn.deploymentId
        ? functions.getDeployment({ functionId, deploymentId: fn.deploymentId })
        : null,
      functions.listVariables({
        functionId,
        queries: [Query.equal("key", ["OPENAI_API_KEY", "OPENAI_MODEL"])],
      }),
    ]);
    const analysisKeys = new Set(
      analysisVariables.variables.map(({ key }) => key),
    );
    console.log(
      JSON.stringify({
        functionId,
        execute: fn.execute,
        logging: fn.logging,
        scopes: fn.scopes,
        deployment: deploy?.$id,
        status: deploy?.status,
        worker: {
          schedule: fn.schedule || null,
          interval: fn.interval || null,
          eventCount: fn.events.length,
          analysisKeyConfigured: analysisKeys.has("OPENAI_API_KEY"),
          analysisModelConfigured: analysisKeys.has("OPENAI_MODEL"),
        },
        checks: {
          runtimeNode22: fn.runtime === settings.runtime,
          privateExecution: fn.execute.length === 0,
          fileReadScope: fn.scopes.includes(ProjectKeyScopes.FilesRead),
          fileWriteScope: fn.scopes.includes(ProjectKeyScopes.FilesWrite),
          schedule: !fn.schedule && fn.interval === settings.interval,
          automationEvents:
            fn.events.length === settings.events.length &&
            settings.events.every(event => fn.events.includes(event)),
          verifiedLockedBuild: fn.commands === settings.commands,
          entrypoint: fn.entrypoint === settings.entrypoint,
          enabled: fn.enabled === true,
          deploymentReady: deploy?.status === "ready",
        },
      }),
    );
  } else if (!apply && !stageOnly)
    console.log(
      JSON.stringify({
        action: "would-deploy",
        functionId,
        ...settings,
        secretValues: "never printed or bundled",
      }),
    );
  else {
    // Applying always enables the full dispatcher. Refuse to start it with a
    // missing key or model, which would burn through pending analysis retries.
    if (apply) {
      stage = "analysis-configuration";
      analysisConfiguration();
    }
    stage = "bundle-build";
    packageDirectory = await mkdtemp(join(tmpdir(), "assentpay-runtime-"));
    const archive = join(packageDirectory, "code.tar.gz");
    buildPackage(archive);
    stage = "function-configuration";
    if (stageOnly) {
      const fn = await functions.get({ functionId });
      if (
        fn.name !== settings.name ||
        fn.execute.length !== 0 ||
        fn.runtime !== settings.runtime
      )
        throw new Error(
          "Staging requires the existing private Node 22 Function.",
        );
      stage = "deployment-upload";
      const deployment = await functions.createDeployment({
        functionId,
        code: InputFile.fromPath(archive, "code.tar.gz"),
        activate: false,
        entrypoint: settings.entrypoint,
        commands: settings.commands,
      });
      console.log(
        JSON.stringify({
          action: "staged",
          functionId,
          deploymentId: deployment.$id,
          status: deployment.status,
        }),
      );
    } else {
      try {
        const prior = await functions.get({ functionId });
        if (prior.name !== settings.name)
          throw new Error("Function ID belongs to another resource.");
        await functions.update({ functionId, ...settings });
      } catch (e) {
        if (!e || typeof e !== "object" || !("code" in e) || e.code !== 404)
          throw e;
        await functions.create({ functionId, ...settings });
      }
      stage = "variables-list";
      const vars = await functions.listVariables({ functionId });
      for (const key of [
        "NODE_ENV",
        "APP_URL",
        "APPWRITE_DATABASE_ID",
        "INTEGRATION_ENCRYPTION_KEY",
        "INTEGRATION_ENCRYPTION_KEY_ID",
        "INTEGRATION_ENCRYPTION_KEYS",
        "GMAIL_OAUTH_ENABLED",
        "RESEND_API_KEY",
        "RESEND_INBOUND_DOMAIN",
        "RESEND_ATTACHMENT_HOSTS",
        "RESEND_FROM_EMAIL",
        "INBOUND_DAILY_LIMIT",
        "OPENAI_API_KEY",
        "OPENAI_MODEL",
        "AI_DOCUMENT_VISION_ENABLED",
        "GMAIL_CLIENT_ID",
        "GMAIL_CLIENT_SECRET",
        "SLACK_REVIEW_DESTINATION",
        "SLACK_CLIENT_ID",
        "SLACK_CLIENT_SECRET",
        "GMAIL_PUBSUB_TOPIC",
        "PAYPAL_WEBHOOK_IDS_JSON",
        "PAYPAL_SANDBOX_PAYOUTS_ENABLED",
      ]) {
        stage = `variable:${key}`;
        const value =
          key === "NODE_ENV"
            ? "production"
            : key === "APPWRITE_DATABASE_ID"
              ? database
              : process.env[key];
        if (!value) continue;
        const existing = vars.variables.find(v => v.key === key),
          secret = /KEY|SECRET/.test(key);
        if (existing)
          await functions.updateVariable({
            functionId,
            variableId: existing.$id,
            key,
            value,
            secret,
          });
        else
          await functions.createVariable({
            functionId,
            variableId: `v_${createHash("sha256").update(key).digest("hex").slice(0, 30)}`,
            key,
            value,
            secret,
          });
      }
      stage = "deployment-upload";
      const deployment = await functions.createDeployment({
        functionId,
        code: InputFile.fromPath(archive, "code.tar.gz"),
        activate: true,
        entrypoint: settings.entrypoint,
        commands: settings.commands,
      });
      // Keep non-secret deployment identity locally so readiness can be checked
      // without long blocking polling or printing build logs.
      await writeFile(
        "/private/tmp/assentpay-function-deployment.json",
        JSON.stringify({ functionId, deploymentId: deployment.$id }),
        { mode: 0o600 },
      );
      const config = JSON.parse(await readFile("appwrite.config.json", "utf8"));
      config.functions = [
        ...(config.functions || []).filter(
          (f: { $id: string }) => f.$id !== functionId,
        ),
        {
          $id: functionId,
          ...settings,
          path: ".function-build/integration-runtime",
        },
      ];
      await writeFile(
        "appwrite.config.json",
        JSON.stringify(config, null, 2) + "\n",
      );
      console.log(
        JSON.stringify({
          action: "uploaded",
          functionId,
          deploymentId: deployment.$id,
          status: deployment.status,
          execute: [],
        }),
      );
    }
  }
} catch (e) {
  console.error(
    JSON.stringify({
      stage,
      code: e && typeof e === "object" && "code" in e ? e.code : undefined,
      type: e && typeof e === "object" && "type" in e ? e.type : undefined,
    }),
  );
  console.error(
    e instanceof Error && !("response" in e)
      ? e.message
      : "Private Function deployment failed. Check operator access, limits and deployment status; secret values were not printed.",
  );
  process.exitCode = 1;
} finally {
  if (packageDirectory)
    await rm(packageDirectory, { recursive: true, force: true });
}
