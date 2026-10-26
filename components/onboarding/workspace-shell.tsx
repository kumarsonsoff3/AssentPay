import Link from "next/link";
import { UserRound } from "@/components/icons";
import { Brand } from "@/components/brand";
import { AccountMenu } from "./account-menu";
import { NotificationOverlay } from "@/components/dashboard/notification-overlay";
import styles from "./onboarding.module.css";
import { WorkspaceSwitcher } from "./workspace-switcher";
import type { Workspace } from "@/lib/workspaces/types";
import {
  AccountNavigation,
  DashboardNavigation,
  DashboardBreadcrumb,
  MobileDashboardNavigation,
} from "@/components/dashboard/navigation";
export function WorkspaceShell({
  email,
  name,
  pageTitle,
  children,
  workspaceName,
  workspaceId,
  workspaces = [],
  active = "workspaces",
}: {
  email: string;
  name?: string;
  pageTitle?: string;
  children: React.ReactNode;
  workspaceName?: string;
  workspaceId?: string;
  workspaces?: Workspace[];
  active?: "workspaces" | "overview" | "setup" | "account" | "settings";
}) {
  const workspace = workspaces.find((item) => item.id === workspaceId);
  const navigationProps = {
    workspaceId,
    ready: workspace?.onboardingComplete ?? active === "overview",
    selectBeforeNavigation: active === "setup" || active === "settings",
  };
  return (
    <div className={styles.app}>
      <a href="#workspace-main" className="skip-link">
        Skip to content
      </a>
      <aside className={styles.appSidebar}>
        <Link
          href="/workspaces"
          className={styles.sidebarBrand}
          aria-label="AssentPay home"
        >
          <Brand />
        </Link>
        {active === "account" ? <div className={styles.accountContext}><span><UserRound size={19}/></span><div><strong>Personal account</strong><small>{name || email}</small></div></div> : <WorkspaceSwitcher workspaces={workspaces} workspaceId={workspaceId} workspaceName={workspaceName} />}
        {workspaceId ? <DashboardNavigation {...navigationProps} /> : <AccountNavigation settings={active === "account"} />}
      </aside>
      <div className={styles.appBody}>
        <header className={styles.header}>
          <div className={styles.mobileBrand}>
            {active === "account" ? <Brand /> : <WorkspaceSwitcher workspaces={workspaces} workspaceId={workspaceId} workspaceName={workspaceName} />}
          </div>
          <div className={styles.breadcrumb}>
            {workspaceId ? workspaceName : "Your account"}<span>/</span>
            <strong>
              {pageTitle || (active === "overview"
                ? <DashboardBreadcrumb />
                : active === "setup"
                  ? "Setup"
                  : active === "settings" ? "Workspace settings" : active === "account" ? "Account settings" : "Workspaces")}
            </strong>
          </div>
          <div className={styles.headerRight}>
            {active === "overview" && workspaceId && <NotificationOverlay key={workspaceId} workspaceId={workspaceId} />}
            <AccountMenu name={name} email={email} role={workspace?.role} />
          </div>
        </header>
        {workspaceId ? <MobileDashboardNavigation {...navigationProps} /> : <AccountNavigation mobile settings={active === "account"} />}
        <main id="workspace-main">{children}</main>
      </div>
    </div>
  );
}
