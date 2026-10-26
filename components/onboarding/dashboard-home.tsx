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
      note: "Stored workspace communications",
      tone: "blue",
    },
    {
      label: "Invoice drafts",
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
            href="/dashboard/analytics"
          />
          <div className={styles.chartLegend}>
            <span>
              <i />
              Collected
            </span>
            <span>
              <i />
              Outstanding
            </span>
            <span>
              <i />
              Upcoming
            </span>
          </div>
          <div className={styles.chartEmpty}>
            <div className={styles.chartLines} aria-hidden="true">
              {[1, 2, 3, 4].map((i) => (
                <i key={i} />
              ))}
            </div>
            <div>
              <span className={styles.emptyIcon}>
                <Coins size={23} />
              </span>
              <h3>A clearer picture starts here.</h3>
              <p>
                Your verified invoices and payments will bring this chart to
                life.
              </p>
              <Link className={styles.textLink} href="/dashboard/invoices">
                Explore invoices <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
          <div className={styles.panelFoot}>
            <ShieldCheck size={14} />
            No sample transactions. Your workspace data stays yours.
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
                {operations.review.length ? operations.review.map((item) => <tr key={item.id}><td><Link href="/dashboard/approvals">Review proposal</Link></td><td>{item.counterparty}</td><td>{item.currency} {item.amount || "Uncertain"}</td><td>{item.status.replaceAll("_", " ")}</td></tr>) : <tr>
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
          <EmptyState
            compact
            title="The details won’t get lost"
            description="Review extracted workspace context, source references, and expiry dates. You can forget incorrect facts in Memory."
          />
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
                      ? "Gmail"
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
