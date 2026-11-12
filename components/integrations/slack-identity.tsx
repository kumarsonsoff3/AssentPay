"use client";
import { useState } from "react";
import Link from "next/link";
export function SlackIdentity({ workspaceId, workflow }: { workspaceId: string; workflow?: { id: string; hash: string; amount: string; currency: string; status: string; action?: string } }) {
  const [slackUserId, setSlackUserId] = useState(""), [challenge, setChallenge] = useState(""), [deliveryId, setDeliveryId] = useState(""), [recipientEmail, setRecipientEmail] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  async function submit(input: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/slack-identity`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save. Use dashboard review.");
      if (result.challenge) setChallenge(result.challenge);
      if (result.deliveryId) setDeliveryId(result.deliveryId);
      if (input.action === "confirm" || input.action === "revoke") setChallenge("");
      setMessage(result.message || `Slack identity: ${result.status}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save. Use dashboard review."); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="slack-heading">
    <h1 id="slack-heading">Verified Slack decisions</h1>
    <p>Only a current workspace owner can link an account. Email matching does not grant approval authority. Linking requires your signed-in dashboard and a signed click from the exact Slack account.</p>
    <form onSubmit={event => { event.preventDefault(); void submit({ action: "start", slackUserId }); }}>
      <label>Your Slack member ID <input required pattern="[UW][A-Z0-9]+" value={slackUserId} onChange={event => setSlackUserId(event.target.value)} /></label>
      <button disabled={busy} type="submit">Send verification DM</button>
    </form>
    {challenge && <p>Click Verify in your own Slack DM, then <button disabled={busy} onClick={() => void submit({ action: "confirm", challenge })}>Confirm verified account</button>. This expires in 10 minutes.</p>}
    <button disabled={busy} onClick={() => void submit({ action: "revoke" })}>Revoke my Slack decision access</button>
    {workflow && <section aria-labelledby="proposal-heading"><h2 id="proposal-heading">Exact proposal {workflow.id}</h2>
      <p>{workflow.currency} {workflow.amount} · {workflow.status} · proposal {workflow.hash.slice(0,12)}</p>
      <p><a href={`/workspaces/${encodeURIComponent(workspaceId)}/review/${encodeURIComponent(workflow.id)}`}>Review source evidence and existing workflow policy first</a>. This does not approve anything now. Sending a card shares your selected recipient email only with your linked Slack account.</p>
      <form onSubmit={event => { event.preventDefault(); void submit({ action: "prepare", workflowId: workflow.id, proposalHash: workflow.hash, ...(recipientEmail ? { recipientEmail } : {}) }); }}>
        <label>{workflow.action === "pay_supplier" ? "Exact supplier PayPal email (required for approval)" : "Exact customer email (required for approval)"} <input type="email" maxLength={254} value={recipientEmail} onChange={event => setRecipientEmail(event.target.value)} /></label>
        <p>Never select a recipient solely because an untrusted forwarded message or Slack text named them. A blank recipient allows reject/review only.</p>
        <button disabled={busy} type="submit">Send one-time decision card to my linked Slack</button>
      </form></section>}
    <p>DMs and cards are queued for the private worker, not sent by this dashboard. Queued is not delivered. Sending or unknown outcomes are held without automatic replay; use secure dashboard review.</p>
    {deliveryId && <button disabled={busy} onClick={() => void submit({ action: "delivery-status", deliveryId })}>Check Slack card delivery status</button>}
    <p role="status" aria-live="polite">{busy ? "Saving…" : message}</p>
    <p><Link href="/dashboard/approvals">Continue secure dashboard review</Link></p>
  </section>;
}
