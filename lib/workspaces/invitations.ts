import "server-only";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/integrations/crypto";
export const INVITATION_COOKIE = "assentpay-invitation";
export type Invitation = {
  teamId: string;
  membershipId: string;
  userId: string;
  secret: string;
  expiresAt: number;
};
export async function pendingInvitation() {
  const raw = (await cookies()).get(INVITATION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const invite = decrypt<Invitation>(raw, "invitation");
    return invite.expiresAt > Date.now() ? invite : null;
  } catch {
    return null;
  }
}
