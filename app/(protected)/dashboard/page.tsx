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
  const { user, workspace, integrations, members } = await dashboardContext();
  return (
    <DashboardHome
      operations={await operationalOverview(workspace.id)}
      name={user.name}
      workspace={workspace}
      integrations={integrations}
      members={members}
    />
  );
}
