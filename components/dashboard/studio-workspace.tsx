"use client";

import { useMemo } from "react";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import {
  AgStudioAiModule, AgStudioLicenseManager, createAiHarness, studioTheme,
  type AgAiHarnessSetup, type AgDataSourcesDefinition, type AgReportState, type AgStudioApi,
} from "ag-studio";
import { studioAdapter } from "@/lib/dashboard/studio-adapter";
import type { AnalyticsRow } from "@/lib/dashboard/analytics-model";

import styles from "./studio-workspace.module.css";

const field = (name: keyof AnalyticsRow) => ({ id: `financial_workflows.${name}` });
const initialState: AgReportState = {
  pages: [{
    id: "workspace",
    layout: { minWidth: 310, columns: 12, rowHeight: 45, pagePadding: 14, widgetPadding: 10, widgetBorderRadius: 10 },
    widgets: {
      status: {
        type: "column-chart-grouped",
        dataMapping: { categoryKey: [field("status")], valueKey: [{ ...field("id"), aggregation: "count" }] },
        format: { title: { enabled: true, text: "Workflow count by status" } },
      },
      workflows: {
        type: "grid",
        dataMapping: { cols: [field("counterparty"), field("status"), field("currency"), field("updatedAt")] },
        format: { title: { enabled: true, text: "Workflow records" } },
      },
    },
    widgetLayout: {
      status: { xTrack: 0, yTrack: 0, xSpan: 12, ySpan: 5 },
      workflows: { xTrack: 0, yTrack: 5, xSpan: 12, ySpan: 6 },
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

export function StudioWorkspace({ workspaceId, rows, aiAvailable }: { workspaceId: string; rows: AnalyticsRow[]; aiAvailable: boolean }) {
  const data = useMemo<AgDataSourcesDefinition>(() => ({
    sources: [{
      id: "financial_workflows",
      name: "Financial workflows",
      description: "Read-only invoice and payout workflow states. Group monetary amounts by currency. Amounts describe the proposal and may be unsettled.",
      primaryKeyField: "id",
      fields: [
        { id: "id", name: "Workflow ID", format: "textFormat" },
        { id: "counterparty", name: "Counterparty", format: "textFormat" },
        { id: "status", name: "Status", format: "textFormat" },
        { id: "currency", name: "Currency", format: "textFormat" },
        { id: "amount", name: "Proposed amount", format: "decimalFormat" },
        { id: "updatedAt", name: "Last updated (UTC)", format: "textFormat" },
      ],
      data: rows.map(row => ({
        ...row,
        status: row.status.replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase()),
        amount: row.amount ? Number(row.amount) : null,
      })),
    }],
  }), [rows]);
  const ai = useMemo<AgAiHarnessSetup>(() => ({ api }) => createAiHarness(api as AgStudioApi, {
    adapter: studioAdapter(workspaceId),
    promptStarters: [
      { label: "Compare statuses", prompt: "Chart the count of workflows by status." },
      { label: "Review invoice amounts", prompt: "Show invoice amounts grouped by currency and status." },
    ],
  }), [workspaceId]);

  return <section aria-label="AG Studio dashboard">
    <div className={styles.studioIntro}>
      <h2>Dashboard builder</h2>
      <p>{aiAvailable ? "Edit the starter chart and table, or open Studio chat to ask for a new view. Your prompt and relevant dashboard context go to OpenAI." : "Edit the starter chart and table with Studio’s builder tools. Studio chat is unavailable until OpenAI is configured."}</p>
      <p className={styles.studioScrollHint}>Swipe or scroll across the canvas to reach all builder tools.</p>
    </div>
    <div className={styles.studioCanvas} role="region" aria-label="Scrollable dashboard canvas" tabIndex={0}>
      <div className={styles.studioFrame} data-embedded-studio>
        <AgStudioProvider modules={[AgStudioAiModule]}>
          <AgStudio style={{ height: "100%", width: "100%" }} theme={theme} data={data} initialState={initialState} mode="edit" ai={aiAvailable ? ai : undefined} />
        </AgStudioProvider>
      </div>
    </div>
  </section>;
}
