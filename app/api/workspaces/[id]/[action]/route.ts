import { cookies } from "next/headers";
import { Client, Storage, Teams } from "node-appwrite";
import { dataClient, dataDatabase, databaseId } from "@/lib/data/client";
import { purgeWorkspace } from "@/lib/data/deletion";
import { assertDeletionConsent } from "@/lib/workspaces/settings-validation";
import { WORKSPACE_COOKIE } from "@/lib/workspaces/server";
import { withStorageOperation } from "@/lib/data/coordinator";
import { authConfig } from "@/lib/auth/config";
import { validEmail, normalizeEmail } from "@/lib/auth/validation";
import { audit } from "@/lib/automation/store";
import { nonce } from "@/lib/data/coordinator";
import {
  apiUser,
  workspaceAccess,
  getWorkspace,
  selectWorkspace,
  saveProfile,
  completeWorkspace,
  sessionTeams,
} from "@/lib/workspaces/server";
import { apiError, inputBody, json, rateLimit } from "@/lib/workspaces/http";
import {
  assignableRole,
  InputError,
  parseProfile,
  text,
  validId,
} from "@/lib/workspaces/validation";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; action: string }> },
) {
  try {
    const { id, action } = await context.params,
      input = await inputBody(request),
      user = await apiUser();
    if (
      !["select", "profile", "complete", "invite", "role", "remove", "rename", "delete"].includes(
        action,
      )
    )
      throw new InputError("Not found.", 404);
    await workspaceAccess(
      id,
      user.$id,
      action === "select"
        ? undefined
        : ["invite", "role", "remove", "delete"].includes(action)
          ? ["owner"]
          : ["owner", "admin"],
    );
    rateLimit(action, user.$id, action === "delete" ? 5 : action === "invite" ? 10 : 60);
    if (action === "select") {
      const workspace = await getWorkspace(id, user.$id);
      await selectWorkspace(id);
      return json({
        redirect: workspace.onboardingComplete
          ? "/dashboard"
          : `/workspaces/${id}/setup`,
      });
    }
    if (action === "delete") {
      const workspace = await getWorkspace(id, user.$id);
      assertDeletionConsent(input, user.email, workspace.name);
      return await withStorageOperation("deletion", async (op) => {
        const current = await getWorkspace(id, user.$id);
        if (current.role !== "owner") throw new InputError("Only owners can delete an organization.", 403);
        assertDeletionConsent(input, user.email, current.name);
        await purgeWorkspace({ db: dataDatabase(), storage: new Storage(dataClient()), databaseId: databaseId(), check: () => op.check(), commit: (run) => op.commit(run) }, id);
        await op.check();
        await (await sessionTeams()).delete({ teamId: id });
        const store = await cookies();
        if (store.get(WORKSPACE_COOKIE)?.value === id) store.delete(WORKSPACE_COOKIE);
        return json({ message: "Organization deleted.", redirect: "/workspaces" });
      });
    }
    return await withStorageOperation("mutation", async (op) => {
      await op.check();
      if (action === "rename") {
        const name = text(input, "name", 128).trim();
        if (!name) throw new InputError("Enter an organization name.");
        const config = authConfig();
        await new Teams(new Client().setEndpoint(config.endpoint).setProject(config.project).setKey(config.key)).updateName({ teamId: id, name });
        return json({ message: "Organization renamed." });
      }
      if (action === "profile") {
        await saveProfile(id, parseProfile(input));
        return json({ message: "Business profile saved." });
      }
      if (action === "complete") {
        await completeWorkspace(id);
        await selectWorkspace(id);
        return json({ redirect: "/dashboard" });
      }
      const teams = await sessionTeams();
      if (action === "invite") {
        const email = normalizeEmail(text(input, "email", 320)),
          role = assignableRole(input.role);
        if (!validEmail(email))
          throw new InputError("Enter a valid email address.");
        if (email === normalizeEmail(user.email))
          throw new InputError("You already belong to this workspace.");
        const invited = await teams.createMembership({
          teamId: id,
          email,
          roles: [role],
          url: `${authConfig().origin}/invitations/accept`,
        });
        await op.commit((db, tx) =>
          audit(db, tx, id, user.$id, "team.invited", invited.$id, nonce(), {
            role,
          }),
        );
        return json(
          {
            message: "Invitation sent. Ask your teammate to check their email.",
          },
          201,
        );
      }
      const membershipId = validId(text(input, "membershipId", 36));
      const member = await teams.getMembership({ teamId: id, membershipId });
      if (member.roles.includes("owner"))
        throw new InputError(
          "The workspace owner cannot be removed or assigned another role.",
          403,
        );
      if (action === "role")
        await teams.updateMembership({
          teamId: id,
          membershipId,
          roles: [assignableRole(input.role)],
        });
      else await teams.deleteMembership({ teamId: id, membershipId });
      await op.commit((db, tx) =>
        audit(
          db,
          tx,
          id,
          user.$id,
          action === "role" ? "team.role_changed" : "team.removed",
          membershipId,
          nonce(),
        ),
      );
      return json({
        message: action === "role" ? "Role updated." : "Membership removed.",
      });
    }, { retryConflicts: ["rename", "profile", "complete"].includes(action) });
  } catch (error) {
    return apiError(error);
  }
}
