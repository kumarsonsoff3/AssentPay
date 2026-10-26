import { requireVerifiedUser } from "@/lib/auth/appwrite";
import { listWorkspaces } from "@/lib/workspaces/server";
import { WorkspaceShell } from "@/components/onboarding/workspace-shell";
import { AccountSettings } from "@/components/settings/account-settings";
import { SettingsPage } from "./settings-layout";

import { notFound } from "next/navigation";
export async function AccountSettingsPage({ section = "profile" }: { section?: string }) {
  if (!["profile", "organizations", "security", "danger-zone"].includes(section)) notFound();
  const titles: Record<string, string> = { profile: "Profile", organizations: "Organizations", security: "Password & security", "danger-zone": "Danger zone" };
  const user = await requireVerifiedUser();
  const workspaces = await listWorkspaces(user.$id);
  return (
    <WorkspaceShell pageTitle={titles[section]} name={user.name} email={user.email} workspaces={workspaces} active="account">
      <SettingsPage eyebrow="ACCOUNT SETTINGS" title={titles[section]} description={{profile:"Your personal details, shared across the places you work.",organizations:"Choose the business you’d like to manage.",security:"Manage how you sign in and protect your account.","danger-zone":"Review the options for permanently closing your account."}[section]!}>
        <AccountSettings key={section} name={user.name} email={user.email} workspaces={workspaces} section={section} />
      </SettingsPage>
    </WorkspaceShell>
  );
}

