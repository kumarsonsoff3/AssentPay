import { proposalHash } from "./intelligence";
import { activeSlackIdentity } from "./slack-approvals";
import { reviewAction } from "./slack-interactions";
import { randomBytes } from "node:crypto";
import { Query, Teams, Users } from "node-appwrite";
import { dataClient, dataDatabase, databaseId } from "../data/client";
import { RuntimeStore } from "../data/runtime";
import { workerAuthorization } from "../integrations/health";
import { openCredentials } from "../integrations/credentials";
import { connectionId } from "../integrations/records";
import { hasSlackOwnerLookupScopes } from "../integrations/providers";
import { InputError } from "../workspaces/validation";
import { audit, notify, optionalRow, params, stableId, type Job } from "./store";
import type { GuardedCommit } from "./gmail-sync";

export class SlackRateLimitError extends InputError {
  constructor(readonly retryAfter: number) { super("Slack rate limited review delivery.", 503, "SLACK_RATE_LIMITED"); }
}
function slackBase() {
  if (process.env.ASSENTPAY_SIMULATION === "true" && process.env.NODE_ENV !== "production" && !process.env.APPWRITE_FUNCTION_ID && process.env.SIMULATION_SLACK_URL) {
    const url = new URL(process.env.SIMULATION_SLACK_URL);
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.username || url.password || url.search || url.hash) throw new InputError("Invalid Slack simulation URL.");
    return url.href.replace(/\/$/, "");
  }
  return "https://slack.com";
}
async function owners(workspaceId: string) {
  const teams = new Teams(dataClient()), users = new Users(dataClient()), found: { userId: string; email: string }[] = [];
  let cursor: string | undefined, pages = 0;
  do {
    if (++pages > 10) throw new InputError("Owner lookup exceeds its bounded scan.", 400, "SLACK_OWNER_LIMIT");
    const page = await teams.listMemberships({ teamId: workspaceId, queries: [Query.equal("confirm", true), Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])] });
    for (const member of page.memberships) {
      if (member.teamId !== workspaceId || !member.confirm || !member.roles.includes("owner")) continue;
      const user = await users.get({ userId: member.userId });
      if (user.$id === member.userId && user.status && user.emailVerification && user.email) found.push({ userId: user.$id, email: user.email.toLowerCase() });
      if (found.length > 10) throw new InputError("Owner review delivery requires configuration review.", 400, "SLACK_OWNER_LIMIT");
    }
    cursor = page.memberships.length === 100 ? page.memberships.at(-1)?.$id : undefined;
  } while (cursor);
  if (!found.length) throw new InputError("No verified workspace owner is available for review delivery.", 400, "SLACK_OWNER_UNAVAILABLE");
  return found;
}
const retrySeconds = (response: Response) => Math.min(3600, Math.max(1, Number(response.headers.get("retry-after")) || 30));
async function lookupOwner(token: string, teamId: string, email: string) {
  const url = new URL(`${slackBase()}/api/users.lookupByEmail`); url.searchParams.set("email", email);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000), redirect: "error" });
  if (response.status === 429) throw new SlackRateLimitError(retrySeconds(response));
  if (response.status >= 500) throw new InputError("Slack owner lookup unavailable.", 503, "SLACK_LOOKUP_UNAVAILABLE");
  const result = await response.json() as { ok?: boolean; error?: string; user?: { id?: string; team_id?: string; deleted?: boolean; is_bot?: boolean; profile?: { email?: string } } };
  if (result.error === "ratelimited") throw new SlackRateLimitError(retrySeconds(response));
  const user = result.user;
  if (!response.ok || !result.ok || !user || !/^[UW][A-Z0-9]{2,}$/.test(user.id || "") || user.team_id !== teamId || user.deleted || user.is_bot || user.profile?.email?.toLowerCase() !== email)
    throw new InputError("Reconnect Slack or confirm the owner uses the same verified email in this Slack team.", 400, "SLACK_OWNER_MAPPING_REQUIRED");
  return user.id!;
}
const reasonLabels: Record<string, string> = {
  financial_content: "Financial content detected", uncertain_content: "Content needs clarification", sender_financial_history: "Sender has prior financial history", financial_attachment: "Financial attachment detected",
  unreadable_attachment: "An attachment requires manual review",
};
export function financialReviewText(workflow: { status: string; currency: string; amount: string; proposalJson: string }, reviewUrl: string) {
  const proposal = JSON.parse(workflow.proposalJson);
  const reasons = (proposal.triage?.reasons || ["financial_content"]).map((reason: string) => reasonLabels[reason]).filter(Boolean);
  // No raw email, names, filenames, or model-written prose is placed in Slack.
  const amount = /^[A-Z]{3}$/.test(workflow.currency) && /^\d{1,12}(?:\.\d{1,3})?$/.test(workflow.amount) ? `${workflow.currency} ${workflow.amount} (unconfirmed)` : "Amount not confirmed";
  const action = proposal.intendedAction === "pay_supplier" ? "Review a proposed sandbox supplier payout." : proposal.intendedAction === "create_draft_invoice" ? "Review a proposed customer invoice draft." : "Manual review required.";
  return `AssentPay: workspace owner review needed. ${action}\n${reasons.join("; ")}.\n${amount}.\n${proposal.warnings?.length ? "Some source documents or extraction results require manual review.\n" : ""}Review the source evidence in your workspace: ${reviewUrl}\nNo financial action has been approved.`;
}
export async function deliverFinancialSlack(job: Job, commit: GuardedCommit) {
  const { workflowId } = JSON.parse(job.payloadJson), workflow = await optionalRow("financial_workflows", workflowId);
  if (!workflow || workflow.workspaceId !== job.workspaceId) throw new InputError("Workflow unavailable.", 404);
  if (!["pending_approval", "needs_review", "duplicate_review"].includes(workflow.status)) return;
  const authorize = workerAuthorization(dataClient(), job.requestedBy), store = new RuntimeStore(dataDatabase(), databaseId(), job.requestedBy, authorize);
  const found = await store.execution(job.workspaceId, "slack");
  if (!found || found.record.status !== "connected") throw new InputError("Connect Slack for owner review alerts.", 400, "SLACK_NOT_CONNECTED");
  const reminder = job.kind === "workflow-reminder";
  const destinationMode = reminder ? "owner_dm" : process.env.SLACK_REVIEW_DESTINATION || "owner_dm";
  if (!["channel", "owner_dm"].includes(destinationMode)) throw new InputError("Choose a Slack review destination.", 400, "SLACK_DESTINATION_REQUIRED");
  if (!reminder && destinationMode === "owner_dm" && !hasSlackOwnerLookupScopes(found.record.scopes))
    throw new InputError("Owner DMs require Slack's users:read and users:read.email bot permissions. Reconnect Slack to grant both.", 400, "SLACK_OWNER_SCOPE_REQUIRED");
  if (destinationMode === "channel" && !/^[CG][A-Z0-9]+$/.test(found.record.channelId || "")) throw new InputError("Choose a Slack review channel through workspace connection settings.", 400, "SLACK_DESTINATION_REQUIRED");
  const token = openCredentials(job.workspaceId, "slack", found.record.credentials).accessToken!;
  const base = new URL(process.env.APP_URL || "");
  if (!["https:", "http:"].includes(base.protocol) || base.username || base.password) throw new InputError("Review origin unavailable.", 503);
  const url = new URL(`/workspaces/${encodeURIComponent(job.workspaceId)}/review/${encodeURIComponent(workflowId)}`, base).toString();
  const message = (reminder ? "Reminder from AssentPay. " : "") + financialReviewText({ status: String(workflow.status), currency: String(workflow.currency), amount: String(workflow.amount), proposalJson: String(workflow.proposalJson) }, url);
  const targets = reminder ? [{ userId: job.requestedBy, email: "" }] : destinationMode === "owner_dm" ? await owners(job.workspaceId) : [{ userId: "", email: "" }];
  for (const owner of targets) {
    const normalDeliveryId = destinationMode === "owner_dm" ? stableId(job.workspaceId, workflowId, found.record.version, owner.userId, "owner-slack-v1") : stableId(job.workspaceId, workflowId, found.record.version, found.record.channelId!, "review-channel-v1");
    const deliveryId = reminder ? stableId(normalDeliveryId, job.$id) : normalDeliveryId;
    const existing = await optionalRow("notification_deliveries", deliveryId);
    if (existing && !["retry", "failed"].includes(existing.status)) continue;
    let destination = reminder ? "" : destinationMode === "owner_dm" ? await lookupOwner(token, found.record.externalId || "", owner.email) : found.record.channelId!;
    const claimed = await commit(async (db, tx) => {
      await workerAuthorization(dataClient(), owner.userId || job.requestedBy)(job.workspaceId, destinationMode === "owner_dm" ? ["owner"] : ["owner", "admin"]);
      if (reminder) destination = String((await activeSlackIdentity(db, tx, job.workspaceId, owner.userId)).slackUserId);
      const connection = await db.getRow(params("integrations", connectionId(job.workspaceId, "slack"), tx));
      if (connection.workspaceId !== job.workspaceId || connection.disconnectedAt || connection.connectionVersion !== found.record.version || (destinationMode === "channel" && connection.channelId !== destination)) throw new InputError("Slack connection changed.", 403);
      const current = await db.getRow(params("financial_workflows", workflowId, tx));
      if (current.workspaceId !== job.workspaceId || !["pending_approval", "needs_review", "duplicate_review"].includes(current.status)) return false;
      const prior = await optionalRow("notification_deliveries", deliveryId, db, tx);
      if (prior && !["retry", "failed"].includes(prior.status)) return false;
      if (prior) await db.updateRow({ ...params("notification_deliveries", deliveryId, tx), data: { status: "sending", attemptedAt: new Date().toISOString() } });
      else await db.createRow({ ...params("notification_deliveries", deliveryId, tx), permissions: [], data: { workspaceId: job.workspaceId, workflowId, channel: "slack", status: "sending", providerId: "", attemptedAt: new Date().toISOString() } });
      return true;
    });
    if (!claimed) continue;
    let status = "unknown", providerId = "", retry = 0;
    try {
      const response = await fetch(`${slackBase()}/api/chat.postMessage`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ channel: destination, text: message, blocks: [{ type: "section", text: { type: "plain_text", text: message } }, { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Review evidence / change amount" }, url, action_id: "assentpay_review", value: reviewAction(job.workspaceId, workflowId, proposalHash(workflow.proposalJson), found.record.version, owner.userId || job.requestedBy) }, { type: "button", text: { type: "plain_text", text: "Prepare secure Slack actions" }, url: new URL(`/workspaces/${encodeURIComponent(job.workspaceId)}/slack-identity?workflowId=${encodeURIComponent(workflowId)}`, base).toString() }] }], mrkdwn: false, parse: "none", unfurl_links: false, unfurl_media: false }), signal: AbortSignal.timeout(15000), redirect: "error" });
      if (response.status === 429) { status = "retry"; retry = retrySeconds(response); }
      else {
        const result = await response.json() as { ok?: boolean; ts?: string; error?: string };
        if (response.ok && result.ok && result.ts) { status = "delivered"; providerId = result.ts; }
        else if (result.error === "ratelimited") { status = "retry"; retry = retrySeconds(response); }
        else if (response.status < 500 && result.ok === false) status = "failed";
      }
    } catch { /* An ambiguous send is held rather than replayed. */ }
    await commit(async (db, tx) => {
      await db.updateRow({ ...params("notification_deliveries", deliveryId, tx), data: { status, providerId } });
      await audit(db, tx, job.workspaceId, job.requestedBy, `workflow.slack_${status}`, workflowId, randomBytes(16).toString("hex"));
      if (status !== "delivered") await notify(db, tx, job.workspaceId, deliveryId, "Owner Slack alert needs attention", status === "unknown" ? "Delivery could not be confirmed. Automatic replay is held; the financial review remains in your dashboard." : "Check the workspace Slack connection. The financial review remains in your dashboard.");
    });
    if (retry) throw new SlackRateLimitError(retry);
    if (status === "failed") throw new InputError("Slack rejected owner review delivery.", 400, "SLACK_DELIVERY_REJECTED");
  }
}
