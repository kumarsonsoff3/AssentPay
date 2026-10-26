import "server-only";
import type { ConversationSummary } from "@/components/dashboard/workspace-presenters";
import { Query } from "node-appwrite";
import { dataDatabase } from "../data/client";
import { inboxId } from "../automation/inbox";
import { optionalRow, params } from "../automation/store";
export type OverviewData = {
  messageCount: number; draftCount: number; pendingCount: number; failedCount: number;
  inbox: { address: string; status: string; sourceEmail: string } | null;
  conversations: ConversationSummary[];
  activity: { id: string; action: string; occurredAt: string; kind?: string }[];
  review: { id: string; counterparty: string; currency: string; amount: string; status: string }[];
};
export async function operationalOverview(workspaceId: string): Promise<OverviewData> {
  const db = dataDatabase(), scoped = [Query.equal("workspaceId", workspaceId)];
  const count = async (table: string, queries: string[] = []) => (await db.listRows({ ...params(table), queries: [...scoped, ...queries, Query.limit(1)] })).total;
  const [messageCount, draftCount, pendingCount, failedCount, endpoint, activity, review, messages, workspace] = await Promise.all([
    count("mail_messages", [Query.equal("financial", true)]), count("financial_workflows", [Query.equal("status", "draft_created")]), count("financial_workflows", [Query.equal("status", "pending_approval")]), count("automation_jobs", [Query.equal("status", "failed")]),
    optionalRow("inbound_endpoints", inboxId(workspaceId)),
    db.listRows({ ...params("audit_events"), queries: [...scoped, Query.orderDesc("occurredAt"), Query.limit(5)] }),
    db.listRows({ ...params("financial_workflows"), queries: [...scoped, Query.equal("status", ["pending_approval", "needs_review", "duplicate_review", "reconciliation_required"]), Query.orderDesc("$updatedAt"), Query.limit(5)] }),
    db.listRows({ ...params("mail_messages"), queries: [...scoped, Query.equal("financial", true), Query.orderDesc("receivedAt"), Query.limit(3)] }),
    optionalRow("workspaces", workspaceId),
  ]);
  return { messageCount, draftCount, pendingCount, failedCount, inbox: endpoint ? { address: endpoint.address, status: endpoint.status, sourceEmail: String(JSON.parse(workspace?.settingsJson || "{}").forwardingSourceEmail || "") } : null,
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
    review: review.rows.map((r) => ({ id: r.$id, counterparty: r.counterparty, currency: r.currency, amount: r.amount, status: r.status })),
  };
}
