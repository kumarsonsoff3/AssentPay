import "server-only";
import { workflowReviewStatuses } from "./analytics-model";
import { memoryHighlight, summarizeInvoices, type CashFlowSummary, type InvoiceTotals, type MemoryHighlight } from "./overview-summary";
import type { ConversationSummary } from "@/components/dashboard/workspace-presenters";
import { Query } from "node-appwrite";
import { dataDatabase } from "../data/client";
import { inboxDeliveryStatus } from "../automation/inbox-status";
import { isCurrencyCode } from "../automation/extraction";
import { inboxId } from "../automation/inbox";
import { optionalRow, params } from "../automation/store";
export type OverviewData = {
  messageCount: number; draftCount: number; pendingCount: number; reviewCount: number; failedCount: number;
  inbox: { address: string; status: string; sourceEmail: string } | null;
  cashFlow: CashFlowSummary;
  invoiceTrend: { day: string; currencies: InvoiceTotals[] }[];
  memories: MemoryHighlight[];
  conversations: ConversationSummary[];
  activity: { id: string; action: string; occurredAt: string; kind?: string }[];
  review: { id: string; counterparty: string; currency: string; amount: string; status: string; action: string }[];
};
async function overviewWorkflows(workspaceId: string) {
  const rows: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  // Bound dashboard latency; explicitly label any incomplete summary.
  for (let page = 0; page < 10; page++) {
    const result = await dataDatabase().listRows({ ...params("financial_workflows"), queries: [Query.equal("workspaceId", workspaceId), Query.orderAsc("$id"), Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])] });
    rows.push(...result.rows);
    if (result.rows.length < 100 || rows.length >= result.total) return { rows, partial: false };
    cursor = result.rows[result.rows.length - 1].$id;
  }
  return { rows, partial: true };
}
function invoiceTrend(rows: Record<string, unknown>[]) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const byDay = new Map<string, Record<string, unknown>[]>();
  for (let index = 29; index >= 0; index--) {
    const day = new Date(today.getTime() - index * 86_400_000).toISOString().slice(0, 10);
    byDay.set(day, []);
  }
  for (const row of rows) {
    byDay.get(String(row.$createdAt).slice(0, 10))?.push(row);
  }
  return Array.from(byDay, ([day, invoices]) => ({ day, currencies: summarizeInvoices(invoices).currencies }));
}

export async function operationalOverview(workspaceId: string): Promise<OverviewData> {
  const db = dataDatabase(), scoped = [Query.equal("workspaceId", workspaceId)];
  const count = async (table: string, queries: string[] = []) => (await db.listRows({ ...params(table), queries: [...scoped, ...queries, Query.limit(1)] })).total;
  const [messageCount, draftCount, pendingCount, reviewCount, failedCount, endpoint, activity, review, messages, workspace, invoices, memory] = await Promise.all([
    count("mail_messages", [Query.equal("financial", true)]), count("financial_workflows", [Query.equal("status", "draft_created")]), count("financial_workflows", [Query.equal("status", "pending_approval")]), count("financial_workflows", [Query.equal("status", workflowReviewStatuses)]), count("automation_jobs", [Query.equal("status", "failed")]),
    optionalRow("inbound_endpoints", inboxId(workspaceId)),
    db.listRows({ ...params("audit_events"), queries: [...scoped, Query.orderDesc("occurredAt"), Query.limit(5)] }),
    db.listRows({ ...params("financial_workflows"), queries: [...scoped, Query.equal("status", workflowReviewStatuses), Query.orderDesc("$updatedAt"), Query.limit(5)] }),
    db.listRows({ ...params("mail_messages"), queries: [...scoped, Query.equal("financial", true), Query.orderDesc("receivedAt"), Query.limit(3)] }),
    optionalRow("workspaces", workspaceId),
    overviewWorkflows(workspaceId),
    db.listRows({ ...params("agent_memory"), queries: [...scoped, Query.equal("status", "active"), Query.greaterThan("expiresAt", new Date().toISOString()), Query.orderDesc("$updatedAt"), Query.limit(3)] }),
  ]);
  return { cashFlow: summarizeInvoices(invoices.rows, invoices.partial), invoiceTrend: invoiceTrend(invoices.rows), memories: memory.rows.flatMap(row => { const highlight = memoryHighlight(row, workspaceId); return highlight ? [highlight] : []; }), messageCount, draftCount, pendingCount, reviewCount, failedCount, inbox: endpoint ? { address: endpoint.address, status: inboxDeliveryStatus({ status: endpoint.status, errorCode: endpoint.errorCode }, null, false), sourceEmail: String(JSON.parse(workspace?.settingsJson || "{}").forwardingSourceEmail || "") } : null,
    conversations: messages.rows.map((r) => {
      let snippet = "";
      try { const content = JSON.parse(r.contentJson); snippet = String(content.snippet || content.text || "").replace(/\s+/g, " ").slice(0, 180); } catch { /* A missing preview must not prevent the overview from loading. */ }
      return { id: r.$id, sender: r.sender, subject: r.subject, receivedAt: r.receivedAt, unread: r.unread, financial: r.financial, snippet };
    }),
    activity: activity.rows.map((r) => {
      let kind: string | undefined;
      try { const details = JSON.parse(r.detailsJson); if (typeof details?.kind === "string") kind = details.kind; } catch { /* Keep the event visible even when optional details are unavailable. */ }
      return { id: r.$id, action: r.action, occurredAt: r.occurredAt, kind };
    }),
    review: review.rows.map((r) => ({ id: r.$id, counterparty: r.counterparty, currency: isCurrencyCode(r.currency) ? r.currency : "", amount: r.amount, status: r.status, action: r.action })),
  };
}
