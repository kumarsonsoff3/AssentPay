"use client";
import { useToast } from "@/components/feedback/toast-provider";
import { InlineFeedback } from "@/components/feedback/feedback";
import { requestErrorMessage } from "@/lib/request-feedback";
import { Spinner } from "@/components/feedback/feedback";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Bell, ChevronDown, FileText, Handshake, Mail, Pencil, Search, ShieldCheck } from "@/components/icons";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";
import { MemoryWorkspace } from "./memory-workspace";
import { ProcessingActivity } from "./processing-activity";
import { ConversationWorkspace } from "./conversation-workspace";
import { displayTime, ActivityTimeline, ActivityEmpty } from "./workspace-presenters";
import { EmptyState } from "./states";
import type { Resource } from "@/lib/automation/resources";
type Item = Record<string, unknown> & { id: string };
export type ResourcePage = { items: Item[]; nextCursor: string | null };
const titles: Record<Resource, string> = {
  messages: "Conversations",
  contacts: "Clients & contacts",
  documents: "Documents",
  activity: "Workspace activity",
  jobs: "Background tasks",
  notifications: "Notifications",
  workflows: "Financial workflows & approvals",
  memory: "Workspace memory",
  analyses: "Financial analysis",
  deliveries: "Notification deliveries",
};
const str = (item: Item, key: string) =>
  typeof item[key] === "string" ? (item[key] as string) : "";
export type WorkflowView = "deals" | "approvals" | "invoices";
const workflowViews = {
  deals: { title: "Agreement pipeline", filter: "deals" },
  approvals: { title: "Review queue", filter: "review" },
  invoices: { title: "Invoice & payout ledger", filter: "payments" },
} as const;
const reviewStates = new Set(["pending_approval", "needs_review", "duplicate_review", "reconciliation_required", "send_reconciliation_required", "payout_reconciliation_required"]);
const invoiceStates = new Set(["draft_created", "send_approved", "send_reconciliation_required", "invoice_sent", "unpaid", "payment_pending", "partially_paid", "paid", "externally_marked_paid", "scheduled", "cancelled", "refunded", "partially_refunded"]);
function matchesFilter(item: Item, filter: string) {
  const status = str(item, "status");
  if (filter === "review") return reviewStates.has(status);
  if (filter === "payments") return invoiceStates.has(status) || status.startsWith("payout_") || !!str(item, "providerId");
  if (filter === "drafts") return status === "draft_created";
  if (filter === "unread") return item.unread === true || item.read === false;
  if (filter === "deals") {
    const proposal = item.proposal as Proposal | undefined;
    return ["agreement", "quotation"].includes(proposal?.extraction?.category || "") || !!proposal?.agreementWorkflowId;
  }
  return true;
}
function statusTone(status: string) {
  if (reviewStates.has(status) || ["payout_on_hold", "payout_unclaimed", "unknown", "failed", "payout_failed", "payout_blocked"].includes(status)) return "attention";
  if (["paid", "payout_paid", "stored", "delivered", "sent", "invoice_sent", "read"].includes(status)) return "good";
  if (["approved", "executing", "draft_created", "payout_pending", "queued", "unread"].includes(status)) return "progress";
  return "neutral";
}
function StatusPill({ status }: { status: string }) {
  return <span className={styles.recordStatus} data-tone={statusTone(status)}>{status.replaceAll("_", " ") || "Unknown"}</span>;
}
const recordIcons = { contacts: Mail, documents: FileText, notifications: Bell, deliveries: Bell, analyses: ShieldCheck };
const emptyTitles: Partial<Record<Resource, string>> = {
  workflows: "No financial proposals yet", contacts: "No contacts yet", documents: "No documents yet",
  notifications: "No notifications yet", deliveries: "No deliveries yet", analyses: "No analyses yet",
};

export function LiveResource({
  workspaceId,
  resource,
  initial,
  revision,
  canManage,
  timeZone = "UTC",
  canSyncGmail = false,
  workflowView,
  focusedWorkflow,
}: {
  workspaceId: string;
  resource: Resource;
  initial: ResourcePage;
  revision?: string;
  canManage: boolean;
  timeZone?: string;
  canSyncGmail?: boolean;
  workflowView?: WorkflowView;
  focusedWorkflow?: string;
}) {
  const notify = useToast();
  const view = workflowView ? workflowViews[workflowView] : undefined;
  const router = useRouter(),
    [loaded, setLoaded] = useState<{ revision: string | undefined; page: ResourcePage } | null>(null),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState<string>(focusedWorkflow ? "all" : view?.filter || "all"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false);
  const page = loaded && loaded.revision === revision ? loaded.page : initial;
  const search = query.trim().toLowerCase();
  const items = useMemo(
    () => page.items.filter(item => matchesFilter(item, filter) && (!search || JSON.stringify(item).toLowerCase().includes(search))),
    [page.items, search, filter],
  );
  async function mutate(path: string, body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    setMessage("");
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        result = await response.json();
      if (!response.ok) throw new Error(result.error || "The request failed.");
      notify(typeof result.message === "string" ? result.message : result.jobId ? "Queued. Progress will update automatically." : "Saved.");
      setLoaded(null);
      router.refresh();
    } catch (e) {
      setFailed(true);
      setMessage(requestErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function more() {
    if (!page.nextCursor || busy) return;
    setBusy(true);
    setFailed(false);
    setMessage("");
    try {
      const response = await fetch(
          `/api/workspaces/${workspaceId}/resources/${resource}?cursor=${encodeURIComponent(page.nextCursor)}`,
        ),
        next = await response.json();
      if (!response.ok) throw new Error(next.error);
      setLoaded({
        revision,
        page: { items: [...page.items, ...next.items], nextCursor: next.nextCursor },
      });
    } catch {
      setFailed(true);
      setMessage("We couldn’t load more items. Select Load more to try again.");
    } finally {
      setBusy(false);
    }
  }
  const customView = resource === "memory" ? <MemoryWorkspace items={page.items} busy={busy} canManage={canManage} feedback={message} failed={failed} timeZone={timeZone} nextCursor={page.nextCursor} more={() => void more()} mutate={mutate} /> : resource === "messages" ? <ConversationWorkspace items={page.items} nextCursor={page.nextCursor} busy={busy} more={() => void more()} feedback={message} feedbackFailed={failed} sync={canManage && canSyncGmail ? () => void mutate("automation", { action: "sync" }) : undefined} timeZone={timeZone} /> : resource === "activity" ? (
    <section className={`${styles.panel} ${styles.activityPanel}`}>
      <div className={styles.panelHeading}>
        <div><h2>Workspace timeline</h2><p role="status">{items.length} of {page.items.length} loaded · {timeZone}</p></div>
        <label className={styles.recordsSearch}>
          <Search size={17} />
          <span className="sr-only">Search activity</span>
          <input className={styles.recordsSearchInput} type="search" placeholder="Search activity…" value={query} onChange={event => setQuery(event.target.value)} />
        </label>
      </div>
      {items.length ? <ActivityTimeline events={items.map((item) => ({ id: item.id, action: str(item, "action"), occurredAt: str(item, "occurredAt"), kind: typeof item.details === "object" && item.details !== null && "kind" in item.details && typeof item.details.kind === "string" ? item.details.kind : undefined }))} timeZone={timeZone} /> : query ? <div className={styles.panelFoot}>No activity matches your search.</div> : <ActivityEmpty />}
      {message && <InlineFeedback tone="error">{message}</InlineFeedback>}
      {page.nextCursor && <button className={styles.secondary} disabled={busy} onClick={() => void more()}>{busy && <Spinner size={15} />}Load more</button>}
    </section>
  ) : resource === "jobs" ? <ProcessingActivity items={page.items} busy={busy} canManage={canManage} nextCursor={page.nextCursor} more={() => void more()} retry={(id) => void mutate("automation", { action: "retry", jobId: id })} feedback={message} failed={failed} timeZone={timeZone} /> : null;
  if (customView) return customView;

  const title = view?.title || titles[resource];
  const workflowList = resource === "workflows";
  const options = workflowList ? [
    { value: "all", label: "All workflows" },
    { value: "review", label: "Needs review" },
    { value: "deals", label: "Deals & agreements" },
    { value: "payments", label: "Invoices & payouts" },
    { value: "drafts", label: "Drafts" },
  ] : resource === "notifications" ? [{ value: "all", label: "All notifications" }, { value: "unread", label: "Unread" }] : [];
  const filtered = !!search || (filter !== "all" && page.items.length > 0);
  const activeFilter = options.find(option => option.value === filter)?.label;

  return (
    <section className={styles.recordsPanel} aria-busy={busy} aria-label={title}>
      <div className={styles.recordsHeading}>
        <div>
          <h2>{title}</h2>
          <p role="status">{items.length} shown · {page.items.length} loaded{page.nextCursor ? " · more available" : ""}{busy ? " · Updating…" : ""}</p>
        </div>
        {workflowList && <span className={styles.sandboxLabel}><ShieldCheck size={16} aria-hidden="true" /> PayPal sandbox</span>}
      </div>
      {workflowList && <p className={styles.recordsHint}>Verify the source and recipient before approval. Sending a verified invoice requires a separate approval.</p>}
      <div className={styles.recordsToolbar}>
        <label className={styles.recordsSearch}>
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search {title}</span>
          <input className={styles.recordsSearchInput} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${title.toLowerCase()}…`} />
        </label>
        {!!options.length && (
          <div className={styles.recordFilters} role="group" aria-label={`Filter ${title.toLowerCase()}`}>
            {options.map(option => (
              <button type="button" key={option.value} aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {message && <div className={styles.recordFeedback}><InlineFeedback tone={failed ? "error" : "success"}>{message}</InlineFeedback></div>}
      {!items.length ? (
        <div className={styles.recordsEmpty}>
          <EmptyState compact title={filtered ? "No matching records" : emptyTitles[resource] || "No records yet"}
            description={filtered
              ? page.nextCursor ? `No matches in the loaded records${activeFilter ? ` for ${activeFilter}` : ""}. Load more or clear the filters.` : "Try a different search or clear the filters."
              : workflowList ? "Proposals appear after financial email analysis. Check Activity if processing is waiting or needs attention." : "Records appear as workspace emails and connected tools are processed."}
            href={filtered ? undefined : "/dashboard/activity"} action="Check processing activity" />
          {filtered && <button className={styles.secondary} onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button>}
        </div>
      ) : (
        <ul className={styles.recordsList}>
          {items.map(item => {
            const date = str(item, "lastSeenAt") || str(item, "updatedAt");
            const updated = date ? <time className={styles.recordDate} dateTime={date}>{displayTime(date, timeZone, true)} · {timeZone}</time> : null;
            if (workflowList) {
              const proposal = item.proposal as Proposal | undefined;
              const Icon = proposal?.extraction?.category === "agreement" ? Handshake : ShieldCheck;
              return (
                <li key={item.id} className={styles.workflowCard}>
                  <details open={focusedWorkflow === item.id || undefined}>
                    <summary className={styles.workflowSummary}>
                      <span className={styles.recordIcon}><Icon size={20} aria-hidden="true" /></span>
                      <span className={styles.recordMain}>
                        <strong>{str(item, "counterparty") || "Financial proposal"}</strong>
                        <span>{proposal?.extraction?.reference || proposal?.extraction?.category?.replaceAll("_", " ") || "Financial workflow"}</span>
                      </span>
                      <StatusPill status={str(item, "status")} />
                      <strong className={styles.recordAmount}>{str(item, "amount") ? [str(item, "currency"), str(item, "amount")].filter(Boolean).join(" ") : "Amount uncertain"}</strong>
                      <ChevronDown className={styles.recordChevron} size={19} aria-hidden="true" />
                    </summary>
                    <div className={styles.workflowDetails}>
                      <WorkflowReview item={item} workspaceId={workspaceId} canApprove={canManage} busy={busy} mutate={mutate} />
                      {updated}
                    </div>
                  </details>
                </li>
              );
            }
            const Icon = recordIcons[resource as keyof typeof recordIcons] || FileText;
            const label = str(item, "displayName") || str(item, "filename") || str(item, "title") ||
              str(item, "channel") || str(item, "category")?.replaceAll("_", " ") || str(item, "email") || item.id;
            const status = resource === "notifications" ? item.read ? "read" : "unread" : str(item, "status");
            const bytes = Number(item.size);
            return (
              <li key={item.id} className={styles.recordRow}>
                <span className={styles.recordIcon}><Icon size={20} aria-hidden="true" /></span>
                <div className={styles.recordMain}>
                  <strong>{label}</strong>
                  {resource === "contacts" && label !== item.email && <span>{str(item, "email")}</span>}
                  {resource === "notifications" && <span>{str(item, "description")}</span>}
                  {resource === "documents" && Number.isFinite(bytes) && bytes >= 0 && <span>{Math.ceil(bytes / 1024)} KiB</span>}
                  {resource === "analyses" && <details><summary>Review proposal &amp; supporting evidence</summary><FinancialEvidence proposal={item.result} /></details>}
                </div>
                <div className={styles.recordAside}>
                  {status && <StatusPill status={status} />}
                  {updated}
                </div>
                {resource === "documents" && (item.status === "stored" ? (
                  <a className={styles.secondary} href={`/api/workspaces/${workspaceId}/documents/${item.id}`}>Download</a>
                ) : canManage && (
                  <button className={styles.secondary} disabled={busy} onClick={() => void mutate(`documents/${item.id}`, {})}>Import attachment</button>
                ))}
                {resource === "notifications" && !item.read && (
                  <button className={styles.secondary} disabled={busy} onClick={() => void mutate(`notifications/${item.id}`, {})}>Mark read</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {page.nextCursor && <div className={styles.recordsFooter}><button className={styles.secondary} disabled={busy} onClick={() => void more()}>{busy && <Spinner size={15} />}Load more</button></div>}
    </section>
  );
}

const workflowNextStep: Record<string, string> = {
  pending_approval: "Next: verify source evidence, amount and customer email before authorizing this exact sandbox draft.",
  needs_review: "Manual review required. Approval is unavailable until the proposal is safe to authorize.",
  duplicate_review: "Possible duplicate. Review the matching workflow before creating another draft.",
  reconciliation_required: "Recovery required. Verify an existing sandbox invoice below; do not create a replacement.",
  draft_created: "Sandbox draft created. This is not a sent invoice or proof of payment.",
  approved: "Approval recorded. Check Activity for draft creation progress.",
  rejected: "Proposal rejected. No new authorization is granted by this record.",
};
function WorkflowReview({item, workspaceId, canApprove, busy, mutate}: {item: Item; workspaceId: string; canApprove: boolean; busy: boolean; mutate: (path: string, body: Record<string, unknown>) => Promise<void>}) {
  const sendReview = item.sendReview as {snapshotHash:string; expiresAt:string; snapshot:{providerId:string; invoice:{amount?:{currency_code:string;value:string};primary_recipients?:{billing_info?:{email_address?:string}}[]; detail?:{reference?:string;invoice_date?:string}}}} | null;
  const [recipient, setRecipient] = useState(""), [recoveryId, setRecoveryId] = useState("");
  const [revisedAmount, setRevisedAmount] = useState("");
  const payout = item.action === "pay_supplier" || (item.proposal as Proposal | undefined)?.intendedAction === "pay_supplier";
  const providerId = str(item, "providerId");
  return <div className={styles.workflowReview}>
    <div className={styles.reviewGuide}>
      <ShieldCheck size={19} />
      <div><p className={styles.operationLabel}>{str(item,"action").replaceAll("_"," ") || "Financial review"}</p>
      {workflowNextStep[str(item, "status")] && <p className={styles.reviewNextStep}>{payout && item.status === "pending_approval"
      ? "Verify the quoted amount and supplier PayPal email before authorizing this sandbox payout."
      : payout && item.status === "approved" ? "Approval recorded. Check Activity for payout progress."
      : workflowNextStep[str(item, "status")]}</p>}
      {providerId && <p className={styles.providerReference}>PayPal sandbox {payout ? "payout batch" : "invoice"} <code>{providerId}</code></p>}</div>
    </div>
    <div className={styles.reviewColumns}>
    <section className={styles.evidencePanel} aria-label="Proposal evidence">
      <FinancialEvidence proposal={item.proposal} />
      <Link className={styles.evidenceSource} href="/dashboard/inbox">Review source communication <ArrowUpRight size={13} /></Link>
    </section>
    <section className={styles.decisionPanel} aria-label="Workflow decision">
    <h3>{canApprove && ["pending_approval", "needs_review", "duplicate_review"].includes(str(item, "status")) ? "Make a decision" : "Provider status & actions"}</h3>
    {canApprove && payout && str(item, "status").startsWith("payout_") && <form onSubmit={event => {
      event.preventDefault();
      void mutate(`workflows/${item.id}`, {action: "verify_payout", providerId: providerId || recoveryId});
    }}>
      {!providerId && <label>Existing payout batch ID<input required pattern="[A-Z0-9]{1,30}" value={recoveryId} onChange={event => setRecoveryId(event.target.value)} /></label>}
      <button disabled={busy}>Verify payout status</button>
    </form>}
    {canApprove && item.status === "reconciliation_required" && <form onSubmit={(event) => { event.preventDefault(); void mutate(`workflows/${item.id}`, { action: "recover", providerId: recoveryId }); }}><label>Existing sandbox invoice ID<input required pattern="INV2-[A-Z0-9-]{8,100}" value={recoveryId} onChange={event => setRecoveryId(event.target.value)} /></label><p>Verify and bind an existing invoice under the original account. No replacement invoice is created.</p><button disabled={busy}>Verify existing invoice</button></form>}
    {item.action === "review" && ["draft_created", "send_approved"].includes(str(item, "status")) && <p>Sending is on hold. Review the conflicting obligation evidence.</p>}
    {canApprove && item.status === "draft_created" && item.action !== "review" && <div><button disabled={busy} onClick={() => void mutate("workflows/"+item.id,{action:"review_send"})}>Verify unsent sandbox invoice for separate send approval</button>{sendReview && <form onSubmit={event=>{event.preventDefault();void mutate("workflows/"+item.id,{action:"approve_send",snapshotHash:sendReview.snapshotHash});}}><p>Send existing sandbox invoice {sendReview.snapshot.providerId} to {sendReview.snapshot.invoice.primary_recipients?.[0]?.billing_info?.email_address} · {sendReview.snapshot.invoice.amount?.currency_code} {sendReview.snapshot.invoice.amount?.value}. Reference: {sendReview.snapshot.invoice.detail?.reference}. Issue date: {sendReview.snapshot.invoice.detail?.invoice_date || "current date"}. Future issue dates schedule delivery.</p><p>Sandbox application credentials are bound; merchant account identity is not independently verified. This separate approval authorizes PayPal to email the customer and merchant. It does not charge the customer. Review expires: {sendReview.expiresAt}.</p><p>Only approval-critical invoice fields are shown. Additional provider account details remain private.</p><button className={styles.workflowPrimary} disabled={busy}>Approve sending this exact sandbox invoice</button>
      <button type="button" disabled={busy} onClick={() => void mutate("slack-identity", {action: "prepare-send", workflowId: item.id, snapshotHash: sendReview.snapshotHash})}>Send approval card to Slack</button></form>}</div>}
    {canApprove && ["send_reconciliation_required","send_approved"].includes(str(item,"status")) && <div><p>Send authorized or uncertain. Never resend. Verify the existing invoice using GET-only recovery.</p><button disabled={busy} onClick={()=>void mutate("workflows/"+item.id,{action:"recover_send"})}>Reconcile existing send (read only)</button></div>}
    {typeof item.paymentLink === "string" && ["invoice_sent","unpaid","payment_pending","partially_paid"].includes(str(item,"status")) && <a href={item.paymentLink} target="_blank" rel="noopener noreferrer">Open verified PayPal sandbox payment link</a>}
    {item.status === "paid" && <p>PayPal reports PAID. Sandbox only; no live settlement.</p>}
    {item.status === "externally_marked_paid" && <p>Merchant manually marked paid; not verified payer settlement.</p>}
    {canApprove && ["pending_approval","needs_review","duplicate_review"].includes(str(item,"status")) && <div>
      {item.status === "pending_approval" && <form onSubmit={(event) => { event.preventDefault(); void mutate(`workflows/${item.id}`, {action:"approve", proposalHash:item.proposalHash, recipientEmail:recipient}); }}>
        <label>{payout ? "Supplier PayPal email" : "Customer email for this draft"}<input type="email" required maxLength={payout ? 127 : 254} value={recipient} onChange={(event) => setRecipient(event.target.value)} /></label>
        <p>{payout ? "Approval sends the exact listed amount to this supplier in PayPal sandbox." : "Approval creates the proposed PayPal sandbox draft invoice for this customer. It does not send the invoice or move money."}</p>
        <button className={styles.workflowPrimary} disabled={busy}>{busy && <Spinner size={15}/>} {payout ? "Approve exact sandbox payout" : "Approve exact draft invoice"}</button>
      </form>}
      {item.status === "pending_approval" && <details className={styles.reviseAmount}>
        <summary><Pencil size={15} /> Change amount <ChevronDown size={13} /></summary>
        <form onSubmit={event => {
          event.preventDefault();
          void mutate(`workflows/${item.id}`, {action: "revise_amount", amount: revisedAmount, proposalHash: item.proposalHash});
        }}>
        <label>Change amount ({str(item, "currency")})<input required inputMode="decimal" value={revisedAmount} onChange={event => setRevisedAmount(event.target.value)} /></label>
        <p>Use an amount from the quoted evidence. A change requires a fresh approval.</p>
        <button disabled={busy}>Save revised amount</button>
      </form></details>}
      <div className={styles.decisionActions}>
        <Link href={`/workspaces/${encodeURIComponent(workspaceId)}/slack-identity?workflowId=${encodeURIComponent(item.id)}`}>Prepare decision in Slack <ArrowUpRight size={13} /></Link>
        <button className={styles.rejectDecision} disabled={busy} onClick={() => void mutate(`workflows/${item.id}`, {action:"reject", proposalHash:item.proposalHash})}>{busy && <Spinner size={15}/>} Reject proposal</button>
      </div>
    </div>}
    {!canApprove && <small>Only the workspace owner can approve financial actions.</small>}
    </section>
    </div>
  </div>;
}
type Proposal = { intendedAction?: string; triage?: { reasons?: string[]; senderHistory?: { senderEmail?: string; coverageLimited?: boolean; matches?: { messageId: string; category: string; reference?: string }[] } }; consequence?: string; duplicateOf?: string; agreementWorkflowId?: string; warnings?: string[]; extraction?: { category?: string; purpose?: string; reference?: string; dueDate?: string; direction?: string; confidence?: number; evidence?: {sourceId: string; quote: string}[]; uncertainties?: string[] } };
function FinancialEvidence({proposal}: {proposal: unknown}) {
  const data = (proposal || {}) as Proposal, extracted = data.extraction;
  return <div className={styles.evidenceContent}>
    <h3>Proposal &amp; evidence</h3>
    <p className={styles.evidencePurpose}>{extracted?.purpose || "Purpose requires review."}</p>
    {data.consequence && <p>{data.consequence}</p>}
    <dl className={styles.evidenceFacts}>
      <div><dt>Category</dt><dd>{extracted?.category?.replaceAll("_", " ") || "Unconfirmed"}</dd></div>
      <div><dt>Direction</dt><dd>{extracted?.direction || "Uncertain"}</dd></div>
      {extracted?.reference && <div><dt>Reference</dt><dd>{extracted.reference}</dd></div>}
      {extracted?.dueDate && <div><dt>Due date</dt><dd>{extracted.dueDate}</dd></div>}
    </dl>
    <details className={styles.evidenceDetails}><summary>Extraction notes &amp; source excerpts <ChevronDown size={13} /></summary>
    {data.triage?.reasons?.length ? <p>Flagged for review: {data.triage.reasons.map(reason => ({ financial_content: "financial content", uncertain_content: "content needing clarification", sender_financial_history: "prior financial history from this sender", financial_attachment: "a financial attachment", unreadable_attachment: "an attachment requiring manual review" })[reason] || "manual review").join(", ")}.</p> : null}
    {data.triage?.senderHistory?.matches?.length ? <p>Sender history: {data.triage.senderHistory.matches.length} prior financial messages matched the reported email address. This context requires confirmation.{data.triage.senderHistory.coverageLimited ? " The history search reached its limit." : ""}</p> : null}
    <p>Extraction confidence: {typeof extracted?.confidence === "number" ? Math.round(extracted.confidence * 100) + "%" : "Not available"}. Model confidence does not verify an obligation.</p>
    {extracted?.evidence?.map((e, index) => <blockquote key={index} className={styles.evidenceQuote}>{e.quote}<footer><small>Source: {e.sourceId}</small></footer></blockquote>)}
    {[...(data.warnings || []), ...(extracted?.uncertainties || [])].map((warning, index) => <p key={index}>Needs review: {warning}</p>)}
    </details>
    {data.agreementWorkflowId && <p><Link href={{ pathname: "/dashboard/approvals", query: { workflow: data.agreementWorkflowId } }}>Review the related agreement</Link></p>}
    {data.duplicateOf && <p><Link href={{ pathname: "/dashboard/approvals", query: { workflow: data.duplicateOf } }}>Review the matching workflow</Link> before creating another financial action.</p>}
  </div>;
}
