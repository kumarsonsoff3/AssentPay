"use client";

import { useState } from "react";
import Link from "next/link";
import { InlineFeedback } from "@/components/feedback/feedback";
import styles from "./slack-identity.module.css";

type Workflow = {
  id: string;
  hash: string;
  counterparty: string;
  amount: string;
  currency: string;
  status: string;
  action: string;
  sourceEmail: string | null;
  sendReview: { snapshotHash: string; recipient: string; amount: string } | null;
};

export function SlackIdentity({ workspaceId, initiallyLinked, workflow }: {
  workspaceId: string;
  initiallyLinked: boolean;
  workflow?: Workflow;
}) {
  const [linked, setLinked] = useState(initiallyLinked);
  const [slackUserId, setSlackUserId] = useState("");
  const [challenge, setChallenge] = useState("");
  const [deliveryId, setDeliveryId] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [feedback, setFeedback] = useState<{ message: string; error?: boolean }>();
  const [busy, setBusy] = useState(false);
  const canApprove = workflow?.status === "pending_approval" &&
    ["create_draft_invoice", "pay_supplier"].includes(workflow.action);
  const canReview = workflow && ["needs_review", "duplicate_review"].includes(workflow.status);
  const sendReview = workflow?.sendReview;
  const canPrepare = canApprove || canReview || !!sendReview;
  const reviewUrl = workflow
    ? `/workspaces/${encodeURIComponent(workspaceId)}/review/${encodeURIComponent(workflow.id)}`
    : "/dashboard/approvals";

  async function submit(input: Record<string, unknown>) {
    setBusy(true);
    setFeedback(undefined);
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/slack-identity`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update Slack.");
      if (result.challenge) setChallenge(result.challenge);
      if (result.deliveryId) setDeliveryId(result.deliveryId);
      if (result.status === "linked" || result.status === "revoked") {
        setLinked(result.status === "linked");
        setChallenge("");
      }
      const statuses: Record<string, string> = { linked: "Your Slack account is verified.", revoked: "Slack decision access was revoked." };
      setFeedback({ message: result.message || statuses[result.status] || "Check Slack for the requested message." });
    } catch (error) {
      setFeedback({ error: true, message: error instanceof Error ? error.message : "Could not update Slack." });
    } finally {
      setBusy(false);
    }
  }

  return <div className={styles.stack}>
    {workflow && <section className={styles.card} aria-labelledby="proposal-heading">
      <h2 id="proposal-heading">{workflow.counterparty || "Financial proposal"}</h2>
      {sendReview ? <p className={styles.sendSummary}>Send a <strong>{sendReview.amount}</strong> PayPal sandbox invoice to <strong>{sendReview.recipient}</strong>.</p> :
        canApprove ? <p><strong>{workflow.currency} {workflow.amount}</strong> · {workflow.action === "pay_supplier" ? "Supplier payout" : "Customer invoice draft"}</p> :
          <p>{canReview ? "Confirm the PayPal terms in Approvals before preparing an approval card." : workflow.status === "draft_created" ? "Verify the unsent draft in Approvals to prepare a send card." : "Open the proposal to check its current status."}</p>}
      {sendReview && workflow.sourceEmail && workflow.sourceEmail.toLowerCase() !== sendReview.recipient.toLowerCase() &&
        <InlineFeedback tone="error">The source quotes {workflow.sourceEmail}. Verify the draft recipient before sending.</InlineFeedback>}
      <Link href={reviewUrl} className={!canPrepare ? styles.primary : undefined}>Open proposal in Approvals</Link>
      {canPrepare && !linked && <a href="#slack-account-heading">Link Slack to receive {canReview ? "review" : "approval"} cards</a>}
      {sendReview && linked && <button className={styles.primary} disabled={busy} onClick={() => void submit({ action: "prepare-send", workflowId: workflow.id, snapshotHash: sendReview.snapshotHash })}>Send invoice approval to my Slack</button>}
      {linked && (canApprove || canReview) && <form className={styles.form} onSubmit={event => {
        event.preventDefault();
        void submit({ action: "prepare", workflowId: workflow.id, proposalHash: workflow.hash, ...(canApprove ? { recipientEmail } : {}) });
      }}>
        {canApprove && <label>{workflow.action === "pay_supplier" ? "Supplier’s PayPal email" : "Customer’s invoice email"}
          <input type="email" required maxLength={workflow.action === "pay_supplier" ? 127 : 254} value={recipientEmail} onChange={event => setRecipientEmail(event.target.value)} />
        </label>}
        {canApprove && workflow.sourceEmail && <div className={styles.sourceEmail}>
          <p>Quoted source email <strong>{workflow.sourceEmail}</strong></p>
          {recipientEmail.trim().toLowerCase() !== workflow.sourceEmail.toLowerCase() && <>
            <button type="button" disabled={busy} onClick={() => setRecipientEmail(workflow.sourceEmail!)}>Use quoted email</button>
            {recipientEmail.trim() && <p role="status">The email entered above differs from the quoted source. Verify the intended recipient.</p>}
          </>}
        </div>}
        <button className={canApprove ? styles.primary : undefined} disabled={busy}>{canApprove ? "Send approval buttons to my Slack" : "Send review card to my Slack"}</button>
      </form>}
    </section>}
    <section className={styles.card} aria-labelledby="slack-account-heading">
      <h2 id="slack-account-heading">Slack account</h2>
      {linked ? <>
        <p>Your account is verified for workspace decisions.</p>
        <button disabled={busy} onClick={() => void submit({ action: "revoke" })}>Remove Slack decision access</button>
      </> : <>
        <p>Verify your Slack account once to receive private decision cards.</p>
        <form className={styles.form} onSubmit={event => { event.preventDefault(); void submit({ action: "start", slackUserId }); }}>
          <label>Slack member ID <input required pattern="[UW][A-Z0-9]+" placeholder="U…" value={slackUserId} onChange={event => setSlackUserId(event.target.value)} /></label>
          <button className={styles.primary} disabled={busy}>Send verification DM</button>
        </form>
        {challenge && <>
          <p>Click Verify in the Slack DM, then confirm here within 10 minutes.</p>
          <button disabled={busy} onClick={() => void submit({ action: "confirm", challenge })}>Confirm verified account</button>
        </>}
      </>}
      {deliveryId && <button disabled={busy} onClick={() => void submit({ action: "delivery-status", deliveryId })}>Check Slack delivery</button>}
      {feedback && <InlineFeedback tone={feedback.error ? "error" : "success"}>{feedback.message}</InlineFeedback>}
      {busy && <p className={styles.status} role="status">Working…</p>}
    </section>
  </div>;
}
