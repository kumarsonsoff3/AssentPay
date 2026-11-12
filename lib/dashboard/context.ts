import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireVerifiedUser } from "../auth/appwrite";
import {
  listWorkspaces,
  WORKSPACE_COOKIE,
} from "../workspaces/server";
import { pendingInvitation } from "../workspaces/invitations";
export const dashboardContext = cache(async () => {
  const [user, invitation, cookieStore] = await Promise.all([requireVerifiedUser(), pendingInvitation(), cookies()]);
  if (invitation) redirect("/invitations/accept");
  const workspaces = await listWorkspaces(user.$id);
  if (!workspaces.length) redirect("/onboarding");
  const selected = cookieStore.get(WORKSPACE_COOKIE)?.value;
  const workspace =
    workspaces.find((w) => w.id === selected) ||
    (workspaces.length === 1 ? workspaces[0] : null);
  if (!workspace) redirect("/workspaces");
  if (!workspace.onboardingComplete)
    redirect(`/workspaces/${workspace.id}/setup`);
  return { user, workspace, workspaces };
});
