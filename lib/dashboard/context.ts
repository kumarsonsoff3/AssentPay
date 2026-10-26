import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireVerifiedUser } from "../auth/appwrite";
import {
  listWorkspaces,
  listMembers,
  WORKSPACE_COOKIE,
} from "../workspaces/server";
import { integrationSummaries } from "../integrations/server";
import { pendingInvitation } from "../workspaces/invitations";
export const dashboardContext = cache(async () => {
  const user = await requireVerifiedUser();
  if (await pendingInvitation()) redirect("/invitations/accept");
  const workspaces = await listWorkspaces(user.$id);
  if (!workspaces.length) redirect("/onboarding");
  const selected = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const workspace =
    workspaces.find((w) => w.id === selected) ||
    (workspaces.length === 1 ? workspaces[0] : null);
  if (!workspace) redirect("/workspaces");
  if (!workspace.onboardingComplete)
    redirect(`/workspaces/${workspace.id}/setup`);
  const [integrations, members] = await Promise.all([
    integrationSummaries(workspace.id, user.$id),
    listMembers(workspace.id),
  ]);
  return { user, workspace, workspaces, integrations, members };
});
