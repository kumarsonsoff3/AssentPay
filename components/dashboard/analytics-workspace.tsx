"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUpRight, ChartNoAxesCombined, CheckCircle2, ChevronDown, Clock3, FileText, Search, SlidersHorizontal, Sparkles } from "@/components/icons";
import { useRouter } from "next/navigation";
import { SelectField } from "@/components/controls/select-field";
import type { ColDef, GridApi, ICellRendererParams } from "ag-grid-community";
import {
  analyticsColumns,
  analyticsCsv,
  compareAnalyticsAmounts,
  analyticsViewSchema,
  defaultAnalyticsView,
  filterAnalyticsRows,
  type AnalyticsData,
  type AnalyticsRow,
  type AnalyticsView,
} from "@/lib/dashboard/analytics-model";
import styles from "./analytics-workspace.module.css";
const LedgerGrid = dynamic(() => import("./analytics-grid"), {
  ssr: false, loading: () => <p className={styles.gridLoading} role="status">Preparing workflow table…</p>,
});
const StudioWorkspace = dynamic(() => import("./studio-workspace").then(module => module.StudioWorkspace), {
  ssr: false, loading: () => <p className={styles.state} role="status">Loading AG Studio…</p>,
});
const studioEnabled = process.env.NODE_ENV !== "production" || Boolean(process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY);
const labels = { counterparty: "Counterparty", status: "Status", currency: "Currency", amount: "Amount", updatedAt: "Last updated (UTC)" };
const labelStatus = (value: string) => value ? value.replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase()) : "Unknown";
const statusTone = (value: string) => /^(paid|payout_paid)$/.test(value) ? "good"
  : /review|pending|hold|failed|reconciliation/.test(value) ? "attention"
  : /sent|approved|scheduled/.test(value) ? "info" : "neutral";
const amountLabel = (value: string) => {
  if (!/^\d+(?:\.\d+)?$/.test(value)) return value;
  const [whole, fraction] = value.split(".");
  return whole.replace(/\B(?=(\d{3})+$)/g, ",") + (fraction ? `.${fraction}` : "");
};
const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
const metrics = [
  { key: "collected", label: "Paid", help: "Reported paid by PayPal", Icon: CheckCircle2 },
  { key: "outstanding", label: "Outstanding", help: "Issued or scheduled invoices", Icon: Clock3 },
  { key: "drafts", label: "Drafts", help: "Created and still unsent", Icon: FileText },
] as const;
export function AnalyticsWorkspace({ workspaceId, data }: { workspaceId: string; data: AnalyticsData | null }) {
  const router = useRouter();
  const [retrying, retry] = useTransition();
  const [view, setView] = useState<AnalyticsView>({ ...defaultAnalyticsView }),
    [prompt, setPrompt] = useState(""),
    [suggesting, setSuggesting] = useState(false),
    [viewError, setViewError] = useState("");
  const [mode, setMode] = useState<"ledger" | "studio">("ledger");
  const [studioOpened, setStudioOpened] = useState(false);
  const [summaryCurrency, setSummaryCurrency] = useState("");
  const grid = useRef<GridApi<AnalyticsRow> | null>(null);
  const [gridReady, setGridReady] = useState(false);
  const rows = useMemo(
    () => filterAnalyticsRows(data?.items || [], view),
    [data, view],
  );
  const columns = useMemo<ColDef<AnalyticsRow>[]>(
    () => [
      ...view.columns.map(field => ({
        field,
        headerName: labels[field],
        flex: field === "counterparty" ? 2 : 1,
        minWidth: { counterparty: 154, status: 150, currency: 93, amount: 105, updatedAt: 155 }[field],
        sort: field === view.sort ? view.direction : null,
        ...(field === "status" ? {
          cellRenderer: ({ value }: ICellRendererParams<AnalyticsRow, string>) =>
            <span className={styles.status} data-tone={statusTone(value || "")}>{labelStatus(value || "")}</span>,
        } : {}),
        ...(field === "updatedAt" ? {
          valueFormatter: ({ value }: { value: string }) => Number.isFinite(Date.parse(value)) ? dateFormat.format(new Date(value)) : "—",
        } : {}),
        ...(field === "amount"
          ? {
              comparator: compareAnalyticsAmounts,
              type: "rightAligned",
              valueFormatter: ({ value }: { value: string }) => value ? amountLabel(value) : "—",
              headerTooltip:
                "Exact face value sorting. Filter one currency for meaningful comparisons.",
            }
          : {}),
      })),
      {
        colId: "review",
        headerName: "Workflow",
        sortable: false,
        width: 118,
        cellRenderer: ({ data: row }: ICellRendererParams<AnalyticsRow>) =>
          row ? (
            <Link
              className={styles.reviewLink}
              aria-label={row.counterparty ? `Review workflow for ${row.counterparty}` : "Review workflow"}
              href={`/dashboard/approvals?workflow=${encodeURIComponent(row.id)}`}
            >
              Review <ArrowUpRight size={12} />
            </Link>
          ) : null,
      },
    ],
    [view.columns, view.sort, view.direction],
  );
  const update = (field: "counterparty" | "status" | "currency" | "from" | "to", value: string) => {
    setView(previous => ({ ...previous, [field]: value }));
    grid.current?.paginationGoToFirstPage();
  };
  const exportCsv = useCallback(() => {
    const displayed: AnalyticsRow[] = [];
    grid.current?.forEachNodeAfterFilterAndSort(node => {
      if (node.data) displayed.push(node.data);
    });
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", analyticsCsv(displayed, view.columns)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "community-analytics-filtered-loaded-rows.csv";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [view.columns]);
  async function suggest() {
    setSuggesting(true);
    setViewError("");
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/analytics/view`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "View suggestion unavailable.");
      const next = analyticsViewSchema.parse(body.view);
      setView(next);
      grid.current?.applyColumnState({ defaultState: { sort: null }, state: [{ colId: next.sort, sort: next.direction }] });
      grid.current?.paginationGoToFirstPage();
    } catch (error) {
      setViewError(
        error instanceof Error ? error.message : "View suggestion unavailable.",
      );
    } finally {
      setSuggesting(false);
    }
  }
  const total = data?.summary.currencies.find(item => item.currency === summaryCurrency) ?? data?.summary.currencies[0];
  const filters = [view.counterparty, view.status, view.currency, view.from || view.to].filter(Boolean).length;
  const options = (field: "status" | "currency") =>
    [...new Set([...(data?.items.map(row => row[field]) ?? []), view[field]])].filter(Boolean).sort();
  const reset = () => {
    setView({ ...defaultAnalyticsView });
    grid.current?.applyColumnState({ defaultState: { sort: null }, state: [{ colId: "updatedAt", sort: "desc" }] });
    grid.current?.paginationGoToFirstPage();
    setViewError("");
  };

  return (
    <div className={styles.workspace}>
      {!data && <div className={styles.state} role="alert"><p>Workspace analytics couldn’t load.</p><button className={styles.button} disabled={retrying} onClick={() => retry(() => router.refresh())}>{retrying ? "Retrying…" : "Try again"}</button></div>}
      {data && <>
        <div className={styles.modeRow}>
          {studioEnabled && <div className={styles.modePicker} role="group" aria-label="Analytics view">
            <button type="button" aria-pressed={mode === "ledger"} onClick={() => setMode("ledger")}><FileText size={17} /> Ledger</button>
            <button type="button" aria-pressed={mode === "studio"} onClick={() => { setStudioOpened(true); setMode("studio"); }}><ChartNoAxesCombined size={17} /> Studio builder</button>
          </div>}
          <span className={styles.environment} data-environment={data.environment}>{data.environment === "sandbox" ? "PayPal sandbox" : "PayPal live"}</span>
        </div>
        <div className={styles.ledger} hidden={mode !== "ledger"}>
          <section className={styles.summary} aria-label="Invoice totals">
            <div className={styles.sectionTop}>
              <div><h2>Invoice totals</h2><p>Face values across loaded workflows, before table filters.</p></div>
              {total && <label className={styles.currencyPicker}><span>Totals currency</span>
                <SelectField className={styles.currencyControl} value={total.currency} onValueChange={setSummaryCurrency}
                  options={data.summary.currencies.map(({ currency }) => ({ value: currency, label: currency }))} />
              </label>}
            </div>
            {total ? <dl className={styles.metrics}>
              {metrics.map(({ key, label, help, Icon }) => <div key={key} className={styles.metric} data-metric={key}>
                <dt><span><Icon size={18} /></span>{label}</dt>
                <dd><small>{total.currency}</small> {amountLabel(total[key])}<span>{help}</span></dd>
              </div>)}
            </dl> : <div className={styles.summaryEmpty}><FileText size={20} /><p>No eligible invoice values yet. Verified PayPal invoices appear here by currency.</p></div>}
            {data.partial && <p className={styles.warning} role="status">Showing up to 1,000 workflows. Totals and exports are incomplete.</p>}
            <details className={styles.coverage}><summary>How totals are calculated</summary><p>Invoice face values do not represent bank balances or recognized revenue. {data.summary.excluded} loaded records were excluded from the totals because they lack an eligible invoice state or verified amount.</p></details>
          </section>

          <section className={styles.table} aria-label="Workflow analytics table">
            <div className={styles.tableHeader}>
              <div className={styles.sectionTop}>
                <div><h2>Workflows</h2><p role="status">{rows.length.toLocaleString()} of {data.items.length.toLocaleString()} loaded{data.partial ? " · Partial coverage" : ""}</p></div>
                <button className={styles.button} disabled={!rows.length || !gridReady} onClick={exportCsv}><ArrowDown size={15} /> Export CSV</button>
              </div>
              <div className={styles.filters}>
                <label className={styles.search}><span>Search counterparty</span><span><Search size={16} /><input className={styles.field} type="search" placeholder="Find a counterparty…" value={view.counterparty} maxLength={200} onChange={event => update("counterparty", event.target.value)} /></span></label>
                <label>Status<SelectField value={view.status} onValueChange={value => update("status", value)} options={[{ value: "", label: "All statuses" }, ...options("status").map(value => ({ value, label: labelStatus(value) }))]} /></label>
                <label>Currency<SelectField value={view.currency} onValueChange={value => update("currency", value)} options={[{ value: "", label: "All currencies" }, ...options("currency").map(value => ({ value, label: value }))]} /></label>
              </div>
              <div className={styles.viewTools}>
                <details className={styles.tool}>
                  <summary><SlidersHorizontal size={17} /> Dates & columns {(view.from || view.to) && <span className={styles.toolDot} aria-label="Date filter active" />}<ChevronDown size={12} className={styles.caret} /></summary>
                  <div className={styles.toolBody}>
                    <div className={styles.dates}>
                      <label>Updated from (UTC)<input className={styles.field} type="date" value={view.from} max={view.to || undefined} onChange={event => update("from", event.target.value)} /></label>
                      <label>Updated through (UTC)<input className={styles.field} type="date" value={view.to} min={view.from || undefined} onChange={event => update("to", event.target.value)} /></label>
                    </div>
                    <fieldset className={styles.columns}>
                      <legend>Visible columns</legend>
                      {analyticsColumns.map(column => <label key={column}><input type="checkbox" checked={view.columns.includes(column)} disabled={view.columns.length === 1 && view.columns.includes(column)} onChange={event => {
                        const checked = event.target.checked;
                        setView(previous => {
                          const columns = checked ? analyticsColumns.filter(value => previous.columns.includes(value) || value === column) : previous.columns.filter(value => value !== column);
                          return { ...previous, columns, sort: columns.includes(previous.sort) ? previous.sort : columns[0] };
                        });
                      }} />{labels[column]}</label>)}
                    </fieldset>
                  </div>
                </details>
                {data.aiAvailable && <details className={styles.tool}>
                  <summary><Sparkles size={17} /> Describe a view <ChevronDown size={12} className={styles.caret} /></summary>
                  <div className={styles.toolBody}>
                    <p>Set filters and columns from a prompt. Only your request goes to OpenAI; leave out sensitive information.</p>
                    <form className={styles.prompt} onSubmit={event => { event.preventDefault(); void suggest(); }}>
                      <input aria-label="View request" className={styles.field} value={prompt} maxLength={1000} placeholder="Show USD drafts updated this month" onChange={event => setPrompt(event.target.value)} />
                      <button className={styles.primary} disabled={!prompt.trim() || suggesting}>{suggesting ? "Applying…" : "Apply view"}</button>
                    </form>
                    {viewError && <p role="alert" className={styles.error}>{viewError}</p>}
                  </div>
                </details>}
                <button className={styles.reset} onClick={reset}>Reset view{filters > 0 && <span>{filters}</span>}</button>
              </div>
            </div>
            {data.items.length ? (
              <div className={styles.grid} style={rows.length > 0 && rows.length <= 8 ? { height: 103 + rows.length * 48 } : undefined} data-empty={!rows.length}>
                <LedgerGrid rows={rows} columns={columns} onReady={api => { grid.current = api; setGridReady(true); }}
                  empty={<div className={styles.gridEmpty}><Search size={23} /><strong>No workflows match these filters</strong><span>Try a different search or reset the view.</span></div>} />
              </div>
            ) : (
              <div className={styles.ledgerEmpty}>
                <span><FileText size={22} /></span>
                <div><strong>No financial workflows yet</strong><p>Workflows appear after AssentPay processes a financial email.</p></div>
                <Link className={styles.reviewLink} href="/dashboard/activity">Check processing <ArrowUpRight size={13} /></Link>
              </div>
            )}
            {data.items.length > 0 && <p className={styles.tableFoot}>CSV includes all matching loaded rows, in the current sort order.</p>}
          </section>
        </div>
        {studioOpened && <div className={styles.studio} hidden={mode !== "studio"}>
          <StudioWorkspace workspaceId={workspaceId} rows={data.items} aiAvailable={data.aiAvailable} />
        </div>}
      </>}
    </div>
  );
}
