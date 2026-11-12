import { LoadingState } from "@/components/feedback/feedback";
import { Suspense } from "react";
import type { Metadata } from "next";
import { requireVerifiedUser } from "@/lib/auth/appwrite";
import { listWorkspaces } from "@/lib/workspaces/server";
import { WorkspaceShell } from "@/components/onboarding/workspace-shell";
import { WorkspacePicker } from "@/components/onboarding/workspace-picker";
export const metadata: Metadata = {
  title: "Your workspaces | AssentPay",
  robots: { index: false, follow: false },
};
async function Workspaces({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireVerifiedUser(),
    workspaces = await listWorkspaces(user.$id),
    params = await searchParams;
  return (
    <WorkspaceShell name={user.name} email={user.email} workspaces={workspaces}>
      <WorkspacePicker
        workspaces={workspaces}
        name={user.name}
        connectionFailed={params.connection === "failed"}
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
        <LoadingState title="Loading your workspaces…" />
      }
    >
      <Workspaces {...props} />
    </Suspense>
  );
}
