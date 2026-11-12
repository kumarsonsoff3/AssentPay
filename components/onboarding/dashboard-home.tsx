import { ActivityTimeline, RecentConversations } from "@/components/dashboard/workspace-presenters";
import type { OverviewData } from "@/lib/dashboard/operations";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Coins,
  FileText,
  Clock3,
  BriefcaseBusiness,
  Bot,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Check,
} from "@/components/icons";
import {
  PROVIDERS,
  type IntegrationSummary,
  type Member,
  type Workspace,
} from "@/lib/workspaces/types";
import { ProviderMark } from "./provider-mark";
import { EmptyState } from "@/components/dashboard/states";
import styles from "@/components/dashboard/dashboard.module.css";
export function DashboardHome({
  workspace,
  integrations,
  members,
  name,
  operations,
}: {
  workspace: Workspace;
  integrations: IntegrationSummary[];
  members: Member[];
  name: string;
  operations: OverviewData;
}) {
  const gmailReceiving = operations.inbox ? operations.inbox.status === "receiving" : integrations.some((item) => item.provider === "gmail" && item.status === "connected");
  const healthy = integrations.filter((item) => item.provider !== "gmail" && item.status === "connected").length + Number(gmailReceiving);
  const month = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: workspace.timezone,
  }).format(new Date());
  const metrics = [
    {
      label: "Received messages",
      value: operations.messageCount,
      icon: Coins,
      note: "Stored financial communications",
      tone: "blue",
    },
    {
      label: "Unsent invoice drafts",
      value: operations.draftCount,
      icon: FileText,
      note: "Created in PayPal sandbox",
      tone: "blue",
    },
    {
      label: "Awaiting approval",
      value: operations.pendingCount,
      icon: Clock3,
      note: "Owner authorization required",
      tone: "amber",
    },
    {
      label: "Processing failures",
      value: operations.failedCount,
      icon: BriefcaseBusiness,
      note: "Review failures in Activity",
      tone: "violet",
    },
  ];
  return (
    <div className={styles.page}>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>YOUR FINANCIAL OVERVIEW</p>
          <h1>Your finances, at a glance.</h1>
          <p>
            Welcome back{name ? `, ${name.split(" ")[0]}` : ""}. Here’s the
            picture at {workspace.name}.
          </p>
        </div>
        <span className={styles.date}>
          <CalendarDays size={16} />
          {month}
        </span>
      </div>
      <div className={styles.metrics}>
        {metrics.map(({ label, value, icon: Icon, note, tone }) => (
          <section className={styles.metric} key={label}>
            <span className={`${styles.icon} ${styles[tone]}`}>
              <Icon size={20} />
            </span>
            <div>
              <p>{label}</p>
              <strong>{value}</strong>
              <small>{note}</small>
            </div>
          </section>
        ))}
      </div>
      <div className={styles.overviewGrid}>
        <div className={styles.overviewColumn}>
        <section className={`${styles.panel} ${styles.overviewCash}`}>
          <PanelHeading
            title="Cash flow overview"
            detail={workspace.currency}
            href="/dashboard/invoices"
          />
          {operations.cashFlow.currencies.length ? <div className={styles.tableWrap}>
            <table>
              <caption className="sr-only">Sandbox invoice face values by currency, all time</caption>
              <thead><tr><th>Currency</th><th>Verified paid</th><th>Open invoices</th><th>Unsent drafts</th></tr></thead>
              <tbody>{operations.cashFlow.currencies.map(item => <tr key={item.currency}><th scope="row">{item.currency}</th><td>{item.collected}</td><td>{item.outstanding}</td><td>{item.drafts}</td></tr>)}</tbody>
            </table>
          </div> : <EmptyState compact title="No verified invoice values yet" description="Approved sandbox invoices appear here after provider verification." href="/dashboard/invoices" action="Explore invoices" />}
          <div className={styles.panelFoot}>
            <ShieldCheck size={14} />
            <span>All-time sandbox invoice face values, not cash or bank balances. Open invoices exclude partial payments. {operations.cashFlow.excluded > 0 ? `${operations.cashFlow.excluded} uncertain, partial, manual, refunded or unverified records excluded. ` : ""}{operations.cashFlow.partial ? "Partial summary: first 1,000 records only." : "Currencies are not combined."}</span>
          </div>
        </section>
        <section className={`${styles.panel} ${styles.overviewReview}`}>
          <PanelHeading
            title="Needs your review"
            detail="Approvals"
            href="/dashboard/approvals"
          />
          <div className={styles.tableWrap}>
            <table>
              <caption className="sr-only">
                Financial actions awaiting review
              </caption>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {operations.review.length ? operations.review.map((item) => <tr key={item.id}><td><Link href={"/dashboard/approvals?workflow=" + encodeURIComponent(item.id)}>Review proposal</Link></td><td>{item.counterparty}</td><td>{item.currency} {item.amount || "Uncertain"}</td><td>{item.status.replaceAll("_", " ")}</td></tr>) : <tr>
                  <td colSpan={4}>
                    <EmptyState
                      compact
                      title="Every decision, in your hands"
                      description="Financial proposals will appear here after new mail is analyzed."
                    />
                  </td>
                </tr>}
              </tbody>
            </table>
          </div>
        </section>
        <section className={styles.panel}>
          <PanelHeading
            title="Deal memory highlights"
            detail="Workspace memory"
            href="/dashboard/memory"
          />
          {operations.memories.length ? <div className={styles.tableWrap}><table>
            <caption className="sr-only">Active workspace context, not financial evidence</caption>
            <thead><tr><th>Context</th><th>Reference</th><th>Expires</th></tr></thead>
            <tbody>{operations.memories.map(item => <tr key={item.id}><td><Link href="/dashboard/memory">{item.counterparty}</Link></td><td>{item.reference || "Not specified"}</td><td>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: workspace.timezone }).format(new Date(item.expiresAt))}</td></tr>)}</tbody>
          </table><p className={styles.panelFoot}>Context only, never payment authority. Paused, forgotten and expired memories are excluded.</p></div> : <EmptyState
            compact
            title="No active memory highlights"
            description="Review extracted workspace context, source references, and expiry dates. You can correct or forget facts in Memory."
          />}

        </section>
        </div>
        <div className={styles.overviewColumn}>
        <section className={styles.panel}>
          <PanelHeading
            title="Your agent’s activity"
            detail={`${operations.activity.length} recent events`}
            href="/dashboard/activity"
          />
          {operations.activity.length ? <ActivityTimeline compact events={operations.activity} timeZone={workspace.timezone} /> : <EmptyState compact title="Your activity starts here" description="New messages, analysis and approval decisions will appear here." />}
          <div className={styles.insight}>
            <Sparkles size={20} />
            <div>
              <strong>You give the go-ahead.</strong>
              <p>
                Every financial proposal needs your review. No email instruction or model output can authorize a payment.
              </p>
            </div>
          </div>
        </section>
        <section className={styles.panel}>
          <PanelHeading
            title="Recent conversations"
            detail={`${operations.messageCount} message${operations.messageCount === 1 ? "" : "s"}`}
            href="/dashboard/inbox"
          />
          {operations.conversations.length ? <RecentConversations items={operations.conversations} timeZone={workspace.timezone} /> : <EmptyState
            compact
            title="Your inbox, with more context"
            description="Forward business emails to see your latest conversations here."
            href="/dashboard/integrations"
            action="Set up workspace email"
          />}
        </section>
        </div>
      </div>
      <section className={styles.panel}>
        <PanelHeading
          title="Your connected workspace"
          detail={`${healthy} active connection${healthy === 1 ? "" : "s"}`}
          href="/dashboard/integrations"
        />
        <div className={styles.connectionGrid}>
          {PROVIDERS.map((provider) => {
            const item = integrations.find((i) => i.provider === provider);
            const connected = provider === "gmail" ? gmailReceiving : item?.status === "connected";
            const label = provider === "gmail" ? operations.inbox?.sourceEmail || item?.label || "Forward selected business emails" : item?.label || (provider === "paypal" ? "Your sandbox merchant app" : "Connect your business account");
            const mailStatuses: Record<string, string> = { receiving: "Receiving email", disabled: "Paused", awaiting_test: "Check delivery", awaiting_verification: "Finish setup", processing: "Processing email", connection_error: "Needs attention", not_configured: "Set up forwarding" };
            const status = provider === "gmail" && operations.inbox ? mailStatuses[operations.inbox.status] || "Needs attention" : connected ? "Connected" : item ? "Needs attention" : "Not connected";
            return (
              <Link
                key={provider}
                href="/dashboard/integrations"
                className={styles.connectionTile}
              >
                <span className={styles.provider}>
                  <ProviderMark provider={provider} />
                </span>
                <div>
                  <strong>
                    {provider === "gmail"
                      ? operations.inbox ? "Workspace email" : "Gmail"
                      : provider === "slack"
                        ? "Slack"
                        : "PayPal"}
                  </strong>
                  <p title={label}>{label}</p>
                  <span
                    className={
                      connected
                        ? styles.connected
                        : styles.mutedStatus
                    }
                  >
                    {connected ? (
                      <Check size={12} />
                    ) : (
                      <Clock3 size={12} />
                    )}{" "}
                    {status}
                  </span>
                </div>
                <ChevronRight size={16} />
              </Link>
            );
          })}
        </div>
      </section>
      <div className={styles.bottomStrip}>
        <span>
          <Bot size={17} />
          Built around your business. Guided by your approval.
        </span>
        <Link href="/dashboard/team">
          {members.filter((m) => m.confirmed).length} team member
          {members.filter((m) => m.confirmed).length === 1 ? "" : "s"}
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
export function PanelHeading({
  title,
  detail,
  href,
}: {
  title: string;
  detail?: string;
  href?: string;
}) {
  return (
    <div className={styles.panelHeading}>
      <h2>{title}</h2>
      <div>
        {detail && <span>{detail}</span>}
        {href && (
          <Link href={href} aria-label={`View ${title.toLowerCase()}`}>
            <ArrowUpRight size={16} />
          </Link>
        )}
      </div>
    </div>
  );
}
