import { notFound } from "next/navigation";
import { requireVerifiedUser } from "@/lib/auth/appwrite";
import { getWorkspace, listWorkspaces } from "@/lib/workspaces/server";
import { InputError } from "@/lib/workspaces/validation";
import { WorkspaceShell } from "@/components/onboarding/workspace-shell";
import { WorkspaceSettings } from "@/components/dashboard/management";
import { DangerZone } from "@/components/settings/danger-zone";
import { RenameWorkspace } from "@/components/settings/rename-workspace";
import { SettingsPage, SettingsSection, PermissionNotice } from "./settings-layout";
export async function WorkspaceSettingsPage({ params }: { params: Promise<{ id: string; section?: string }> }) {
  const user = await requireVerifiedUser(), { id, section = "general" } = await params;
  if (!["general", "organization", "danger-zone"].includes(section)) notFound();
  const titles: Record<string, string> = { general: "Business profile", organization: "Organization name", "danger-zone": "Danger zone" };
  let workspace;
  try { workspace = await getWorkspace(id, user.$id); }
  catch (error) { if (error instanceof InputError && [400, 403].includes(error.status)) notFound(); throw error; }
  const workspaces = await listWorkspaces(user.$id);
  return <WorkspaceShell pageTitle={titles[section]} email={user.email} name={user.name} workspaceId={id} workspaceName={workspace.name} workspaces={workspaces} active="settings">
    <SettingsPage eyebrow="WORKSPACE SETTINGS" title={titles[section]} description={{general:"The business details and local preferences for your workspace.",organization:"Give your organization a name your team recognizes.","danger-zone":"Manage the permanent removal of this organization."}[section]!}>
      {section === "organization" && <SettingsSection title="Workspace identity" description="This is the name you see in AssentPay, in the workspace switcher, and across your team’s workspace." note={<><strong>One primary name</strong>Your business profile can use a different trading name when you need one.</>}>
        {["owner", "admin"].includes(workspace.role) ? <RenameWorkspace key={id} id={id} name={workspace.name}/> : <PermissionNotice>Only an owner or admin can change this organization’s name.</PermissionNotice>}
      </SettingsSection>}
      {section === "general" && <WorkspaceSettings workspace={workspace} profileOnly/>}
      {section === "danger-zone" && <SettingsSection title="Organization deletion" description="Remove this workspace and its data for everyone on your team." note={<><strong>Affects the whole organization</strong>You’ll review what’s removed, then type the organization name and your email to confirm.</>}>
        {workspace.role === "owner" ? <DangerZone email={user.email} workspace={workspace}/> : <PermissionNotice>Only the owner can permanently delete this organization.</PermissionNotice>}
      </SettingsSection>}
    </SettingsPage>
  </WorkspaceShell>;
}
