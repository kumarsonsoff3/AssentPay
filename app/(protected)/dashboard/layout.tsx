import { Suspense } from "react";
import { dashboardContext } from "@/lib/dashboard/context";
import { WorkspaceShell } from "@/components/onboarding/workspace-shell";
import { DashboardLoading } from "@/components/dashboard/states";
// Session/membership checks must remain fresh and can redirect. This is the
// documented per-segment opt-out for auth with Cache Components; keep Suspense
// for the loading UI without caching credentials or workspace authorization.
export const instant = false;
async function Shell({ children }: { children: React.ReactNode }) {
  const { user, workspace, workspaces } = await dashboardContext();
  return (
    <WorkspaceShell
      email={user.email}
      name={user.name}
      workspaceName={workspace.name}
      workspaceId={workspace.id}
      workspaces={workspaces}
      active="overview"
    >
      {children}
    </WorkspaceShell>
  );
}
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
