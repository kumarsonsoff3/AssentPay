import { createHash } from "node:crypto";
import { dataClient, dataDatabase, databaseId } from "../data/client";
import { assertCredentialExecution } from "../data/credential-execution";
import { RuntimeStore } from "../data/runtime";
import { openCredentials } from "../integrations/credentials";
import { workerAuthorization } from "../integrations/health";
import { connectionId } from "../integrations/records";
import { InputError } from "../workspaces/validation";
import {
  activeSlackIdentity,
  slackConnection,
  slackApprovalReady,
} from "./slack-approvals";
import { sendId } from "./paypal-send";
import { proposalHash } from "./intelligence";
import { optionalRow, params, stableId, type Job } from "./store";
import type { GuardedCommit } from "./gmail-sync";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const button = (text: string, action_id: string, value: string) => ({
  type: "button",
  text: { type: "plain_text", text },
  action_id,
  value,
});

export function slackDeliveryReference(payloadJson: string) {
  try {
    const id = JSON.parse(payloadJson).tokenId;
    return /^[a-f0-9]{32}$/.test(id) ? JSON.stringify({ tokenId: id }) : "{}";
  } catch {
    return "{}";
  }
}

// Called only by the established private worker/Function. No route can enter a
// credential scope here. Durable claim precedes POST; ambiguous sends never retry.
export async function deliverSlackCard(job: Job, commit: GuardedCommit) {
  assertCredentialExecution();
  if (!(await slackApprovalReady()))
    throw new InputError(
      "Verified Slack schema setup required.",
      503,
      "SLACK_APPROVAL_SETUP_REQUIRED",
    );
  const payload = JSON.parse(job.payloadJson),
    id = String(payload.tokenId || "");
  if (
    !/^[a-f0-9]{32}$/.test(id) ||
    job.kind !== "slack-card-delivery" ||
    job.integrationId !== connectionId(job.workspaceId, "slack") ||
    job.$id !== stableId(job.workspaceId, job.connectionVersion, job.kind, id)
  )
    throw new InputError("Invalid Slack delivery binding.", 403);
  const store = new RuntimeStore(
    dataDatabase(),
    databaseId(),
    job.requestedBy,
    workerAuthorization(dataClient(), job.requestedBy),
  );
  // Real RuntimeStore + credential decoder both enforce private execution.
  const found = await store.execution(job.workspaceId, "slack");
  if (
    !found ||
    found.record.status !== "connected" ||
    found.record.version !== job.connectionVersion
  )
    throw new InputError("Slack connection changed.", 403);
  const accessToken = openCredentials(
    job.workspaceId,
    "slack",
    found.record.credentials,
  ).accessToken;
  const claim = await commit(async (db, tx) => {
    const row = await optionalRow("slack_action_tokens", id, db, tx);
    // Strip the only durable raw capability before an external request. The token
    // row retains its digest; job retries retain only a non-authorizing row ID.
    await db.updateRow({
      ...params("automation_jobs", job.$id, tx),
      data: { payloadJson: JSON.stringify({ tokenId: id }) },
    });
    if (!row) return null;
    if (
      row.workspaceId !== job.workspaceId ||
      row.ownerId !== job.requestedBy ||
      row.connectionVersion !== job.connectionVersion
    )
      throw new InputError("Slack delivery tenant/actor changed.", 403);
    if (row.status !== "queued") {
      if (row.status === "sending" && job.attempts > 1)
        await db.updateRow({
          ...params("slack_action_tokens", id, tx),
          data: { status: "unknown" },
        });
      return null;
    }
    if (!(Date.parse(row.expiresAt) > Date.now())) {
      await db.updateRow({
        ...params("slack_action_tokens", id, tx),
        data: { status: "expired", recipientEmail: "" },
      });
      return null;
    }
    if (
      typeof payload.token !== "string" ||
      !/^[a-f0-9]{64}$/.test(payload.token) ||
      hash(payload.token) !== row.tokenHash ||
      hash(payload.token).slice(0, 32) !== id
    )
      throw new InputError("Slack capability changed.", 403);
    await workerAuthorization(dataClient(), job.requestedBy)(job.workspaceId, [
      "owner",
    ]);
    await slackConnection(
      db,
      tx,
      job.workspaceId,
      job.connectionVersion,
      row.teamId,
    );
    let amount = "", operation = "";
    if (row.kind === "decision" || row.kind === "invoice_send") {
      const identity = await activeSlackIdentity(
        db,
        tx,
        job.workspaceId,
        job.requestedBy,
      );
      if (
        identity.identityVersion !== row.identityVersion ||
        identity.slackUserId !== row.slackUserId ||
        identity.teamId !== row.teamId
      )
        throw new InputError("Slack identity changed.", 403);
      const workflow = await db.getRow(
        params("financial_workflows", row.workflowId, tx),
      );
      const invoiceSend = row.kind === "invoice_send";
      const review = invoiceSend ? await optionalRow("paypal_send_reviews", sendId(job.workspaceId, row.workflowId), db, tx) : null;
      if (workflow.workspaceId !== job.workspaceId || (invoiceSend
        ? workflow.status !== "draft_created" || workflow.action === "review" ||
          !review || review.workspaceId !== job.workspaceId || review.workflowId !== row.workflowId ||
          review.connectionVersion !== row.merchantVersion ||
          review.snapshotHash !== row.proposalHash || hash(review.snapshotJson) !== row.proposalHash ||
          !(Date.parse(review.expiresAt) > Date.now())
        : proposalHash(workflow.proposalJson) !== row.proposalHash ||
          !["pending_approval", "needs_review", "duplicate_review"].includes(workflow.status)))
        throw new InputError("Proposal changed.", 403);
      const invoice = review ? JSON.parse(review.snapshotJson).invoice : null;
      if (invoice && invoice.primary_recipients?.[0]?.billing_info?.email_address !== row.recipientEmail)
        throw new InputError("Invoice recipient changed.", 403);
      if (row.recipientEmail) {
        const merchant = await db.getRow(
          params("integrations", connectionId(job.workspaceId, "paypal"), tx),
        );
        if (
          merchant.workspaceId !== job.workspaceId ||
          merchant.provider !== "paypal" ||
          merchant.status !== "connected" ||
          merchant.environment !== "sandbox" ||
          merchant.disconnectedAt ||
          merchant.connectionVersion !== row.merchantVersion
        )
          throw new InputError("Merchant connection changed.", 403);
      }
      operation = invoiceSend ? "invoice_send" : workflow.status === "pending_approval" ? String(workflow.action) : "";
      const currency = String(invoice ? invoice.amount?.currency_code : workflow.currency);
      const value = String(invoice ? invoice.amount?.value : workflow.amount);
      amount =
        /^[A-Z]{3}$/.test(currency) && /^[0-9]{1,12}(?:[.][0-9]{1,3})?$/.test(value)
          ? currency + " " + value
          : "Amount requires review";
    } else if (row.kind !== "link")
      throw new InputError("Invalid Slack delivery kind.", 403);
    await db.updateRow({
      ...params("slack_action_tokens", id, tx),
      data: { status: "sending" },
    });
    return {
      destination: String(row.slackUserId),
      kind: String(row.kind),
      workspace: String(row.workspaceId),
      workflow: String(row.workflowId),
      proposal: String(row.proposalHash),
      recipient: String(row.recipientEmail),
      amount,
      operation,
    };
  });
  if (!claim) return;
  let text: string, elements: unknown[];
  if (claim.kind === "link") {
    text =
      "An authenticated AssentPay owner requested linking this Slack account. Only confirm if you initiated this in your own signed-in dashboard. Return there to finish. Expires in 10 minutes.";
    elements = [
      button("Verify my Slack account", "assentpay_link", payload.token),
    ];
  } else {
    const origin = new URL(process.env.APP_URL || "");
    if (
      !["https:", "http:"].includes(origin.protocol) ||
      origin.username ||
      origin.password
    )
      throw new InputError("Review origin unavailable.", 503);
    const url = new URL(
      "/workspaces/" +
        encodeURIComponent(claim.workspace) +
        "/review/" +
        encodeURIComponent(claim.workflow),
      origin,
    ).toString();
    const payout = claim.operation === "pay_supplier";
    const send = claim.operation === "invoice_send";
    const label = send ? "Send sandbox invoice" : payout ? "Pay supplier in sandbox" : "Approve draft";
    const consequence = send ? "Authorizes PayPal to send the verified sandbox invoice." : payout ? "Authorizes the exact PayPal sandbox supplier payout." : "Authorizes a sandbox draft only; no invoice send or funds movement.";
    text =
      claim.amount +
      ". " + (claim.operation ? consequence : "Manual review required.") + " Exact proposal " +
      claim.proposal.slice(0, 12) +
      " for workflow " +
      claim.workflow +
      ". " +
      (claim.recipient
        ? "Authenticated recipient selection: " + claim.recipient + "."
        : "No recipient selected: approval unavailable; reject/review only.") +
      " One decision only; expires in 10 minutes.";
    elements = [
      ...(send ? [] : [
        button("Reject exact proposal", "assentpay_reject", payload.token),
        button("Remind me tomorrow", "assentpay_remind", payload.token),
        button("Save to memory", "assentpay_save_memory", payload.token),
      ]),
      {
        type: "button",
        text: { type: "plain_text", text: send ? "Review verified invoice" : "Review / change amount" },
        url,
      },
    ];
    if (claim.recipient && ["create_draft_invoice", "pay_supplier", "invoice_send"].includes(claim.operation))
      elements.unshift({
        ...button(send || payout ? label : "Approve exact proposal", "assentpay_approve", payload.token),
        confirm: {
          title: { type: "plain_text", text: "Approve this exact proposal?" },
          text: {
            type: "plain_text",
            text:
              claim.amount +
              " to " +
              claim.recipient +
              ". " + consequence,
          },
          confirm: { type: "plain_text", text: label },
          deny: { type: "plain_text", text: "Cancel" },
        },
      });
  }
  let status = "unknown";
  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: claim.destination,
        text,
        blocks: [
          { type: "section", text: { type: "plain_text", text } },
          { type: "actions", elements },
        ],
        mrkdwn: false,
        parse: "none",
        unfurl_links: false,
        unfurl_media: false,
      }),
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    const result = (await response.json()) as { ok?: boolean };
    if (response.ok && result.ok) status = "pending";
  } catch {
    /* Ambiguous or failed delivery is held; never automatically POST again. */
  }
  await commit(async (db, tx) => {
    const row = await optionalRow("slack_action_tokens", id, db, tx);
    if (row?.workspaceId === job.workspaceId && row.status === "sending")
      await db.updateRow({
        ...params("slack_action_tokens", id, tx),
        data: { status },
      });
  });
}
