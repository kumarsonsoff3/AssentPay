import { cookies } from "next/headers";
import { Client, Storage, Teams, Users } from "node-appwrite";
import { createAccount, clearSessionCookies } from "@/lib/auth/appwrite";
import { authConfig, SESSION_COOKIE } from "@/lib/auth/config";
import { changePassword } from "@/lib/auth/password-change";
import { apiUser } from "@/lib/workspaces/server";
import { apiError, inputBody, json, rateLimit } from "@/lib/workspaces/http";
import { InputError, text } from "@/lib/workspaces/validation";
import { withStorageOperation } from "@/lib/data/coordinator";
import { dataClient, dataDatabase, databaseId } from "@/lib/data/client";
import { purgeAccountReferences } from "@/lib/data/deletion";
import { assertDeletionConsent, assertNoOwnedOrganizations } from "@/lib/workspaces/settings-validation";
import { scanMemberships } from "@/lib/workspaces/settings-server";

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  try {
    const input = await inputBody(request);
    const user = await apiUser();
    const { action } = await params;
    if (!["profile", "password", "delete"].includes(action)) throw new InputError("Not found.", 404);
    rateLimit(`account-${action}`, user.$id, action === "profile" ? 20 : 5);
    const session = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!session) throw new InputError("Sign in to continue.", 401);
    const account = createAccount(session);
    if (action === "profile") {
      const name = text(input, "name", 128).trim();
      if (!name) throw new InputError("Enter your name.");
      await account.updateName({ name });
      return json({ message: "Account details saved." });
    }
    if (action === "password") {
      await changePassword(account, input, user.passwordUpdate);
      const config = authConfig();
      await new Users(new Client().setEndpoint(config.endpoint).setProject(config.project).setKey(config.key)).deleteSessions({ userId: user.$id });
      await clearSessionCookies();
      return json({ message: "Password changed. Sign in again.", redirect: "/sign-in" });
    }
    assertDeletionConsent(input, user.email);
    const config = authConfig();
    const admin = new Client().setEndpoint(config.endpoint).setProject(config.project).setKey(config.key);
    const users = new Users(admin), teams = new Teams(admin);
    return await withStorageOperation("deletion", async (op) => {
      const memberships = await scanMemberships(users, user.$id);
      assertNoOwnedOrganizations(memberships);
      await purgeAccountReferences({ db: dataDatabase(), storage: new Storage(dataClient()), databaseId: databaseId(), check: () => op.check(), commit: (run) => op.commit(run) }, user.$id);
      for (const membership of memberships) {
        await op.check();
        await teams.deleteMembership({ teamId: membership.teamId, membershipId: membership.$id });
      }
      await op.check();
      await users.delete({ userId: user.$id });
      await clearSessionCookies();
      return json({ message: "Account deleted.", redirect: "/sign-in" });
    });
  } catch (error) { return apiError(error); }
}
