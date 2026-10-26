import { Query } from "node-appwrite";
import { randomBytes } from "node:crypto";
import { dataClient, dataDatabase } from "../data/client";
import { currentOperation, withStorageOperation } from "../data/coordinator";
import { workerAuthorization } from "../integrations/health";
import { InputError } from "../workspaces/validation";
import { GmailError } from "./gmail-client";
import { syncGmail, type GuardedCommit } from "./gmail-sync";
import { importDocument } from "./documents";
import {
  audit,
  enqueue,
  notify,
  optionalRow,
  params,
  signal,
  type Job,
} from "./store";
import { deliverFinancialSlack, SlackRateLimitError } from "./financial-slack";
import { maintainFinancialData } from "./maintenance";
import { ingestResend, ResendReceivingError } from "./resend";
import { analyzeMessage } from "./intelligence";
import { executeFinancialAction, reconcilePaypal, deliverWorkflowNotification } from "./workflows";
export class SupersededJob extends Error {}
async function validConnection(job: Job, db = dataDatabase(), tx?: string) {
  if (["resend-ingest", "financial-analyze", "workflow-notify", "financial-slack-notify"].includes(job.kind)) {
    const endpoint = await optionalRow("inbound_endpoints", job.integrationId, db, tx);
    if (endpoint) {
    if (endpoint.workspaceId !== job.workspaceId || endpoint.version !== job.connectionVersion || endpoint.status === "disabled") throw new SupersededJob();
    await workerAuthorization(dataClient(), job.requestedBy)(job.workspaceId, ["owner", "admin"]);
    return;
    }
    if (job.kind === "resend-ingest") throw new SupersededJob();
  }
  const meta = await db.getRow(params("integrations", job.integrationId, tx));
  if (
    meta.workspaceId !== job.workspaceId ||
    meta.connectionVersion !== job.connectionVersion ||
    meta.disconnectedAt
  )
    throw new SupersededJob();
  await workerAuthorization(dataClient(), job.requestedBy)(
    job.workspaceId,
    meta.provider === "paypal" ? ["owner"] : ["owner", "admin"],
  );
}
async function claim(id: string) {
  return currentOperation().commit(async (db, tx) => {
    const row = (await db.getRow(
        params("automation_jobs", id, tx),
      )) as unknown as Job,
      now = Date.now();
    if (
      (!["queued", "retry"].includes(row.status) ||
        Date.parse(row.nextAttemptAt) > now) &&
      !(row.status === "running" && Date.parse(row.leaseUntil) < now)
    )
      return null;
    const data = {
      status: "running",
      attempts: row.attempts + 1,
      leaseToken: randomBytes(16).toString("hex"),
      leaseUntil: new Date(now + 150000).toISOString(),
    };
    await db.updateRow({ ...params("automation_jobs", id, tx), data });
    await signal(db, tx, row.workspaceId, "job.running");
    return { ...row, ...data } as Job;
  });
}
export async function processJob(id: string) {
  const job = await claim(id);
  if (!job) return { status: "busy" };
  const startedAt = job.requestedAt;
  const commit: GuardedCommit = (write) =>
    currentOperation().commit(async (db, tx) => {
      const current = await db.getRow(params("automation_jobs", id, tx));
      if (
        current.status !== "running" ||
        current.leaseToken !== job.leaseToken ||
        Date.parse(current.leaseUntil) <= Date.now()
      )
        throw new SupersededJob();
      await validConnection(job, db, tx);
      return write(db, tx);
    });
  let more = false,
    error: unknown;
  try {
    if (job.attempts > 5) throw new InputError("Attempt limit exceeded.", 400);
    await validConnection(job);
    if (job.kind === "resend-ingest") await ingestResend(job, commit);
    else if (job.kind === "financial-analyze") await analyzeMessage(job, commit);
    else if (job.kind === "paypal-execute") await executeFinancialAction(job, commit);
    else if (job.kind === "paypal-reconcile") await reconcilePaypal(job, commit);
    else if (job.kind === "financial-slack-notify") await deliverFinancialSlack(job, commit);
    else if (job.kind === "workflow-notify") await deliverWorkflowNotification(job, commit);
    else if (job.kind === "gmail-sync") more = await syncGmail(job, commit);
    else if (job.kind === "document-import") await importDocument(job, commit);
    else if (job.kind === "provider-event") {
      const payload = JSON.parse(job.payloadJson),
        receipt = await optionalRow("webhook_events", payload.receiptId);
      if (!receipt || receipt.workspaceId !== job.workspaceId)
        throw new InputError("Event not found.", 404);
      await commit(async (db, tx) => {
        if (receipt.status !== "processed") {
          await db.updateRow({
            ...params("webhook_events", receipt.$id, tx),
            data: { status: "processed" },
          });
          await audit(
            db,
            tx,
            job.workspaceId,
            job.requestedBy,
            `${receipt.provider}.event_received`,
            receipt.$id,
            receipt.$id,
            { eventType: receipt.eventType },
          );
          await notify(
            db,
            tx,
            job.workspaceId,
            receipt.$id,
            `${receipt.provider === "paypal" ? "PayPal" : "Slack"} update received`,
            receipt.eventType,
            "provider",
          );
        }
      });
    } else throw new InputError("Unsupported job kind.", 400);
  } catch (e) {
    error = e;
  }
  return currentOperation().commit(async (db, tx) => {
    const current = await db.getRow(params("automation_jobs", id, tx));
    if (current.leaseToken !== job.leaseToken || current.status !== "running")
      return { status: "superseded" };
    const cancelled =
      error instanceof SupersededJob ||
      (error instanceof InputError && error.status === 403);
    const permanent =
      (error instanceof InputError &&
        [400, 401, 403, 404, 413].includes(error.status)) ||
      (error instanceof ResendReceivingError && [400, 401, 403, 404, 413].includes(error.status)) ||
      (error instanceof GmailError && [400, 401, 403].includes(error.status));
    const failed = !!error && !cancelled && (permanent || job.attempts >= 5);
    const status = cancelled
      ? "cancelled"
      : failed
        ? "failed"
        : error
          ? "retry"
          : more || current.requestedAt !== startedAt
            ? "queued"
            : "completed";
    const delay = error
      ? Math.max(
          (error instanceof GmailError || error instanceof SlackRateLimitError) ? error.retryAfter * 1000 : 0,
          Math.min(3600000, 15000 * 2 ** Math.min(job.attempts, 8)) +
            Math.floor(Math.random() * 3000),
        )
      : 0;
    const errorCode = error
      ? cancelled
        ? "ACCESS_OR_CONNECTION_CHANGED"
        : error instanceof ResendReceivingError
          ? error.code
          : error instanceof InputError && error.code
            ? error.code
        : error instanceof GmailError
          ? `GMAIL_${error.status}`
          : permanent
            ? "INVALID_REQUEST_OR_CREDENTIALS"
            : "TEMPORARY_FAILURE"
      : "";
    await db.updateRow({
      ...params("automation_jobs", id, tx),
      data: {
        status,
        errorCode,
        attempts: !error ? 0 : job.attempts,
        nextAttemptAt: new Date(Date.now() + delay).toISOString(),
        leaseToken: "",
        leaseUntil: new Date(0).toISOString(),
      },
    });
    if (job.kind === "resend-ingest") {
      const endpoint = await optionalRow("inbound_endpoints", job.integrationId, db, tx);
      if (endpoint && endpoint.version === job.connectionVersion && endpoint.status !== "disabled")
        await db.updateRow({ ...params("inbound_endpoints", endpoint.$id, tx), data: { errorCode } });
    }
    if (
      status === "completed" ||
      status === "failed" ||
      status === "cancelled"
    ) {
      await audit(
        db,
        tx,
        job.workspaceId,
        job.requestedBy,
        `job.${status}`,
        id,
        `${job.leaseToken}`,
        { kind: job.kind, errorCode },
      );
      if (status === "failed")
        await notify(
          db,
          tx,
          job.workspaceId,
          `${id}:${job.leaseToken}`,
          "Automation needs attention",
          "A background task exhausted its retries. Review the connection, then retry the task.",
        );
    } else await signal(db, tx, job.workspaceId, `job.${status}`);
    return { status };
  });
}
export async function scheduleIntegrations() {
  if (process.env.GMAIL_OAUTH_ENABLED !== "true") return;
  let cursor: string | undefined;
  // Cursor pagination ensures larger organizations do not starve behind the first page.
  do {
    const page = await dataDatabase().listRows({
      ...params("integrations"),
      queries: [
        Query.equal("provider", "gmail"),
        Query.isNull("disconnectedAt"),
        Query.limit(100),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
    });
    for (const integration of page.rows) {
      const id = (await import("./store")).stableId(
          integration.workspaceId,
          integration.connectionVersion,
          "gmail-sync",
          "mailbox",
        ),
        job = await optionalRow("automation_jobs", id);
      if (
        !job ||
        (job.status === "completed" &&
          Date.parse(job.$updatedAt) < Date.now() - 5 * 60000)
      )
        await enqueue({
          workspaceId: integration.workspaceId,
          integrationId: integration.$id,
          connectionVersion: integration.connectionVersion,
          requestedBy: integration.connectedBy,
          kind: "gmail-sync",
          key: "mailbox",
        });
    }
    cursor = page.rows.length === 100 ? page.rows.at(-1)?.$id : undefined;
  } while (cursor);
}
export function dispatchKinds(options: { inboxOnly?: boolean; analysisOnly?: boolean; triageOnly?: boolean }): Job["kind"][] | undefined {
  if ([options.inboxOnly, options.analysisOnly, options.triageOnly].filter(Boolean).length > 1) throw new InputError("Choose one worker mode.");
  return options.inboxOnly ? ["resend-ingest"] : options.analysisOnly ? ["resend-ingest", "financial-analyze"] : options.triageOnly ? ["resend-ingest", "financial-analyze", "financial-slack-notify"] : undefined;
}
export async function dispatchAutomation(options: { inboxOnly?: boolean; analysisOnly?: boolean; triageOnly?: boolean } = {}) {
  const kinds = dispatchKinds(options);
  return withStorageOperation("worker", async () => {
    if (!kinds) {
      await maintainFinancialData();
      await scheduleIntegrations();
    }
    const now = new Date().toISOString(),
      [due, expired] = await Promise.all([
        dataDatabase().listRows({
          ...params("automation_jobs"),
          queries: [
            ...(kinds ? [Query.equal("kind", kinds)] : []),
            Query.equal("status", ["queued", "retry"]),
            Query.lessThanEqual("nextAttemptAt", now),
            Query.orderAsc("nextAttemptAt"),
            Query.limit(3),
          ],
        }),
        dataDatabase().listRows({
          ...params("automation_jobs"),
          queries: [
            ...(kinds ? [Query.equal("kind", kinds)] : []),
            Query.equal("status", "running"),
            Query.lessThanEqual("leaseUntil", now),
            Query.limit(3),
          ],
        }),
      ]);
    let processed = 0;
    const start = Date.now();
    for (const job of [...expired.rows, ...due.rows].slice(0, 3)) {
      if (Date.now() - start > 65000) break;
      await processJob(job.$id);
      processed++;
    }
    return { status: "dispatched", processed };
  });
}
