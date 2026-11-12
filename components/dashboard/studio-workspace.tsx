"use client";

import { useMemo, useState } from "react";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import {
  AgStudioAiModule, AgStudioLicenseManager, createAiHarness, directLlmRunner, studioTheme,
  type AgAiHarnessSetup, type AgDataSourcesDefinition, type AgReportState, type AgStudioApi,
} from "ag-studio";
import { studioAdapter } from "@/lib/dashboard/studio-adapter";
import type { AnalyticsData, AnalyticsRow } from "@/lib/dashboard/analytics-model";

import styles from "./studio-workspace.module.css";

const field = (name: keyof AnalyticsRow) => ({ id: `financial_workflows.${name}` });
const activityDay = { id: "financial_workflows.updatedDay" };
const reviewStatuses = new Set(["needs_review", "pending_approval", "duplicate_review"]);
const initialState: AgReportState = {
  pages: [{
    id: "workspace",
    layout: { minWidth: 310, columns: 12, rowHeight: 45, pagePadding: 14, widgetPadding: 10, widgetBorderRadius: 10 },
    widgets: {
      activity: {
        type: "line-chart",
        dataMapping: {
          categoryKey: [activityDay],
          valueKey: [{ ...field("id"), aggregation: "count" }, { id: "financial_workflows.reviewCount", aggregation: "sum" }],
        },
        sort: [{ field: activityDay, direction: "asc" }],
        format: {
          title: { enabled: true, text: "Workflow activity" },
          subtitle: { enabled: true, text: "Loaded workflows by last update date (UTC)" },
          style: { theme: { common: { legend: { enabled: true, position: "bottom" } } } },
        },
      },
      workflows: {
        type: "grid",
        dataMapping: { cols: [field("counterparty"), field("status"), field("currency"), field("updatedAt")] },
        format: { title: { enabled: true, text: "Workflow records" } },
      },
    },
    widgetLayout: {
      activity: { xTrack: 0, yTrack: 0, xSpan: 12, ySpan: 7 },
      workflows: { xTrack: 0, yTrack: 7, xSpan: 12, ySpan: 6 },
    },
  }],
  selectedPageId: "workspace",
  panels: {
    ai: { collapsed: true, width: 290 },
    filters: { collapsed: true },
    edit: { collapsed: true },
    data: { collapsed: true },
  },
};
const theme = studioTheme.withParams({
  accentColor: "#3453ce", foregroundColor: "#243653", borderColor: "#dce5f3",
  studioWrapperBackgroundColor: "#eef3fb", studioPanelContainerBackgroundColor: "#ffffff",
  studioPanelDividerColor: "#dce5f3", fontFamily: "inherit",
});
const license = process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY;
if (license) AgStudioLicenseManager.setLicenseKey(license);

export function StudioWorkspace({ workspaceId, userId, rows, summary, aiAvailable }: {
  workspaceId: string; userId: string; rows: AnalyticsRow[]; summary: AnalyticsData["summary"]; aiAvailable: boolean;
}) {
  const key = `assentpay:studio:v1:${workspaceId}:${userId}`;
  const [studio, setStudio] = useState<AgStudioApi>();
  const [layoutStatus, setLayoutStatus] = useState("");
  const [startingLayout] = useState<AgReportState>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (!stored || stored.length > 256000) return initialState;
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed?.pages) && parsed.pages.some((page: { id?: string }) => page?.id === parsed.selectedPageId)
        ? parsed : initialState;
    } catch {
      return initialState;
    }
  });

  function saveLayout() {
    if (!studio) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(studio.getState()));
      setLayoutStatus("Layout saved in this browser.");
    } catch {
      setLayoutStatus("This browser couldn’t save the layout.");
    }
  }

  const data = useMemo<AgDataSourcesDefinition>(() => ({
    sources: [{
      id: "financial_workflows",
      name: "Financial workflows",
      description: "One row per loaded financial workflow, including review, invoices, and payouts. Use this table for counts, status, dates, and detailed records.",
      primaryKeyField: "id",
      fields: [
        { id: "id", name: "Workflow ID", format: "textFormat" },
        { id: "counterparty", name: "Counterparty", format: "textFormat" },
        { id: "status", name: "Status", format: "textFormat", cardinality: "low" },
        { id: "currency", name: "Currency", format: "textFormat", cardinality: "low" },
        { id: "amount", name: "Reported or approved amount", format: "textFormat", description: "Display value for the grid. It may be a proposal, and must not be summed." },
        { id: "updatedAt", name: "Last updated (UTC)", format: "dateTimeFormat", description: "Timestamp of the last workflow update. Use for activity trends." },
        { id: "updatedDay", name: "Update date (UTC)", format: "textFormat", description: "Calendar date of the latest update. Use for daily workflow counts." },
        { id: "reviewCount", name: "Needs review or approval", format: "integerFormat", description: "Sum to count workflows currently in the review queue." },
      ],
      data: rows.map(row => {
        const updatedAt = Number.isFinite(Date.parse(row.updatedAt)) ? new Date(row.updatedAt) : null;
        return {
          ...row,
          status: row.status.replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase()),
          updatedAt,
          updatedDay: updatedAt?.toISOString().slice(0, 10) ?? null,
          reviewCount: Number(reviewStatuses.has(row.status)),
        };
      }),
    }, {
      id: "invoice_totals",
      name: "Verified invoice totals by currency",
      description: "One row per currency with precomputed verified PayPal sandbox invoice face values. Excludes partial payments, refunds, and payouts. Compare categories within one currency.",
      primaryKeyField: "currency",
      fields: [
        { id: "currency", name: "Currency", format: "textFormat", cardinality: "low" },
        { id: "collected", name: "Paid invoice face value", format: "decimalFormat" },
        { id: "outstanding", name: "Open invoice face value", format: "decimalFormat" },
        { id: "drafts", name: "Unsent draft face value", format: "decimalFormat" },
      ],
      data: summary.currencies.map(row => ({
        currency: row.currency, collected: Number(row.collected), outstanding: Number(row.outstanding), drafts: Number(row.drafts),
      })),
    }],
  }), [rows, summary.currencies]);
  const ai = useMemo<AgAiHarnessSetup>(() => ({ api }) => {
    const adapter = studioAdapter(workspaceId);
    return createAiHarness(api as AgStudioApi, ({ tools: { studio } }) => ({
      primary: "finance",
      agents: [directLlmRunner({
        id: "finance", name: "AssentPay Studio", adapter, maxTurns: 12,
        instructions: () => [
          "Build or edit the active dashboard when the user asks for a view. Answer questions with an aggregate query when data is needed. Use the existing chart or grid if it fits.",
          "Inspect the schema for the exact field IDs and filter values, then add or configure widgets. Check the result and report what changed. For a status chart, count workflow IDs.",
          "Use financial_workflows for detailed records and counts. Use invoice_totals only for PayPal sandbox invoice face values by currency. Require a single currency for monetary comparisons or show each currency on its own row.",
          "Use the updated timestamp only for activity trends. Do not treat it as a payment or invoice issue date. Blank or unconfirmed amounts are unknown.",
          `The dashboard has ${rows.length} loaded workflows. ${summary.partial ? "Coverage is partial. State this when giving results." : "Use only the rows and verified totals available here."}`,
        ].join("\n"),
        tools: () => [
          studio.viewSchema(), studio.viewPage(), studio.viewWidget(), studio.executeQuery(),
          studio.addWidget(), studio.positionWidget(), studio.removeWidget(),
          studio.addPageFilter(), studio.removePageFilter(), studio.addWidgetFilter(), studio.removeWidgetFilter(),
          ...["grid", "column-chart-grouped", "line-chart", "value"].map(widgetType =>
            studio.configureWidget({ widgetType }, { name: `configure_${widgetType.replaceAll("-", "_")}` }),
          ),
        ],
      })],
      promptStarters: [
        { label: "Review queue", prompt: "Add a table of workflows that need review or approval. Include counterparty, status, reported amount, currency, and last updated." },
        { label: "Invoice totals", prompt: "Add a table showing the verified paid, open, and draft invoice face values by currency." },
        { label: "Workflow activity", prompt: "Add a chart of workflow counts by status." },
      ],
    }));
  }, [workspaceId, rows.length, summary.partial]);

  return <section aria-label="AG Studio dashboard">
    <div className={styles.studioIntro}>
      <h2>Dashboard builder</h2>
      <p>{aiAvailable ? "Edit the starter chart and table, or open Studio chat to ask for a new view. Your prompt and relevant dashboard context go to OpenAI." : "Edit the starter chart and table with Studio’s builder tools. Studio chat is unavailable until OpenAI is configured."}</p>
      <div className={styles.layoutActions}>
        <button type="button" disabled={!studio} onClick={saveLayout}>Save layout</button>
        {layoutStatus && <span role="status">{layoutStatus}</span>}
      </div>
      <p className={styles.studioScrollHint}>Swipe or scroll across the canvas to reach all builder tools.</p>
    </div>
    <div className={styles.studioCanvas} role="region" aria-label="Scrollable dashboard canvas" tabIndex={0}>
      <div className={styles.studioFrame} data-embedded-studio>
        <AgStudioProvider modules={[AgStudioAiModule]}>
          <AgStudio style={{ height: "100%", width: "100%" }} theme={theme} data={data} initialState={startingLayout} onStudioReady={event => setStudio(event.api)} mode="edit" ai={aiAvailable ? ai : undefined} />
        </AgStudioProvider>
      </div>
    </div>
  </section>;
}
