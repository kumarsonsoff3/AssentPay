import { createHash, randomBytes } from "node:crypto";
import type { TablesDB } from "node-appwrite";
import { z } from "zod";
import { dataClient } from "../data/client";
import { currentOperation } from "../data/coordinator";
import { workerAuthorization } from "../integrations/health";
import { connectionId } from "../integrations/records";
import { InputError, validId } from "../workspaces/validation";
import { optionalRow, params, stableId, audit, enqueue } from "./store";
import { proposalHash } from "./intelligence";
import { approveInvoiceSend, sendId } from "./paypal-send";
import { rememberExtractedMemory } from "./memory";
import { decideWorkflow } from "./workflows";
import { slackApprovalMigrationId, slackApprovalTables } from "./slack-schema";

const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const identityId = (workspace: string, owner: string) =>
  stableId("slack-owner-v1", workspace, owner);
const nonce = () => randomBytes(32).toString("hex");
export async function slackApprovalReady() {
  const receipt = await optionalRow(
    "schema_migrations",
    slackApprovalMigrationId,
  );
  return (
    !!receipt &&
    receipt.status === "applied" &&
    receipt.checksum === digest(JSON.stringify(slackApprovalTables)) &&
    Array.isArray(receipt.$permissions) &&
    receipt.$permissions.length === 0
  );
}
async function requireSetup() {
  if (!(await slackApprovalReady()))
    throw new InputError(
      "Verified Slack decisions are not configured. Ask the operator to verify additive migration 008; secure dashboard review is still available.",
      503,
      "SLACK_APPROVAL_SETUP_REQUIRED",
    );
}
const expiry = () => new Date(Date.now() + 10 * 60_000).toISOString();
const authorize = (workspace: string, owner: string) =>
  workerAuthorization(dataClient(), owner)(workspace, ["owner"]);
const recipient = z.string().trim().email().max(254);
export const slackManagementInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("start"),
      slackUserId: z.string().regex(/^[UW][A-Z0-9]{2,}$/),
    })
    .strict(),
  z
    .object({
      action: z.literal("confirm"),
      challenge: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
  z.object({ action: z.literal("revoke") }).strict(),
  z
    .object({
      action: z.literal("delivery-status"),
      deliveryId: z.string().regex(/^[a-f0-9]{32}$/),
    })
    .strict(),
  z.strictObject({
    action: z.literal("prepare-send"),
    workflowId: z.string().min(1).max(36),
    snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  z
    .object({
      action: z.literal("prepare"),
      workflowId: z.string().min(1).max(36),
      proposalHash: z.string().regex(/^[a-f0-9]{64}$/),
      recipientEmail: recipient.optional(),
    })
    .strict(),
]);
export async function slackConnection(
  db: TablesDB,
  tx: string,
  workspace: string,
  version?: string,
  team?: string,
) {
  const row = await db.getRow(
    params("integrations", connectionId(workspace, "slack"), tx),
  );
  if (
    row.workspaceId !== workspace ||
    row.provider !== "slack" ||
    row.status !== "connected" ||
    row.disconnectedAt ||
    !/^[A-Z0-9]+$/.test(row.externalId || "") ||
    (version && row.connectionVersion !== version) ||
    (team && row.externalId !== team)
  )
    throw new InputError(
      "Slack connection changed. Use secure dashboard review.",
      403,
    );
  return row;
}
export async function slackIdentityLinked(workspaceId: string, ownerId: string) {
  const [identity, slack] = await Promise.all([
    optionalRow("slack_identities", identityId(workspaceId, ownerId)),
    optionalRow("integrations", connectionId(workspaceId, "slack")),
  ]);
  return identity?.workspaceId === workspaceId && identity.ownerId === ownerId && identity.status === "active" &&
    slack?.workspaceId === workspaceId && slack.provider === "slack" && !slack.disconnectedAt && slack.status === "connected" &&
    identity.connectionVersion === slack.connectionVersion && identity.teamId === slack.externalId;
}

export async function activeSlackIdentity(
  db: TablesDB,
  tx: string,
  workspace: string,
  owner: string,
) {
  await authorize(workspace, owner);
  const row = await db.getRow(
    params("slack_identities", identityId(workspace, owner), tx),
  );
  if (
    row.workspaceId !== workspace ||
    row.ownerId !== owner ||
    row.status !== "active"
  )
    throw new InputError(
      "Link your Slack identity in the secure dashboard.",
      403,
    );
  await slackConnection(db, tx, workspace, row.connectionVersion, row.teamId);
  await db.updateRow({
    ...params("slack_identities", row.$id, tx),
    data: { fence: nonce() },
  });
  return row;
}
// Dashboard start/confirm and a signed Slack click provide two independent proofs.
// Email lookup alone and forwarded-card possession never establish authority.
export async function manageSlackIdentity(
  workspace: string,
  owner: string,
  raw: unknown,
) {
  validId(workspace);
  validId(owner);
  const parsed = slackManagementInput.safeParse(raw);
  if (!parsed.success) throw new InputError("Invalid Slack identity request.");
  const input = parsed.data;
  await authorize(workspace, owner);
  await requireSetup();
  if (input.action === "delivery-status") {
    const row = await optionalRow("slack_action_tokens", input.deliveryId);
    if (!row || row.workspaceId !== workspace || row.ownerId !== owner)
      throw new InputError("Delivery unavailable.", 404);
    const status = !(Date.parse(row.expiresAt) > Date.now())
      ? "expired"
      : row.status === "pending"
        ? "delivered"
        : row.status;
    return {
      status,
      message:
        "Slack card delivery: " +
        status +
        ". Queued is not delivered; unknown/sending may have reached Slack and will not be replayed. Secure dashboard review remains available.",
    };
  }
  if (input.action === "start") {
    const challenge = nonce(),
      id = digest(challenge).slice(0, 32);
    await currentOperation().commit(async (db, tx) => {
      await authorize(workspace, owner);
      const meta = await slackConnection(db, tx, workspace);
      await db.createRow({
        ...params("slack_action_tokens", id, tx),
        permissions: [],
        data: {
          workspaceId: workspace,
          ownerId: owner,
          teamId: meta.externalId,
          slackUserId: input.slackUserId,
          connectionVersion: meta.connectionVersion,
          identityVersion: "",
          merchantVersion: "",
          kind: "link",
          workflowId: "",
          proposalHash: "",
          recipientEmail: "",
          tokenHash: digest(challenge),
          status: "queued",
          expiresAt: expiry(),
        },
      });
      await enqueue(
        {
          workspaceId: workspace,
          integrationId: connectionId(workspace, "slack"),
          connectionVersion: meta.connectionVersion,
          requestedBy: owner,
          kind: "slack-card-delivery",
          key: id,
          payload: { tokenId: id, token: challenge },
        },
        db,
        tx,
      );
    });
    return {
      challenge,
      deliveryId: id,
      status: "queued",
      message:
        "Verification DM queued for the private worker, not yet delivered. Check delivery status, then verify in Slack and confirm here.",
    };
  }
  if (input.action === "confirm")
    return currentOperation().commit(async (db, tx) => {
      await authorize(workspace, owner);
      const row = await db.getRow(
        params("slack_action_tokens", digest(input.challenge).slice(0, 32), tx),
      );
      if (
        row.workspaceId !== workspace ||
        row.ownerId !== owner ||
        row.kind !== "link" ||
        row.tokenHash !== digest(input.challenge) ||
        row.status !== "verified" ||
        !(Date.parse(row.expiresAt) > Date.now())
      )
        throw new InputError("Slack verification expired or unavailable.", 403);
      await slackConnection(
        db,
        tx,
        workspace,
        row.connectionVersion,
        row.teamId,
      );
      await db.updateRow({
        ...params("slack_action_tokens", row.$id, tx),
        data: { status: "consumed", recipientEmail: "" },
      });
      await db.upsertRow({
        ...params("slack_identities", identityId(workspace, owner), tx),
        permissions: [],
        data: {
          workspaceId: workspace,
          ownerId: owner,
          teamId: row.teamId,
          slackUserId: row.slackUserId,
          connectionVersion: row.connectionVersion,
          identityVersion: nonce(),
          fence: nonce(),
          status: "active",
        },
      });
      await audit(
        db,
        tx,
        workspace,
        owner,
        "slack.identity_linked",
        owner,
        nonce(),
      );
      return { status: "linked" };
    });
  if (input.action === "revoke")
    return currentOperation().commit(async (db, tx) => {
      await authorize(workspace, owner);
      const row = await optionalRow(
        "slack_identities",
        identityId(workspace, owner),
        db,
        tx,
      );
      if (row?.workspaceId === workspace && row.ownerId === owner)
        await db.updateRow({
          ...params("slack_identities", row.$id, tx),
          data: { status: "revoked", identityVersion: nonce(), fence: nonce() },
        });
      await audit(
        db,
        tx,
        workspace,
        owner,
        "slack.identity_revoked",
        owner,
        nonce(),
      );
      return { status: "revoked" };
    });
  validId(input.workflowId);
  const token = nonce();
  await currentOperation().commit(async (db, tx) => {
    const identity = await activeSlackIdentity(db, tx, workspace, owner);
    const workflow = await db.getRow(
      params("financial_workflows", input.workflowId, tx),
    );
    const send = input.action === "prepare-send";
    const review = send ? await optionalRow("paypal_send_reviews", sendId(workspace, input.workflowId), db, tx) : null;
    if (workflow.workspaceId !== workspace || (send
      ? workflow.status !== "draft_created" || workflow.action === "review" ||
        !review || review.workspaceId !== workspace || review.workflowId !== workflow.$id ||
        review.snapshotHash !== input.snapshotHash || digest(review.snapshotJson) !== input.snapshotHash ||
        !(Date.parse(review.expiresAt) > Date.now())
      : proposalHash(workflow.proposalJson) !== input.proposalHash ||
        !["pending_approval", "needs_review", "duplicate_review"].includes(workflow.status)))
      throw new InputError("Proposal changed or already decided.", 409);
    const email = send ? JSON.parse(review!.snapshotJson).invoice.primary_recipients?.[0]?.billing_info?.email_address : input.recipientEmail;
    if (send && !recipient.safeParse(email).success) throw new InputError("The verified invoice recipient is unavailable.", 409);
    if (!send && email && (workflow.status !== "pending_approval" || !["create_draft_invoice", "pay_supplier"].includes(workflow.action)))
      throw new InputError("Prepare the PayPal terms in Approvals before selecting a recipient.", 409);
    const merchant = email ? await db.getRow(params("integrations", connectionId(workspace, "paypal"), tx)) : null;
    if (merchant && (merchant.workspaceId !== workspace || merchant.provider !== "paypal" ||
      merchant.status !== "connected" || merchant.environment !== "sandbox" || merchant.disconnectedAt ||
      (review && merchant.connectionVersion !== review.connectionVersion))) {
      throw new InputError("Connect a healthy sandbox merchant first.", 409);
    }
    // Only this authenticated exact-proposal request selects the customer.
    await db.createRow({
      ...params("slack_action_tokens", digest(token).slice(0, 32), tx),
      permissions: [],
      data: {
        workspaceId: workspace,
        ownerId: owner,
        teamId: identity.teamId,
        slackUserId: identity.slackUserId,
        connectionVersion: identity.connectionVersion,
        identityVersion: identity.identityVersion,
        merchantVersion: merchant?.connectionVersion || "",
        kind: send ? "invoice_send" : "decision",
        workflowId: input.workflowId,
        proposalHash: send ? input.snapshotHash : input.proposalHash,
        recipientEmail: email || "",
        tokenHash: digest(token),
        status: "queued",
        expiresAt: expiry(),
      },
    });
    await enqueue(
      {
        workspaceId: workspace,
        integrationId: connectionId(workspace, "slack"),
        connectionVersion: String(identity.connectionVersion),
        requestedBy: owner,
        kind: "slack-card-delivery",
        key: digest(token).slice(0, 32),
        payload: { tokenId: digest(token).slice(0, 32), token },
      },
      db,
      tx,
    );
  });
  return {
    status: "queued",
    deliveryId: digest(token).slice(0, 32),
    message:
      "Decision card queued for the private worker, not yet delivered. Check delivery status or use secure dashboard review.",
  };
}

import type { SlackTokenAction } from "./slack-interactions";
export type SlackTokenInteraction = {
  token: string;
  teamId: string;
  slackUserId: string;
  action: SlackTokenAction;
};
export async function handleSlackToken(input: SlackTokenInteraction) {
  await requireSetup();
  const id = digest(input.token).slice(0, 32);
  const snapshot = await optionalRow("slack_action_tokens", id);
  if (!snapshot)
    throw new InputError(
      "Slack action unavailable. Use dashboard review.",
      403,
    );
  const guard = async (db: TablesDB, tx: string) => {
    const row = await db.getRow(params("slack_action_tokens", id, tx));
    if (
      row.tokenHash !== digest(input.token) ||
      row.teamId !== input.teamId ||
      row.slackUserId !== input.slackUserId ||
      row.status !== "pending" ||
      !(Date.parse(row.expiresAt) > Date.now()) ||
      row.workspaceId !== snapshot.workspaceId || row.kind !== snapshot.kind ||
      row.ownerId !== snapshot.ownerId ||
      row.workflowId !== snapshot.workflowId ||
      row.proposalHash !== snapshot.proposalHash ||
      row.recipientEmail !== snapshot.recipientEmail
    )
      throw new InputError(
        "Slack action expired, changed, used, or belongs to another recipient.",
        403,
      );
    await authorize(row.workspaceId, row.ownerId);
    await slackConnection(
      db,
      tx,
      row.workspaceId,
      row.connectionVersion,
      input.teamId,
    );
    if (input.action === "assentpay_link") {
      if (row.kind !== "link")
        throw new InputError("Invalid link challenge.", 403);
      await db.updateRow({
        ...params("slack_action_tokens", id, tx),
        data: { status: "verified" },
      });
      return;
    }
    if (row.kind !== "decision" && !(row.kind === "invoice_send" && input.action === "assentpay_approve"))
      throw new InputError("Invalid decision token.", 403);
    const identity = await activeSlackIdentity(
      db,
      tx,
      row.workspaceId,
      row.ownerId,
    );
    if (
      identity.identityVersion !== row.identityVersion ||
      identity.slackUserId !== input.slackUserId ||
      identity.teamId !== input.teamId
    )
      throw new InputError("Slack identity changed.", 403);
    const workflow = await db.getRow(
      params("financial_workflows", row.workflowId, tx),
    );
    if (
      workflow.workspaceId !== row.workspaceId ||
      (row.kind === "decision" && proposalHash(workflow.proposalJson) !== row.proposalHash)
    )
      throw new InputError("Proposal changed.", 409);
    if (
      input.action === "assentpay_approve" &&
      !recipient.safeParse(row.recipientEmail).success
    )
      throw new InputError(
        "Select the exact customer in authenticated dashboard review.",
        409,
      );
    if (input.action === "assentpay_approve") {
      const merchant = await db.getRow(
        params("integrations", connectionId(row.workspaceId, "paypal"), tx),
      );
      if (
        merchant.workspaceId !== row.workspaceId ||
        merchant.provider !== "paypal" ||
        merchant.disconnectedAt ||
        merchant.status !== "connected" ||
        merchant.environment !== "sandbox" ||
        !row.merchantVersion ||
        merchant.connectionVersion !== row.merchantVersion
      )
        throw new InputError(
          "Merchant connection changed. Prepare a new authenticated card.",
          403,
        );
    }
    if (input.action === "assentpay_save_memory" || input.action === "assentpay_remind") {
      const event = input.action === "assentpay_save_memory" ? "workflow.slack_memory_saved" : "workflow.slack_reminder_scheduled";
      if (await optionalRow("audit_events", stableId(id, event, workflow.$id), db, tx)) return;
      if (input.action === "assentpay_save_memory") {
        const memory = await optionalRow("agent_memory", workflow.messageId, db, tx);
        if (memory && (memory.workspaceId !== row.workspaceId || memory.status !== "active" || !(Date.parse(memory.expiresAt) > Date.now()))) {
          throw new InputError("This memory is paused, expired or forgotten. Review it in the dashboard.", 409);
        }
        const extraction = JSON.parse(workflow.proposalJson).extraction;
        if (!memory) await rememberExtractedMemory(db, tx, row.workspaceId, workflow.messageId, {
          category: extraction.category, counterparty: extraction.counterparty, reference: extraction.reference,
          amount: extraction.amount, currency: extraction.currency, authority: "unconfirmed_extraction",
        });
        else await db.updateRow({ ...params("agent_memory", memory.$id, tx),
          data: { expiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString() } });
      } else {
        if (!["pending_approval", "needs_review", "duplicate_review"].includes(workflow.status))
          throw new InputError("This workflow has already been decided.", 409);
        const due = new Date(Date.now() + 86_400_000).toISOString();
        const jobId = await enqueue({
          workspaceId: row.workspaceId, integrationId: connectionId(row.workspaceId, "slack"),
          connectionVersion: row.connectionVersion, requestedBy: row.ownerId,
          kind: "workflow-reminder", key: id, payload: { workflowId: workflow.$id },
        }, db, tx);
        await db.updateRow({ ...params("automation_jobs", jobId, tx), data: { nextAttemptAt: due } });
      }
      await audit(db, tx, row.workspaceId, row.ownerId, event, workflow.$id, id);
      return;
    }
    await db.updateRow({
      ...params("slack_action_tokens", id, tx),
      data: { status: "consumed", recipientEmail: "" },
    });
  };
  if (input.action === "assentpay_link") {
    await currentOperation().commit(guard);
    return "Slack verified. Return to your signed-in dashboard and confirm the link. No financial decision was made.";
  }
  if (input.action === "assentpay_save_memory" || input.action === "assentpay_remind") {
    await currentOperation().commit(guard);
    return input.action === "assentpay_save_memory" ? "Saved as context in Agent Memory." : "Reminder scheduled for tomorrow while the proposal is open.";
  }
  if (snapshot.kind === "invoice_send") {
    await approveInvoiceSend(snapshot.workspaceId, snapshot.workflowId, snapshot.ownerId, snapshot.proposalHash, guard);
    return "Exact sandbox invoice send approved. See the dashboard for delivery status.";
  }
  // The parent-owned fifth-argument hook executes INSIDE the existing decision transaction.
  await decideWorkflow(
    snapshot.workspaceId,
    snapshot.workflowId,
    snapshot.ownerId,
    {
      action: input.action === "assentpay_approve" ? "approve" : "reject",
      proposalHash: snapshot.proposalHash,
      recipientEmail: snapshot.recipientEmail,
    },
    guard,
  );
  return "Exact proposal decision saved. Execution remains subject to the existing workflow policy. Review status in your secure dashboard.";
}
