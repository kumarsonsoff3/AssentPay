import type { Metadata } from "next";
import { Suspense } from "react";
import { AnalyticsPanel } from "@/components/dashboard/analytics-panel";
import { ResourceLoading } from "@/components/dashboard/states";
import { listMembers } from "@/lib/workspaces/server";
import { integrationSummaries } from "@/lib/integrations/server";
import { ActivityViews } from "@/components/dashboard/activity-views";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Bell,
  Bot,
  ArrowUpRight,
  AlertCircle, Inbox, Handshake, ShieldCheck, FileText, Users, FolderOpen, BrainCircuit, ChartNoAxesCombined, PlugZap, SlidersHorizontal,
} from "@/components/icons";
import { dashboardContext } from "@/lib/dashboard/context";
import { dashboardSection, type DashboardSectionId } from "@/lib/dashboard/navigation";
import { providerReady } from "@/lib/integrations/providers";
import {
  IntegrationManager,
  TeamManager,
  WorkspaceSettings,
} from "@/components/dashboard/management";
import {
  ResourceWorkspace,
  type ResourceSection,
} from "@/components/dashboard/resource-workspace";
import { EmptyState, PhaseNotice } from "@/components/dashboard/states";
import styles from "@/components/dashboard/dashboard.module.css";
import { SectionHeader } from "@/components/dashboard/section-header";
import { inboxId } from "@/lib/automation/inbox";
import { optionalRow } from "@/lib/automation/store";
import { BackendWorkspace } from "@/components/dashboard/backend-workspace";
const sectionIcons = {
  inbox: Inbox, deals: Handshake, approvals: ShieldCheck, invoices: FileText,
  clients: Users, documents: FolderOpen, activity: Bot, memory: BrainCircuit,
  analytics: ChartNoAxesCombined, integrations: PlugZap, agent: SlidersHorizontal,
  team: Users, notifications: Bell,
};
const shortcuts: Partial<Record<DashboardSectionId, { href: string; label: string }>> = {
  inbox: { href: "/dashboard/documents", label: "Open documents" },
  deals: { href: "/dashboard/inbox", label: "Open conversations" },
  approvals: { href: "/dashboard/invoices", label: "View invoices" },
  invoices: { href: "/dashboard/analytics", label: "Open Analytics Studio" },
  documents: { href: "/dashboard/inbox", label: "Open conversations" },
  activity: { href: "/dashboard/integrations", label: "Check integrations" },
  memory: { href: "/dashboard/agent", label: "View business rules" },
  notifications: { href: "/dashboard/activity", label: "View agent activity" },
};
type Props = { params: Promise<{ section: string }>; searchParams: Promise<{ workflow?: string | string[]; message?: string | string[] }> };
export const instant = false;
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = dashboardSection((await params).section);
  return {
    title: `${item?.label || "Workspace"} | AssentPay`,
    robots: { index: false, follow: false },
  };
}
export default async function SectionPage({ params, searchParams }: Props) {
  const { section } = await params,
    item = dashboardSection(section);
  if (!item || item.id === "overview") notFound();
  const query = await searchParams;
  const requestedWorkflow = ["approvals", "invoices"].includes(section) ? query.workflow : undefined;
  const messageId = section === "inbox" && typeof query.message === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/.test(query.message) ? query.message : undefined;
  const workflowId = typeof requestedWorkflow === "string" ? requestedWorkflow : undefined;
  const { workspace, user } = await dashboardContext();
  if (item.id === "settings") redirect(`/workspaces/${workspace.id}/settings`);
  const canManage = ["owner", "admin"].includes(workspace.role);
  const resourceProps = { workspaceId: workspace.id, userId: user.$id, timeZone: workspace.timezone };
  const Icon = sectionIcons[item.id];
  const workflowView = item.id === "deals" || item.id === "approvals" || item.id === "invoices" ? item.id : undefined;
  return (
    <div className={`${styles.page} ${styles.sectionPage}`}>
      <SectionHeader
        category={item.group === "intelligence" ? "Intelligence" : item.group === "manage" ? "Workspace settings" : "Workspace"}
        title={item.label}
        description={item.description}
        icon={<Icon size={26} />}
        tone={item.group === "intelligence" ? "violet" : item.group === "manage" ? "teal" : "blue"}
        action={workflowId ? { href: section === "invoices" ? "/dashboard/invoices" : "/dashboard/approvals", label: section === "invoices" ? "View all invoices" : "View all financial reviews" } : shortcuts[item.id]}
      />
      {["approvals", "invoices", "deals", "memory"].includes(section) ? (
        <BackendWorkspace workspaceId={workspace.id} userId={user.$id} timeZone={workspace.timezone} resource={section === "memory" ? "memory" : "workflows"} workflowId={workflowId} workflowView={workflowView} canManage={section === "memory" ? ["owner", "admin"].includes(workspace.role) : workspace.role === "owner"} />
      ) : section === "activity" ? (
        <ActivityViews
          timeline={<BackendWorkspace {...resourceProps} resource="activity" canManage={false} />}
          processing={<BackendWorkspace {...resourceProps} resource="jobs" canManage={canManage} />}
          deliveries={<BackendWorkspace {...resourceProps} resource="deliveries" canManage={false} />}
        />
      ) : section === "inbox" || section === "clients" || section === "documents" ? (
        <BackendWorkspace {...resourceProps} messageId={messageId} resource={section === "inbox" ? "messages" : section === "clients" ? "contacts" : "documents"} canManage={canManage} />
      ) : section === "integrations" ? (
        <>
          <Suspense fallback={<ResourceLoading title="Loading connections…" />}>
            <IntegrationPanel workspace={workspace} userId={user.$id} />
          </Suspense>
          <BackendWorkspace {...resourceProps} resource="jobs" canManage={canManage} />
        </>
      ) : section === "analytics" ? (
        <Suspense fallback={<ResourceLoading title="Loading analytics…" />}>
          <AnalyticsPanel workspaceId={workspace.id} userId={user.$id} />
        </Suspense>
      ) : section === "team" ? (
        <Suspense fallback={<ResourceLoading title="Loading team…" />}>
          <TeamPanel workspace={workspace} />
        </Suspense>
      ) : section === "agent" ? (
        <>
          <section className={styles.agentStatus}>
            <span className={styles.icon}>
              <Bot size={26} />
            </span>
            <div>
              <h2>How email review works</h2>
              <p>
                AssentPay checks received business emails for amounts, due dates and agreements. Review the extracted details and decide whether to approve any proposed financial action.
              </p>
            </div>
            <span className={styles.statusBadge}>Owner approval required</span>
          </section>
          <WorkspaceSettings workspace={workspace} rulesOnly />
          <BackendWorkspace workspaceId={workspace.id} userId={user.$id} resource="analyses" canManage={false} />
          <BackendWorkspace workspaceId={workspace.id} userId={user.$id} timeZone={workspace.timezone} resource="jobs" canManage={["owner", "admin"].includes(workspace.role)} />
        </>
      ) : section === "notifications" ? (
        <>
          <BackendWorkspace
            workspaceId={workspace.id}
            userId={user.$id}
            resource="notifications"
            canManage={false}
          />
          <Suspense fallback={<ResourceLoading title="Checking connection status…" />}>
            <ConnectionWarnings workspaceId={workspace.id} userId={user.$id} />
          </Suspense>
          <PhaseNotice>
            Automation notifications retain per-user read status. Connection
            warnings reflect the latest integration check.
          </PhaseNotice>
        </>
      ) : (
        <ResourceWorkspace key={section} section={section as ResourceSection} />
      )}
    </div>
  );
}

type DashboardWorkspace = Awaited<ReturnType<typeof dashboardContext>>["workspace"];

async function TeamPanel({ workspace }: { workspace: DashboardWorkspace }) {
  return <TeamManager workspace={workspace} members={await listMembers(workspace.id)} />;
}

async function IntegrationPanel({ workspace, userId }: { workspace: DashboardWorkspace; userId: string }) {
  const [integrations, inboxEndpoint] = await Promise.all([
    integrationSummaries(workspace.id, userId),
    optionalRow("inbound_endpoints", inboxId(workspace.id)),
  ]);
  const formatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: workspace.timezone });
  return <IntegrationManager
    initialInboxStatus={inboxEndpoint ? String(inboxEndpoint.status) : null}
    workspace={workspace}
    integrations={integrations}
    checkedAtLabels={Object.fromEntries(integrations.map(item => [item.provider, formatter.format(new Date(item.checkedAt))]))}
    ready={{ gmail: providerReady("gmail"), slack: providerReady("slack"), paypal: providerReady("paypal") }}
    triggerReady={Boolean(process.env.TRIGGER_SECRET_KEY && process.env.TRIGGER_PROJECT_REF)}
  />;
}

async function ConnectionWarnings({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  const attention = (await integrationSummaries(workspaceId, userId)).filter(item => item.status === "needs_attention");
  return (
  <section className={styles.panel}>
    <div className={styles.panelHeading}>
      <h2>Connection health</h2>
      <Bell size={18} />
    </div>
    {attention.length ? (
      attention.map((i) => (
        <Link
          key={i.provider}
          className={styles.notificationRow}
          href="/dashboard/integrations"
        >
          <AlertCircle size={20} />
          <div>
            <strong>
              {i.provider === "gmail"
                ? "Gmail"
                : i.provider === "slack"
                  ? "Slack"
                  : "PayPal"}{" "}
              needs attention
            </strong>
            <p>Review the connection and its granted permissions.</p>
          </div>
          <ArrowUpRight size={16} />
        </Link>
      ))
    ) : (
      <EmptyState
        title="No connection warnings"
        description="Your connected services have no outstanding warnings."
      />
    )}
  </section>
  );
}
