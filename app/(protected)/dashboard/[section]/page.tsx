import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Bell,
  Bot,
  ArrowUpRight,
  AlertCircle,
} from "@/components/icons";
import { dashboardContext } from "@/lib/dashboard/context";
import { dashboardSection } from "@/lib/dashboard/navigation";
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
import settingsUi from "@/components/settings/settings.module.css";
import { inboxId } from "@/lib/automation/inbox";
import { optionalRow } from "@/lib/automation/store";
import { BackendWorkspace } from "@/components/dashboard/backend-workspace";
type Props = { params: Promise<{ section: string }>; searchParams: Promise<{ workflow?: string | string[] }> };
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
  if (!item || section === "overview") notFound();
  const requestedWorkflow = section === "approvals" ? (await searchParams).workflow : undefined;
  const workflowId = typeof requestedWorkflow === "string" ? requestedWorkflow : undefined;
  const { workspace, integrations, members, user } = await dashboardContext();
  if (section === "settings") redirect(`/workspaces/${workspace.id}/settings`);
  const attention = integrations.filter((i) => i.status === "needs_attention");
  const inboxEndpoint = section === "integrations" ? await optionalRow("inbound_endpoints", inboxId(workspace.id)) : null;
  return (
    <div className={`${styles.page} ${item.group === "manage" ? settingsUi.managementPage : ""}`}>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>
            {item.group === "intelligence"
              ? "WORKSPACE INTELLIGENCE"
              : item.group === "manage"
                ? "YOUR WORKSPACE"
                : "YOUR FINANCIAL WORKSPACE"}
          </p>
          <h1>{item.label}</h1>
          <p>{item.description}</p>
        </div>
      </div>
      {workflowId && <Link href="/dashboard/approvals">View all financial reviews</Link>}
      {["approvals", "invoices", "deals", "memory"].includes(section) ? (
        <BackendWorkspace workspaceId={workspace.id} userId={user.$id} resource={section === "memory" ? "memory" : "workflows"} workflowId={workflowId} canManage={section === "memory" ? ["owner", "admin"].includes(workspace.role) : workspace.role === "owner"} />
      ) : ["inbox", "clients", "documents", "activity"].includes(section) ? (
        <>
          <BackendWorkspace
            workspaceId={workspace.id}
            timeZone={workspace.timezone}
            userId={user.$id}
            resource={
              section === "inbox"
                ? "messages"
                : section === "clients"
                  ? "contacts"
                  : section === "documents"
                    ? "documents"
                    : "activity"
            }
            canManage={["owner", "admin"].includes(workspace.role)}
          />
          {section === "activity" && (
            <BackendWorkspace
              workspaceId={workspace.id}
              userId={user.$id}
              timeZone={workspace.timezone} resource="jobs"
              canManage={["owner", "admin"].includes(workspace.role)}
            />
          )}
          {section === "activity" && <BackendWorkspace workspaceId={workspace.id} userId={user.$id} resource="deliveries" canManage={false} />}
        </>
      ) : section === "integrations" ? (
        <>
          <IntegrationManager
            initialInboxStatus={inboxEndpoint ? String(inboxEndpoint.status) : null}
            workspace={workspace}
            integrations={integrations}
            checkedAtLabels={Object.fromEntries(
              integrations.map((integration) => [
                integration.provider,
                new Intl.DateTimeFormat("en", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: workspace.timezone,
                }).format(new Date(integration.checkedAt)),
              ]),
            )}
            ready={{
              gmail: providerReady("gmail"),
              slack: providerReady("slack"),
              paypal: providerReady("paypal"),
            }}
            triggerReady={Boolean(
              process.env.TRIGGER_SECRET_KEY && process.env.TRIGGER_PROJECT_REF,
            )}
          />
          <BackendWorkspace
            workspaceId={workspace.id}
            userId={user.$id}
            timeZone={workspace.timezone} resource="jobs"
            canManage={["owner", "admin"].includes(workspace.role)}
          />
        </>
      ) : section === "team" ? (
        <TeamManager workspace={workspace} members={members} />
      ) : section === "agent" ? (
        <>
          <section className={styles.agentStatus}>
            <span className={styles.icon}>
              <Bot size={26} />
            </span>
            <div>
              <h2>An agent that works by your rules.</h2>
              <p>
                AssentPay checks received business emails for amounts, due dates and agreements. Review the extracted details and decide whether to approve any proposed financial action.
              </p>
            </div>
            <span className={styles.statusBadge}>Email review & processing</span>
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
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <h2>Workspace updates</h2>
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
                title="You’re all caught up"
                description="There are no connection warnings. Financial and agent notifications will appear once those workflows are enabled."
              />
            )}
          </section>
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
