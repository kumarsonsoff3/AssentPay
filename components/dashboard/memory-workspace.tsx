"use client";
import { SelectField } from "@/components/controls/select-field";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BrainCircuit, ChevronDown, Clock3, Mail, Pause, Pencil, Play, Search, ShieldCheck, Trash2 } from "@/components/icons";
import { InlineFeedback, Spinner } from "@/components/feedback/feedback";
import { displayTime } from "./workspace-presenters";
import { EmptyState } from "./states";
import styles from "./dashboard.module.css";
import ui from "./memory-workspace.module.css";

type Item = Record<string, unknown> & { id: string };
type Mutate = (path: string, body: Record<string, unknown>) => Promise<void>;
const text = (value: unknown) => typeof value === "string" ? value : "Unknown";
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const statusOf = (item: Item) => item.status === "forgotten" ? "forgotten" : item.expired ? "expired" : text(item.status);
const extractionKeys = ["category", "counterparty", "reference", "amount", "currency"] as const;
const contextKeys = ["counterparty", "reference", "note"] as const;

export function MemoryWorkspace({ items, canManage, busy, feedback, failed, timeZone, nextCursor, more, mutate }: {
  items: Item[]; canManage: boolean; busy: boolean; feedback: string; failed: boolean; timeZone: string; nextCursor: string | null;
  more: () => void; mutate: Mutate;
}) {
  const [query, setQuery] = useState(""), [filter, setFilter] = useState("all");
  const term = query.trim().toLowerCase();
  const shown = items.filter(item => (!term || JSON.stringify([item.facts, item.sourceId]).toLowerCase().includes(term)) && (filter === "all" || statusOf(item) === filter));
  const filtered = !!term || filter !== "all";
  return <section className={`${styles.panel} ${ui.workspace}`} aria-busy={busy}>
    <div className={ui.toolbar}>
      <label className={`${styles.recordsSearch} ${ui.search}`}>
        <Search size={17} />
        <span className="sr-only">Search memory</span>
        <input className={styles.recordsSearchInput} type="search" placeholder="Search facts or source IDs…" value={query} onChange={event => setQuery(event.target.value)} />
      </label>
      <label><span className="sr-only">Memory status</span><SelectField value={filter} onValueChange={setFilter} options={["all", "active", "paused", "expired", "forgotten"].map(value => ({ value, label: value === "all" ? "All statuses" : value[0].toUpperCase() + value.slice(1) }))} /></label>
      {filtered && <button className={ui.button} onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button>}
    </div>
    <details className={ui.policy}>
      <summary><ShieldCheck size={17} /> What memory can change <ChevronDown size={12} /></summary>
      <p>Memory is context for the agent. Corrections do not change source evidence, approvals, payments, duplicate-prevention claims or audit records. Forgetting clears stored facts and excludes the source from AI history; it does not delete the source email.</p>
    </details>
    {feedback && <InlineFeedback tone={failed ? "error" : "success"}>{feedback}{failed && " Reload to get the latest version before retrying a conflicting change."}</InlineFeedback>}
    {(items.length > 0 || filtered || busy) && <p className={ui.results} role="status">{shown.length} of {items.length} loaded{busy ? " · Updating…" : ""}</p>}
    {!shown.length ? <EmptyState compact title={filtered ? "No matching memories" : "No active memories"} description={filtered ? "Try a different search or clear the filters." : "Extracted context appears here with its source, status and expiry."} /> : <div className={ui.grid}>{shown.map(item => <MemoryCard key={item.id + text(item.version)} item={item} canManage={canManage} busy={busy} timeZone={timeZone} mutate={mutate} />)}</div>}
    {!canManage && <p className={ui.help}>Only workspace owners and admins can correct, pause, resume or forget memory.</p>}
    {nextCursor && <button className={ui.button} disabled={busy} onClick={more}>{busy && <Spinner size={15} />}Load more</button>}
  </section>;
}

function Facts({ values, keys }: { values: Record<string, unknown>; keys: readonly string[] }) {
  const present = keys.filter(key => typeof values[key] === "string" && values[key]);
  return present.length ? <dl className={ui.facts}>{present.map(key => <div key={key} data-wide={key === "note"}><dt>{key}</dt><dd>{text(values[key])}</dd></div>)}</dl> : <p className={ui.help}>No details were recorded.</p>;
}

function MemoryCard({ item, canManage, busy, timeZone, mutate }: { item: Item; canManage: boolean; busy: boolean; timeZone: string; mutate: Mutate }) {
  const facts = record(item.facts), context = record(facts.userContext), corrected = !!facts.userContext;
  const [panel, setPanel] = useState<"edit" | "resume" | "forget" | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const initialValues = { counterparty: typeof context.counterparty === "string" ? context.counterparty : typeof facts.counterparty === "string" ? facts.counterparty : "", reference: typeof context.reference === "string" ? context.reference : typeof facts.reference === "string" ? facts.reference : "", note: typeof context.note === "string" ? context.note : "" };
  const [values, setValues] = useState(initialValues);
  const status = statusOf(item), forgotten = status === "forgotten", editable = !forgotten && status !== "expired";
  const openPanel = (next: typeof panel) => {
    setConfirmed(false);
    if (next === "edit") setValues(initialValues);
    setPanel(panel === next ? null : next);
  };
  const change = (action: string, extra = {}) => mutate("memory/" + item.id, { action, version: item.version, ...extra });
  return <article className={ui.card}>
    <header className={ui.heading}>
      <span className={ui.cardIcon}><BrainCircuit size={20} /></span>
      <div><h3>{forgotten ? "Forgotten memory" : text(context.counterparty || facts.counterparty || facts.category || "Remembered context")}</h3>
        {!forgotten && <p>{corrected ? "User-corrected context" : "AI-extracted · unconfirmed"}</p>}
      </div>
      <span className={ui.status} data-status={status}>{status}</span>
    </header>
    <div className={ui.cardBody}>
      {forgotten ? <p className={ui.help}>Facts erased. This memory cannot be restored.</p> : <>
        <Facts keys={corrected ? contextKeys : extractionKeys} values={corrected ? context : facts} />
        {corrected && <details className={ui.original}><summary>Original extraction <ChevronDown size={12} /></summary><p className={ui.help}>Unconfirmed source context, retained separately for review.</p><Facts keys={extractionKeys} values={facts} /><p className={ui.help}>Corrected by {text(context.correctedBy)} · {displayTime(text(context.correctedAt), timeZone, true)}</p></details>}
      </>}
      <div className={ui.source}>
        <div><Clock3 size={15} /><span>Expires: {displayTime(text(item.expiresAt), timeZone, true)} · {timeZone}</span></div>
        <div><Mail size={15} /><span>Source: <code>{text(item.sourceId)}</code></span></div>
        <Link href="/dashboard/inbox">Review source communication <ArrowUpRight size={12} /></Link>
      </div>
    </div>
    {canManage && !forgotten && <div className={ui.actions}>
      {editable && <><button className={ui.button} disabled={busy} aria-expanded={panel === "edit"} onClick={() => openPanel("edit")}><Pencil size={15} /> Correct context</button>
        {status === "active" && <button className={ui.quiet} disabled={busy} onClick={() => { setPanel(null); void change("pause"); }}><Pause size={13} /> Pause memory</button>}
        {status === "paused" && <button className={ui.quiet} disabled={busy} aria-expanded={panel === "resume"} onClick={() => openPanel("resume")}><Play size={13} /> Resume memory</button>}
      </>}
      <button className={ui.dangerText} disabled={busy} aria-expanded={panel === "forget"} onClick={() => openPanel("forget")}><Trash2 size={15} /> Forget this memory</button>
    </div>}
    {canManage && panel === "edit" && editable && <form className={ui.form} onSubmit={event => { event.preventDefault(); void change("correct", { context: values }); }}>
      <h4>Correct user context</h4><p>Changes only affect what the agent remembers. Amounts, currency and source evidence stay as recorded.</p>
      <div className={ui.fields}>{contextKeys.map(key => <label key={key} data-wide={key === "note"}>{key}{key === "note" ?
        <textarea maxLength={500} rows={3} value={values.note} onChange={event => setValues({ ...values, note: event.target.value })} /> :
        <input maxLength={500} value={values[key]} onChange={event => setValues({ ...values, [key]: event.target.value })} />}</label>)}</div>
      <div className={ui.formActions}><button className={ui.primary} disabled={busy}>Save corrected context</button><button className={ui.quiet} type="button" disabled={busy} onClick={() => setPanel(null)}>Cancel correction</button></div>
    </form>}
    {canManage && !forgotten && (panel === "forget" || (panel === "resume" && editable)) && <form className={ui.confirmation} data-danger={panel === "forget"} onSubmit={event => { event.preventDefault(); if (confirmed) void change(panel, { confirmed: true }); }}>
      <h4>{panel === "forget" ? "Permanently forget these facts?" : "Resume this memory?"}</h4>
      <p>{panel === "forget" ? "Stored facts are erased and cannot be restored. The original communication and financial audit records are retained." : "The agent can use this unexpired context again. Your action will be audited."}</p>
      <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required /> I understand and confirm</label>
      <div className={ui.formActions}><button className={panel === "forget" ? ui.danger : ui.primary} disabled={busy || !confirmed}>{panel === "forget" ? "Confirm forget" : "Confirm resume"}</button><button className={ui.quiet} type="button" disabled={busy} onClick={() => setPanel(null)}>Cancel</button></div>
    </form>}
  </article>;
}
