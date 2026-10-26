import { randomBytes } from "node:crypto";
import { Query, type TablesDB } from "node-appwrite";
import { dataDatabase } from "../data/client";
import { currentOperation } from "../data/coordinator";
import { InputError } from "../workspaces/validation";
import { audit, optionalRow, params, retryJob, stableId } from "./store";
import { inboxDeliveryStatus } from "./inbox-status";
import { isForwardingProvider } from "../email-forwarding";

export function inboundDomain() {
  const domain = process.env.RESEND_INBOUND_DOMAIN?.trim().toLowerCase();
  if (!domain || !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(domain))
    throw new InputError("Workspace email receiving needs a verified inbound domain.", 503);
  return domain;
}
export const inboxId = (workspaceId: string) => stableId(workspaceId, "inbox", "primary");
const epoch = new Date(0).toISOString();
export async function provisionInbox(workspaceId: string, actorId: string, db?: TablesDB, tx?: string): Promise<string> {
  if (!db || !tx) return currentOperation().commit((d, t) => provisionInbox(workspaceId, actorId, d, t));
  const id = inboxId(workspaceId);
  if (await optionalRow("inbound_endpoints", id, db, tx)) return id;
  await db.createRow({ ...params("inbound_endpoints", id, tx), permissions: [], data: {
    workspaceId, slot: "primary", address: `w_${randomBytes(18).toString("hex")}@${inboundDomain()}`,
    version: randomBytes(16).toString("hex"), createdBy: actorId, status: "not_configured", testToken: "",
    testStartedAt: epoch, lastReceivedAt: epoch, errorCode: "",
  } });
  await audit(db, tx, workspaceId, actorId, "inbox.provisioned", id, randomBytes(16).toString("hex"));
  return id;
}
export async function inboxSummary(workspaceId: string) {
  const endpoint = await optionalRow("inbound_endpoints", inboxId(workspaceId));
  if (!endpoint) return null;
  const workspace = await optionalRow("workspaces", workspaceId);
  const settings = workspace ? JSON.parse(workspace.settingsJson) : {};
  const sourceEmail = typeof settings.forwardingSourceEmail === "string" ? settings.forwardingSourceEmail : "";
  const page = await dataDatabase().listRows({ ...params("forwarding_verifications"), queries: [
    Query.equal("workspaceId", workspaceId), Query.equal("version", endpoint.version),
    Query.greaterThan("expiresAt", new Date().toISOString()), Query.orderDesc("$createdAt"), Query.limit(1),
  ] });
  const pending = await dataDatabase().listRows({ ...params("automation_jobs"), queries: [
    Query.equal("workspaceId", workspaceId), Query.equal("integrationId", endpoint.$id), Query.equal("connectionVersion", endpoint.version),
    Query.equal("kind", "resend-ingest"), Query.equal("status", ["queued", "running", "retry", "failed"]), Query.orderDesc("$createdAt"), Query.limit(1),
  ] });
  const job = pending.rows[0];
  const processing = job ? { status: String(job.status), errorCode: String(job.errorCode || ""), delayed: job.status === "queued" && Date.parse(job.requestedAt) < Date.now() - 60000 } : null;
  const status = inboxDeliveryStatus({ status: String(endpoint.status), errorCode: String(endpoint.errorCode || "") }, processing, page.rows.length > 0);
  const sourceProvider = isForwardingProvider(settings.forwardingProvider) ? settings.forwardingProvider : "gmail";
  return { address: endpoint.address as string, sourceEmail, sourceProvider, status, processing, testToken: endpoint.testToken as string,
    lastReceivedAt: endpoint.lastReceivedAt as string, errorCode: endpoint.errorCode as string,
    confirmation: page.rows[0] ? JSON.parse(page.rows[0].confirmationJson) as { code: string; link: string; expiresAt: string } : null };
}
export async function changeInbox(workspaceId: string, actorId: string, action: string, sourceEmail?: unknown, sourceProvider?: unknown) {
  if (action === "source") {
    if (typeof sourceEmail !== "string" || sourceEmail.trim().length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(sourceEmail.trim()) || /[\u0000-\u001f\u007f]/.test(sourceEmail))
      throw new InputError("Enter the email address you want to forward from.");
    if (sourceProvider !== undefined && !isForwardingProvider(sourceProvider)) throw new InputError("Choose a supported email provider.");
    return currentOperation().commit(async (db, tx) => {
      const workspace = await db.getRow(params("workspaces", workspaceId, tx));
      const settings = JSON.parse(workspace.settingsJson);
      const provider = sourceProvider ?? (isForwardingProvider(settings.forwardingProvider) ? settings.forwardingProvider : "gmail");
      await db.updateRow({ ...params("workspaces", workspaceId, tx), data: { settingsJson: JSON.stringify({ ...settings, forwardingSourceEmail: sourceEmail.trim().toLowerCase(), forwardingProvider: provider }), revision: randomBytes(16).toString("hex") } });
      await audit(db, tx, workspaceId, actorId, "inbox.source_updated", inboxId(workspaceId), randomBytes(16).toString("hex"));
    });
  }
  if (action === "provision") return provisionInbox(workspaceId, actorId);
  if (action === "retry-processing") {
    const endpoint = await optionalRow("inbound_endpoints", inboxId(workspaceId));
    if (!endpoint || endpoint.status === "disabled") throw new InputError("Enable the workspace inbox before retrying.", 409);
    const page = await dataDatabase().listRows({ ...params("automation_jobs"), queries: [
      Query.equal("workspaceId", workspaceId), Query.equal("integrationId", endpoint.$id), Query.equal("connectionVersion", endpoint.version),
      Query.equal("kind", "resend-ingest"), Query.equal("status", ["failed", "cancelled"]), Query.limit(10),
    ] });
    for (const job of page.rows) await retryJob(workspaceId, job.$id);
    return;
  }
  return currentOperation().commit(async (db, tx) => {
    const endpoint = await db.getRow(params("inbound_endpoints", inboxId(workspaceId), tx));
    let data: Record<string, unknown>;
    if (action === "rotate") data = { address: `w_${randomBytes(18).toString("hex")}@${inboundDomain()}`, version: randomBytes(16).toString("hex"), createdBy: actorId, status: "not_configured", testToken: "", testStartedAt: epoch, lastReceivedAt: epoch, errorCode: "" };
    else if (action === "disable") data = { status: "disabled", version: randomBytes(16).toString("hex"), testToken: "" };
    else if (action === "enable") data = { status: "awaiting_verification", createdBy: actorId, errorCode: "" };
    else if (action === "test" && endpoint.status !== "disabled") data = { status: "awaiting_test", testToken: randomBytes(12).toString("hex"), testStartedAt: new Date().toISOString(), errorCode: "" };
    else throw new InputError("Invalid inbox action.", 409);
    if (action === "rotate") {
      const workspace = await db.getRow(params("workspaces", workspaceId, tx));
      const settings = JSON.parse(workspace.settingsJson);
      delete settings.forwardingSourceEmail;
      delete settings.forwardingProvider;
      await db.updateRow({ ...params("workspaces", workspaceId, tx), data: { settingsJson: JSON.stringify(settings), revision: randomBytes(16).toString("hex") } });
    }
    await db.updateRow({ ...params("inbound_endpoints", endpoint.$id, tx), data });
    await audit(db, tx, workspaceId, actorId, `inbox.${action}`, endpoint.$id, randomBytes(16).toString("hex"));
  });
}
