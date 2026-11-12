import { listMembers } from "@/lib/workspaces/server";
import { integrationSummaries } from "@/lib/integrations/server";
import type { Metadata } from "next";
import { dashboardContext } from "@/lib/dashboard/context";
import { operationalOverview } from "@/lib/dashboard/operations";
import { DashboardHome } from "@/components/onboarding/dashboard-home";
export const metadata: Metadata = {
  title: "Overview | AssentPay",
  robots: { index: false, follow: false },
};
export const instant = false;
export default async function DashboardPage() {
  const { user, workspace } = await dashboardContext();
  const [operations, integrations, members] = await Promise.all([
    operationalOverview(workspace.id),
    integrationSummaries(workspace.id, user.$id),
    listMembers(workspace.id),
  ]);
  return (
    <DashboardHome
      operations={operations}
      name={user.name}
      workspace={workspace}
      integrations={integrations}
      members={members}
    />
  );
}
