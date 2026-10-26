import { LoadingState } from "@/components/feedback/feedback";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/appwrite";
import { pendingInvitation } from "@/lib/workspaces/invitations";
import { InvitationView } from "@/components/onboarding/invitation";
import { WorkspaceShell } from "@/components/onboarding/workspace-shell";
export const metadata: Metadata = {
  title: "Join your team | AssentPay",
  robots: { index: false, follow: false },
};
async function Invite({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, user, saved] = await Promise.all([
    searchParams,
    getCurrentUser(),
    pendingInvitation(),
  ]);
  const fields = ["teamId", "membershipId", "userId", "secret"] as const;
  const valid = fields.every(
    (key) =>
      typeof params[key] === "string" && (params[key] as string).length < 513,
  );
  const invitation = valid
    ? {
        teamId: params.teamId as string,
        membershipId: params.membershipId as string,
        userId: params.userId as string,
        secret: params.secret as string,
      }
    : null;
  return (
    <WorkspaceShell email={user?.email || ""}>
      <InvitationView
        invitation={invitation}
        saved={!!saved}
        signedIn={!!user?.status}
        verified={!!user?.emailVerification}
        email={user?.email}
      />
    </WorkspaceShell>
  );
}
export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense
      fallback={
        <LoadingState title="Loading your invitation…" />
      }
    >
      <Invite {...props} />
    </Suspense>
  );
}
