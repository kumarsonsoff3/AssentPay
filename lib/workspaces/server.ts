import "server-only";
import { cookies } from "next/headers";
import {
  AppwriteException,
  ID,
  Query,
  Teams,
  type Models,
} from "node-appwrite";
import { Client } from "node-appwrite";
import { authConfig, SESSION_COOKIE } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/appwrite";
import { RuntimeStore } from "@/lib/data/runtime";
import { dataDatabase, databaseId } from "@/lib/data/client";
import { withStorageOperation } from "@/lib/data/coordinator";
import {
  defaultProfile,
  type Workspace,
  type BusinessProfile,
  type WorkspaceRole,
} from "./types";
import { InputError, validId } from "./validation";
import { assertWorkspaceMembership } from "./access";
import { provisionInbox } from "../automation/inbox";
export const WORKSPACE_COOKIE = "assentpay-workspace";
export function workspaceStore(userId: string) {
  return new RuntimeStore(
    dataDatabase(),
    databaseId(),
    userId,
    async (id, roles) => {
      const actor = await apiUser();
      if (actor.$id !== userId)
        throw new InputError("Sign in to continue.", 401);
      await workspaceAccess(id, actor.$id, roles);
    },
  );
}
export async function sessionTeams() {
  const { endpoint, project } = authConfig();
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) throw new InputError("Sign in to continue.", 401);
  return new Teams(
    new Client().setEndpoint(endpoint).setProject(project).setSession(session),
  );
}
export async function apiUser() {
  const user = await getCurrentUser();
  if (!user?.status) throw new InputError("Sign in to continue.", 401);
  if (!user.emailVerification)
    throw new InputError("Verify your email to continue.", 403);
  return user;
}
export async function membership(teamId: string, userId: string) {
  validId(teamId);
  const teams = await sessionTeams();
  try {
    const result = await teams.listMemberships({
      teamId,
      queries: [
        Query.equal("userId", userId),
        Query.equal("confirm", true),
        Query.limit(1),
      ],
    });
    assertWorkspaceMembership(result.memberships[0], teamId, userId);
    return result.memberships[0];
  } catch (error) {
    if (
      error instanceof AppwriteException &&
      [401, 403, 404].includes(error.code)
    )
      throw new InputError("You do not have access to this workspace.", 403);
    throw error;
  }
}
export async function workspaceAccess(
  teamId: string,
  userId: string,
  roles?: WorkspaceRole[],
) {
  const member = await membership(teamId, userId),
    role = assertWorkspaceMembership(member, teamId, userId, roles);
  return { member, role };
}
export async function getWorkspace(
  teamId: string,
  userId: string,
): Promise<Workspace> {
  const { role } = await workspaceAccess(teamId, userId);
  const [team, stored] = await Promise.all([
    (await sessionTeams()).get({ teamId }),
    workspaceStore(userId).profile(teamId),
  ]);
  const profile = stored?.profile;
  return {
    ...defaultProfile,
    ...profile,
    id: teamId,
    name: team.name,
    role,
    profileSaved: profile?.profileSaved || false,
    onboardingComplete: profile?.onboardingComplete || false,
  };
}
export async function listWorkspaces(userId: string) {
  const teams = await sessionTeams();
  let cursor: string | undefined;
  const result: Workspace[] = [];
  do {
    const page = await teams.list({
      queries: [
        Query.limit(100),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
    });
    for (const team of page.teams) {
      try {
        result.push(await getWorkspace(team.$id, userId));
      } catch (error) {
        if (!(error instanceof InputError && error.status === 403)) throw error;
      }
    }
    cursor = page.teams.length === 100 ? page.teams.at(-1)?.$id : undefined;
  } while (cursor);
  return result;
}
export async function selectWorkspace(id: string) {
  (await cookies()).set(WORKSPACE_COOKIE, id, {
    httpOnly: true,
    secure: authConfig().secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
export async function createWorkspace(name: string, userId: string) {
  const user = await apiUser();
  if (user.$id !== userId) throw new InputError("Sign in to continue.", 401);
  return withStorageOperation("mutation", async (op) => {
    const teams = await sessionTeams();
    await op.check();
    const team = await teams.create({
      teamId: ID.unique(),
      name,
      roles: ["owner"],
    });
    const store = workspaceStore(userId);
    try {
      await store.createProfile(team.$id, {
        ...defaultProfile,
        businessName: name,
        profileSaved: false,
        onboardingComplete: false,
      });
    } catch (error) {
      // Compensate only when the profile is confirmed absent; an ambiguous
      // transaction result must not destroy a successfully-created workspace.
      if (!(await store.profile(team.$id)))
        await teams.delete({ teamId: team.$id });
      throw error;
    }
    if (process.env.RESEND_INBOUND_DOMAIN) await provisionInbox(team.$id, userId);
    await selectWorkspace(team.$id);
    return getWorkspace(team.$id, userId);
  });
}
export async function saveProfile(id: string, profile: BusinessProfile) {
  const user = await apiUser();
  return withStorageOperation("mutation", async () => {
    const store = workspaceStore(user.$id),
      previous = await store.profile(id);
    if (!previous)
      throw new InputError(
        "Workspace configuration is missing. Contact the workspace owner.",
        409,
      );
    await store.updateProfile(
      id,
      {
        ...profile,
        profileSaved: true,
        onboardingComplete: previous.profile.onboardingComplete,
      },
      previous.revision,
    );
  });
}
export async function completeWorkspace(id: string) {
  const user = await apiUser();
  return withStorageOperation("mutation", async () => {
    const store = workspaceStore(user.$id),
      previous = await store.profile(id);
    if (!previous?.profile.profileSaved)
      throw new InputError("Save your business profile first.");
    await store.updateProfile(
      id,
      { ...previous.profile, onboardingComplete: true },
      previous.revision,
    );
  });
}
export async function listMembers(id: string) {
  const teams = await sessionTeams();
  const members: Models.Membership[] = [];
  let cursor: string | undefined;
  do {
    const page = await teams.listMemberships({
      teamId: id,
      queries: [
        Query.limit(100),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
    });
    members.push(...page.memberships);
    cursor =
      page.memberships.length === 100
        ? page.memberships.at(-1)?.$id
        : undefined;
  } while (cursor);
  return members.map((m) => ({
    id: m.$id,
    userId: m.userId,
    name: m.userName,
    email: m.userEmail,
    roles: m.roles,
    confirmed: m.confirm,
  }));
}
