"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowDown, CircleCheck, Clock3, ChevronDown, FileText, Inbox, RefreshCw, Search, ShieldCheck, Sparkles, TriangleAlert } from "@/components/icons";
import { InlineFeedback, Spinner } from "@/components/feedback/feedback";
import { displayTime } from "./workspace-presenters";
import ui from "./workspace-content.module.css";
type Task = Record<string, unknown> & { id: string };
const progress = (item: Task) => item.processing as { label?: string; reason?: string; nextStep?: string; needsAttention?: boolean } | undefined;
const tasks: Record<string, { title: string; detail: string; icon: typeof Inbox; tone: string }> = {
  "resend-ingest": { title: "Receive forwarded email", detail: "Add an incoming email and supported attachments to the workspace, or extract a Gmail forwarding confirmation.", icon: Inbox, tone: "blue" },
  "financial-analyze": { title: "Review financial details", detail: "Look for amounts, due dates and agreements in received emails. Any proposed financial action needs your review.", icon: Sparkles, tone: "violet" },
  "document-import": { title: "Save an email attachment", detail: "Import a supported attachment so your team can review it in Documents.", icon: FileText, tone: "blue" },
  "gmail-sync": { title: "Update connected Gmail messages", detail: "Retrieve new messages from the Gmail account connected through Google sign-in.", icon: Inbox, tone: "blue" },
  "paypal-execute": { title: "Execute an approved PayPal action", detail: "Create the exact sandbox invoice draft or supplier payout approved by the workspace owner.", icon: ShieldCheck, tone: "green" },
  "paypal-payout-check": { title: "Verify a supplier payout", detail: "Read the sandbox payout status directly from PayPal and update the workflow.", icon: RefreshCw, tone: "blue" },
  "workflow-reminder": { title: "Remind the workspace owner", detail: "Deliver a Slack reminder if the proposal still needs review.", icon: Clock3, tone: "blue" },
  "paypal-reconcile": { title: "Check an invoice status", detail: "Check the invoice directly with PayPal and update the workspace record.", icon: RefreshCw, tone: "blue" },
  "slack-card-delivery": { title: "Deliver a Slack action card", detail: "Post a review card or update its status in Slack.", icon: CircleCheck, tone: "violet" },
  "financial-slack-notify": { title: "Notify the workspace owner", detail: "Send a financial review alert to the configured Slack channel, or privately to the owner when enabled.", icon: CircleCheck, tone: "violet" },
  "workflow-notify": { title: "Deliver a workspace update", detail: "Send a review or status notification through the workspace’s configured channels.", icon: CircleCheck, tone: "violet" },
  "provider-event": { title: "Record a connected tool update", detail: "Record an incoming status update from a connected tool in workspace activity.", icon: RefreshCw, tone: "blue" },
};
const statuses: Record<string, string> = { completed: "Completed", running: "In progress", queued: "Waiting to start", retry: "Will try again", failed: "Needs attention", cancelled: "Stopped" };
const filters = [
  { id: "all", title: "All tasks" },
  { id: "attention", title: "Needs attention" },
  { id: "active", title: "Pending" },
] as const;
const isPending = (item: Task) => ["queued", "running", "retry"].includes(String(item.status));
const needsAttention = (item: Task) => progress(item)?.needsAttention === true || item.status === "failed";

export function ProcessingActivity({ items, busy, canManage, nextCursor, more, retry, feedback, failed, timeZone = "UTC" }: {
  items: Task[];
  busy: boolean;
  canManage: boolean;
  nextCursor: string | null;
  more: () => void;
  retry: (id: string) => void;
  feedback: string;
  failed: boolean;
  timeZone?: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const search = query.trim().toLowerCase();
  const filtered = items.filter(item => {
    if (filter === "attention" && !needsAttention(item)) return false;
    if (filter === "active" && !isPending(item)) return false;
    const task = tasks[String(item.kind)];
    const state = progress(item);
    return [item.subject, task?.title || item.kind, task?.detail, state?.label, state?.reason]
      .some(value => typeof value === "string" && value.toLowerCase().includes(search)) || !search;
  });
  const waiting = items.filter(item => progress(item)?.label === "Waiting for a worker").length;
  const counts = { all: items.length, attention: items.filter(needsAttention).length, active: items.filter(isPending).length };

  return (
    <section className={ui.queue} aria-label="Email and workspace processing" aria-busy={busy}>
      <header className={ui.queueHeader}>
        <div><h2>Processing queue</h2><p>Track email imports, financial reviews, and connected tools.</p></div>
        <div className={ui.queueHeaderActions}>
          {counts.attention > 0 && <span className={`${ui.badge} ${ui.amber}`}>{`${counts.attention} need attention`}</span>}
          <Link href="/dashboard/integrations">Check connections</Link>
        </div>
      </header>
      {waiting > 0 && <div className={ui.queueWarning}>
        <TriangleAlert size={20} />
        <div><strong>{waiting} {waiting === 1 ? "task is" : "tasks are"} waiting for a worker</strong>
          <p>AssentPay’s background service hasn’t picked up these tasks yet. No approval is needed to start them. Ask an admin to check that background processing is running.</p>
        </div>
      </div>}
      <div className={ui.queueToolbar}>
        <label className={ui.search}><Search size={16} /><span className="sr-only">Search processing updates</span>
          <input type="search" placeholder="Search tasks or email subjects…" value={query} onChange={event => setQuery(event.target.value)} />
        </label>
        <div className={ui.queueFilters} role="group" aria-label="Filter processing updates">
          {filters.map(({ id, title }) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {title}<span>{counts[id]}</span>
          </button>)}
        </div>
      </div>
      {feedback && <InlineFeedback tone={failed ? "error" : "success"}>{feedback}</InlineFeedback>}
      <div className={ui.queueList}>
        {filtered.map(item => <ProcessingRow key={item.id} item={item} timeZone={timeZone} busy={busy} canManage={canManage} retry={retry} />)}
        {!filtered.length && <div className={ui.empty}>
          <Inbox size={25} /><h3>{items.length ? "No matching tasks" : "No tasks yet"}</h3>
          <p>{items.length ? "Try another search or filter." : "Email imports and financial reviews will appear here."}</p>
        </div>}
      </div>
      <footer className={ui.queueFooter}>
        <p role="status">{filtered.length} of {items.length} · loaded tasks only</p>
        {nextCursor && <button className={ui.loadMore} disabled={busy} onClick={more}>{busy ? <Spinner size={15} /> : <ArrowDown size={15} />}Load more tasks</button>}
        <Link href="/dashboard/approvals">Open financial reviews</Link>
      </footer>
    </section>
  );
}

function ProcessingRow({ item, timeZone, busy, canManage, retry }: {
  item: Task; timeZone: string; busy: boolean; canManage: boolean; retry: (id: string) => void;
}) {
  const kind = String(item.kind);
  const task = tasks[kind] || { title: "Workspace update", detail: "A saved task for your workspace.", icon: RefreshCw, tone: "blue" };
  const Icon = task.icon;
  const status = String(item.status);
  const state = progress(item);
  const StatusIcon = status === "completed" ? CircleCheck : needsAttention(item) ? TriangleAlert : Clock3;
  const label = state?.label || statuses[status] || "Status unavailable";
  const tone = status === "completed" ? ui.green : needsAttention(item) ? ui.amber : ui.blue;
  const waiting = label === "Waiting for a worker";
  const subject = typeof item.subject === "string" ? item.subject : "";
  return (
    <article className={ui.queueRow}>
      <span className={`${ui.eventIcon} ${ui[task.tone]}`}><Icon size={18} /></span>
      <div className={ui.queueBody}>
        <div className={ui.queueTitle}><h3>{task.title}</h3><span className={`${ui.badge} ${tone}`}><StatusIcon size={12} />{label}</span></div>
        {subject && <p className={ui.queueSubject}>{subject}</p>}
        {needsAttention(item) && !waiting && state?.reason && <p className={ui.queueReason}>{state.reason}</p>}
        <div className={ui.queueMeta}>
          <time dateTime={String(item.updatedAt)}>{displayTime(String(item.updatedAt), timeZone, true)} · {timeZone}</time>
          {status === "failed" && canManage && <button disabled={busy} onClick={() => retry(item.id)}>{busy ? <Spinner size={13} /> : <RefreshCw size={13} />}Try again</button>}
        </div>
        <details className={ui.queueDetails}>
          <summary>Task details <ChevronDown size={12} /></summary>
          <p>{task.detail}</p>
          {state?.reason && <p>{state.reason}</p>}
          {state?.nextStep && <p>{state.nextStep}</p>}
          {(status === "retry" || label === "Scheduled") && typeof item.nextAttemptAt === "string" && <p>Next attempt {displayTime(item.nextAttemptAt, timeZone, true)} · {timeZone}</p>}
          <dl><div><dt>Task type</dt><dd>{kind}</dd></div><div><dt>Reference</dt><dd>{item.id}</dd></div>
            {typeof item.errorCode === "string" && item.errorCode && <div><dt>Service error</dt><dd>{item.errorCode}</dd></div>}
          </dl>
        </details>
      </div>
    </article>
  );
}
