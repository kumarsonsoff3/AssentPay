"use client";
import { useToast } from "@/components/feedback/toast-provider";
import { InlineFeedback } from "@/components/feedback/feedback";
import { requestErrorMessage } from "@/lib/request-feedback";
import { Spinner } from "@/components/feedback/feedback";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";
import { ProcessingActivity } from "./processing-activity";
import { ConversationWorkspace } from "./conversation-workspace";
import { ActivityTimeline, ActivityEmpty } from "./workspace-presenters";
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
export function LiveResource({
  workspaceId,
  resource,
  initial,
  canManage,
  timeZone = "UTC",
}: {
  workspaceId: string;
  resource: Resource;
  initial: ResourcePage;
  canManage: boolean;
  timeZone?: string;
}) {
  const notify = useToast();
  const router = useRouter(),
    [loaded, setLoaded] = useState<ResourcePage | null>(null),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false);
  const page = loaded || initial;
  const items = useMemo(
    () =>
      page.items.filter((item) => {
        const matches = JSON.stringify(item)
          .toLowerCase()
          .includes(query.toLowerCase());
        return (
          matches &&
          (filter !== "unread" ||
            item.unread === true ||
            item.read === false) &&
          (filter !== "financial" || item.financial === true) &&
          (filter !== "failed" || item.status === "failed")
        );
      }),
    [page.items, query, filter],
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
    if (!page.nextCursor) return;
    setBusy(true);
    try {
      const response = await fetch(
          `/api/workspaces/${workspaceId}/resources/${resource}?cursor=${encodeURIComponent(page.nextCursor)}`,
        ),
        next = await response.json();
      if (!response.ok) throw new Error(next.error);
      setLoaded({
        items: [...page.items, ...next.items],
        nextCursor: next.nextCursor,
      });
    } catch {
      setFailed(true);
      setMessage("We couldn’t load more items. Select Load more to try again.");
    } finally {
      setBusy(false);
    }
  }
  const customView = resource === "messages" ? <ConversationWorkspace items={page.items} nextCursor={page.nextCursor} busy={busy} more={() => void more()} feedback={message} feedbackFailed={failed} sync={canManage && process.env.NEXT_PUBLIC_GMAIL_OAUTH_ENABLED === "true" ? () => void mutate("automation", { action: "sync" }) : undefined} timeZone={timeZone} /> : resource === "activity" ? (
    <section className={styles.panel}>
      <div className={styles.panelHeading}><h2>Workspace activity</h2><span>{page.items.length} recent events</span></div>
      <div className={styles.resourceToolbar}><label className={styles.search}><span className="sr-only">Search activity</span><input type="search" placeholder="Search activity…" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
      {items.length ? <ActivityTimeline events={items.map((item) => ({ id: item.id, action: str(item, "action"), occurredAt: str(item, "occurredAt"), kind: typeof item.details === "object" && item.details !== null && "kind" in item.details && typeof item.details.kind === "string" ? item.details.kind : undefined }))} timeZone={timeZone} /> : query ? <div className={styles.panelFoot}>No activity matches your search.</div> : <ActivityEmpty />}
      {message && <InlineFeedback tone="error">{message}</InlineFeedback>}
      {page.nextCursor && <button className={styles.secondary} disabled={busy} onClick={() => void more()}>{busy && <Spinner size={15} />}Load more</button>}
    </section>
  ) : resource === "jobs" ? <ProcessingActivity items={page.items} busy={busy} canManage={canManage} nextCursor={page.nextCursor} more={() => void more()} retry={(id) => void mutate("automation", { action: "retry", jobId: id })} feedback={message} failed={failed} timeZone={timeZone} /> : null;
  if (customView) return customView;
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}>
        <h2>{titles[resource]}</h2>

      </div>
      <div className={styles.resourceToolbar}>
        <label className={styles.search}>
          <span className="sr-only">Search {titles[resource]}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${titles[resource].toLowerCase()}…`}
          />
        </label>
        <label>
          <span className="sr-only">Filter</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All records</option>
            {resource === "notifications" && (
              <option value="unread">Unread</option>
            )}
            {resource === "jobs" && <option value="failed">Failed</option>}
          </select>
        </label>
      </div>
      {message && (
        <InlineFeedback tone={failed ? "error" : "success"}>{message}</InlineFeedback>
      )}
      <div className={styles.resultsMeta}>{items.length} records loaded</div>
      {!items.length ? (
        <div className={styles.panelFoot}>
          No records in this view yet.
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Record</th>
                <th>Status / details</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                      <strong>
                        {str(item, "displayName") ||
                          str(item, "filename") ||
                          str(item, "title") ||
                          str(item, "action") ||
                          str(item, "kind") || str(item, "channel") || str(item, "category") || str(item, "sourceId")}
                      </strong>

                  </td>
                  <td>
                    {resource === "workflows" ? (
                      <WorkflowReview item={item} workspaceId={workspaceId} canApprove={canManage} busy={busy} mutate={mutate} />
                    ) : resource === "memory" || resource === "analyses" ? (
                      <><p>{str(item, "status")}</p>{resource === "analyses" ? <FinancialEvidence proposal={item.result} /> : <MemoryFacts value={item.facts} />}{resource === "memory" && canManage && item.status === "active" && <button disabled={busy} onClick={() => void mutate(`memory/${item.id}`, {action:"forget"})}>{busy && <Spinner size={15}/>} Forget this memory</button>}</>
                    ) : resource === "contacts" ? (
                      str(item, "email")
                    ) : resource === "documents" ? (
                      <>
                        {str(item, "status")} ·{" "}
                        {Math.ceil(Number(item.size) / 1024)} KiB
                        <br />
                        {item.status === "stored" ? (
                          <a
                            href={`/api/workspaces/${workspaceId}/documents/${item.id}`}
                          >
                            Download
                          </a>
                        ) : (
                          canManage && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                void mutate(`documents/${item.id}`, {})
                              }
                            >{busy && <Spinner size={15}/>} 
                              Import attachment
                            </button>
                          )
                        )}
                      </>
                    ) : resource === "deliveries" ? (
                      <>{str(item, "channel")} · {str(item, "status").replaceAll("_", " ")}</>
                    ) : resource === "jobs" ? (
                      <>
                        {str(item, "status")} · {Number(item.attempts)} attempts
                        <br />
                        {str(item, "errorCode")}
                        {canManage &&
                          ["failed", "cancelled"].includes(
                            str(item, "status"),
                          ) && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                void mutate("automation", {
                                  action: "retry",
                                  jobId: item.id,
                                })
                              }
                            >{busy && <Spinner size={15}/>} 
                              Retry
                            </button>
                          )}
                      </>
                    ) : resource === "notifications" ? (
                      <>
                        {str(item, "description")}
                        <br />
                        {item.read ? (
                          "Read"
                        ) : (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void mutate(`notifications/${item.id}`, {})
                            }
                          >{busy && <Spinner size={15}/>} 
                            Mark read
                          </button>
                        )}
                      </>
                    ) : (
                      str(item, "entityId")
                    )}
                  </td>
                  <td>
                    <time>
                      {(
                        str(item, "receivedAt") ||
                        str(item, "occurredAt") ||
                        str(item, "lastSeenAt") ||
                        str(item, "updatedAt")
                      )
                        .slice(0, 16)
                        .replace("T", " ")}{" "}
                      UTC
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {page.nextCursor && (
        <button
          className={styles.secondary}
          disabled={busy}
          onClick={() => void more()}
        >{busy && <Spinner size={15}/>} 
          Load more
        </button>
      )}
    </section>
  );
}

function WorkflowReview({item, canApprove, busy, mutate}: {item: Item; workspaceId: string; canApprove: boolean; busy: boolean; mutate: (path: string, body: Record<string, unknown>) => Promise<void>}) {
  const [recipient, setRecipient] = useState("");
  return <div style={{maxWidth:620}}>
    <strong>{str(item,"currency")} {str(item,"amount") || "Amount uncertain"} · {str(item,"counterparty")}</strong>
    <p>{str(item,"status").replaceAll("_"," ")} · {str(item,"action").replaceAll("_"," ")}</p>
    {str(item,"providerId") && <p>PayPal sandbox invoice: <code>{str(item,"providerId")}</code></p>}
    <FinancialEvidence proposal={item.proposal} />
    <Link href="/dashboard/inbox">Review source communication</Link>
    {canApprove && ["pending_approval","needs_review","duplicate_review"].includes(str(item,"status")) && <div>
      {item.status === "pending_approval" && <form onSubmit={(event) => { event.preventDefault(); void mutate(`workflows/${item.id}`, {action:"approve", proposalHash:item.proposalHash, recipientEmail:recipient}); }}>
        <label>Customer email for this draft<input type="email" required maxLength={254} value={recipient} onChange={(event) => setRecipient(event.target.value)} /></label>
        <p>Approval creates the proposed PayPal sandbox draft invoice for this customer. It does not send the invoice or move money.</p>
        <button className={styles.secondary} disabled={busy}>{busy && <Spinner size={15}/>} Approve exact draft invoice</button>
      </form>}
      <button disabled={busy} onClick={() => void mutate(`workflows/${item.id}`, {action:"reject", proposalHash:item.proposalHash})}>{busy && <Spinner size={15}/>} Reject proposal</button>
    </div>}
    {!canApprove && <small>Only the workspace owner can approve financial actions.</small>}
  </div>;
}
type Proposal = { triage?: { reasons?: string[]; senderHistory?: { senderEmail?: string; coverageLimited?: boolean; matches?: { messageId: string; category: string; reference?: string }[] } }; consequence?: string; duplicateOf?: string; warnings?: string[]; extraction?: { category?: string; purpose?: string; reference?: string; dueDate?: string; direction?: string; confidence?: number; evidence?: {sourceId: string; quote: string}[]; uncertainties?: string[] } };
function FinancialEvidence({proposal}: {proposal: unknown}) {
  const data = (proposal || {}) as Proposal, extracted = data.extraction;
  return <details><summary>Review proposal & supporting evidence</summary>
    <p>{data.consequence}</p><p>{extracted?.purpose || "Purpose requires review."}</p>
    <p>Category: {extracted?.category?.replaceAll("_", " ")} · Direction: {extracted?.direction || "uncertain"}</p>
    {extracted?.reference && <p>Reference: {extracted.reference}</p>}{extracted?.dueDate && <p>Due date: {extracted.dueDate}</p>}
    {data.triage?.reasons?.length ? <p>Flagged for review: {data.triage.reasons.map(reason => ({ financial_content: "financial content", uncertain_content: "content needing clarification", sender_financial_history: "prior financial history from this sender", financial_attachment: "a financial attachment", unreadable_attachment: "an attachment requiring manual review" })[reason] || "manual review").join(", ")}.</p> : null}
    {data.triage?.senderHistory?.matches?.length ? <p>Sender history: {data.triage.senderHistory.matches.length} prior financial messages matched the reported email address. This context requires confirmation.{data.triage.senderHistory.coverageLimited ? " The history search reached its limit." : ""}</p> : null}
    <p>Extraction confidence: {Math.round((extracted?.confidence || 0) * 100)}%. Model confidence does not verify an obligation.</p>
    {extracted?.evidence?.map((e, index) => <blockquote key={index} style={{whiteSpace:"pre-wrap",borderLeft:"2px solid #aaa",paddingLeft:12}}>{e.quote}<footer><small>Source: {e.sourceId}</small></footer></blockquote>)}
    {[...(data.warnings || []), ...(extracted?.uncertainties || [])].map((warning, index) => <p key={index}>Needs review: {warning}</p>)}
    {data.duplicateOf && <p>Potential duplicate of workflow <code>{data.duplicateOf}</code>. Resolve it before creating another financial action.</p>}
  </details>;
}
function MemoryFacts({value}: {value: unknown}) {
  const facts = (value || {}) as Record<string, unknown>;
  return <details><summary>Review remembered context</summary><p>Extracted context requires confirmation and never grants payment authority.</p><dl>{["category", "counterparty", "reference", "amount", "currency"].map((key) => <div key={key}><dt>{key}</dt><dd>{typeof facts[key] === "string" ? String(facts[key]) : "Unknown"}</dd></div>)}</dl></details>;
}
