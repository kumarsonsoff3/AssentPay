"use client";
import { useState } from "react";
import { Search, X, Filter, LockKeyhole } from "@/components/icons";
import { EmptyState, PhaseNotice } from "./states";
import styles from "./dashboard.module.css";
export type ResourceSection =
  | "inbox"
  | "deals"
  | "approvals"
  | "invoices"
  | "clients"
  | "documents"
  | "activity"
  | "memory"
  | "analytics";
const content: Record<
  ResourceSection,
  {
    tabs: string[];
    columns: string[];
    title: string;
    description: string;
    notice: string;
  }
> = {
  inbox: {
    tabs: ["All conversations", "Unread", "Financial intent"],
    columns: ["Conversation", "Client", "Channel", "Last message"],
    title: "Your conversations start here",
    description:
      "Connect Gmail and synchronize recent conversations from your mailbox.",
    notice:
      "Gmail synchronization runs in the background. Replies and financial actions need explicit authorization.",
  },
  deals: {
    tabs: ["All deals", "In progress", "Completed"],
    columns: ["Deal", "Client", "Value", "Stage", "Next milestone"],
    title: "From conversation to agreement",
    description:
      "Your future deals, accepted terms, and payment milestones will come together here.",
    notice:
      "Agreement extraction and deal tracking are not enabled yet. A connection alone never creates a deal.",
  },
  approvals: {
    tabs: ["Pending", "Approved", "Rejected"],
    columns: ["Action", "Client", "Amount", "Requested by", "Status"],
    title: "Every decision deserves context",
    description:
      "Review the proposed action, its supporting evidence, and the exact amount before you approve it.",
    notice:
      "No approval requests have been generated. Financial approval controls will be added with the approval workflow.",
  },
  invoices: {
    tabs: ["Invoices", "Payments", "Reminders"],
    columns: ["Reference", "Client", "Amount", "Due date", "Status"],
    title: "A place for every payment milestone",
    description:
      "Prepared invoices, secure payment links, and verified payment updates will appear here when PayPal workflows are enabled.",
    notice:
      "PayPal connection is sandbox-only. This screen cannot create, send, capture, refund, or move money.",
  },
  clients: {
    tabs: ["All contacts", "Clients", "Archived"],
    columns: ["Contact", "Company", "Email", "Active deals"],
    title: "A little more context for every client",
    description:
      "Contacts will be matched to your business conversations and agreements once synchronization is available.",
    notice:
      "Your Appwrite team members are managed separately under Team. No inbox contacts have been imported.",
  },
  documents: {
    tabs: ["All documents", "Agreements", "Invoices & receipts"],
    columns: ["Document", "Client", "Type", "Added"],
    title: "Keep the evidence close",
    description:
      "Quotes, contracts, and receipts will be linked to their source conversations and financial actions.",
    notice:
      "Secure file storage, uploads, and document extraction are scheduled for the backend and document intelligence phases.",
  },
  activity: {
    tabs: ["All activity", "Analysis", "Actions"],
    columns: ["Activity", "Source", "Outcome", "Time"],
    title: "A clear trail of every step",
    description:
      "When the agent runs, its analyses, recommendations, and outcomes will be visible here.",
    notice:
      "The AI agent is not running. Connection checks can be requested from Integrations; they do not analyze email.",
  },
  memory: {
    tabs: ["All memory", "Client context", "Deal history"],
    columns: ["Memory", "Source", "Scope", "Updated"],
    title: "Your business has a story",
    description:
      "Confirmed facts, agreements, and corrections will build a workspace-specific history with traceable sources.",
    notice:
      "Persistent agent memory and retrieval are not enabled. Stored memory will never replace authorization or financial approval.",
  },
  analytics: {
    tabs: ["Financial overview", "Client insights", "Agent performance"],
    columns: ["Report", "Source", "Period", "Status"],
    title: "Clarity, grounded in your data",
    description:
      "Financial reports and read-only analytics will become available after verified invoices, payments, and activity exist.",
    notice:
      "No financial dataset is connected yet. Analytics Studio and natural-language reporting are planned for the analytics phase.",
  },
};
export function ResourceWorkspace({ section }: { section: ResourceSection }) {
  const config = content[section],
    [tab, setTab] = useState(config.tabs[0]),
    [query, setQuery] = useState("");
  return (
    <>
      <section className={styles.panel}>
        <div className={styles.resourceToolbar}>
          <div className={styles.tabs} role="group" aria-label="View filter">
            {config.tabs.map((t) => (
              <button
                key={t}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className={styles.recordsSearch}>
            <Search size={16} />
            <input
              aria-label={`Search ${section}`}
              className={styles.recordsSearchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${section}…`}
              type="search"
            />
            {query && (
              <button type="button" className={styles.clearSearch} aria-label="Clear search" onClick={() => setQuery("")}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <div className={styles.resultsMeta}>
          <span>
            <Filter size={13} />
            {tab}
          </span>
          <span>0 records</span>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <caption className="sr-only">{tab}</caption>
            <thead>
              <tr>
                {config.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={config.columns.length}>
                  <EmptyState
                    title={
                      query
                        ? `No results for “${query.slice(0, 80)}”`
                        : config.title
                    }
                    description={
                      query
                        ? "There are no records in this workspace yet. Clear your search to see how this area will work."
                        : config.description
                    }
                    href={
                      section === "activity" ||
                      section === "inbox" ||
                      section === "invoices"
                        ? "/dashboard/integrations"
                        : undefined
                    }
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className={styles.panelFoot}>
          <LockKeyhole size={14} />
          Visible only in your current workspace
        </div>
      </section>
      <PhaseNotice>{config.notice}</PhaseNotice>
    </>
  );
}
