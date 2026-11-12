import { withStorageOperation } from "@/lib/data/coordinator";
import { cookies } from "next/headers";
import { authConfig } from "@/lib/auth/config";
import { encrypt } from "@/lib/integrations/crypto";
import {
  apiUser,
  sessionTeams,
  selectWorkspace,
} from "@/lib/workspaces/server";
import {
  INVITATION_COOKIE,
  pendingInvitation,
} from "@/lib/workspaces/invitations";
import { apiError, inputBody, json, rateLimit } from "@/lib/workspaces/http";
import { InputError, text, validId } from "@/lib/workspaces/validation";
import { audit } from "@/lib/automation/store";
import { nonce } from "@/lib/data/coordinator";
export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  try {
    const input = await inputBody(request),
      { action } = await context.params,
      store = await cookies();
    if (action === "dismiss") {
      store.delete(INVITATION_COOKIE);
      return json({ redirect: "/dashboard" });
    }
    if (action === "remember") {
      const invite = {
        teamId: validId(text(input, "teamId", 36)),
        membershipId: validId(text(input, "membershipId", 36)),
        userId: validId(text(input, "userId", 36)),
        secret: text(input, "secret", 512),
        expiresAt: Date.now() + 3600000,
      };
      store.set(INVITATION_COOKIE, encrypt(invite, "invitation"), {
        httpOnly: true,
        secure: authConfig().secure,
        sameSite: "lax",
        path: "/",
        maxAge: 3600,
      });
      return json({ redirect: "/invitations/accept" });
    }
    if (action !== "accept") throw new InputError("Not found.", 404);
    const user = await apiUser(),
      invite = await pendingInvitation();
    rateLimit("accept", user.$id, 10);
    if (!invite)
      throw new InputError("Reopen your invitation email to continue.");
    if (invite.userId !== user.$id)
      throw new InputError(
        "Sign in with the email address that received this invitation.",
        403,
      );
    return await withStorageOperation("mutation", async (op) => {
      await op.check();
      await (
        await sessionTeams()
      ).updateMembershipStatus({
        teamId: invite.teamId,
        membershipId: invite.membershipId,
        userId: user.$id,
        secret: invite.secret,
      });
      await op.commit((db, tx) =>
        audit(
          db,
          tx,
          invite.teamId,
          user.$id,
          "team.invitation_accepted",
          invite.membershipId,
          nonce(),
        ),
      );
      store.delete(INVITATION_COOKIE);
      await selectWorkspace(invite.teamId);
      return json({ redirect: "/dashboard" });
    });
  } catch (error) {
    return apiError(error);
  }
}
