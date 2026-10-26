import { LoadingState } from "@/components/feedback/feedback";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireVerifiedUser } from "@/lib/auth/appwrite";
import { getWorkspace, listMembers, listWorkspaces } from "@/lib/workspaces/server";
import { InputError } from "@/lib/workspaces/validation";
import { integrationSummaries } from "@/lib/integrations/server";
import { providerReady } from "@/lib/integrations/providers";
import { WorkspaceShell } from "@/components/onboarding/workspace-shell";
import { SetupWizard } from "@/components/onboarding/setup-wizard";
export const metadata: Metadata = {
  title: "Set up your workspace | AssentPay",
  robots: { index: false, follow: false },
};
type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
async function Setup(props: Props) {
  const user = await requireVerifiedUser(),
    { id } = await props.params;
  let workspace;
  try {
    workspace = await getWorkspace(id, user.$id);
  } catch (error) {
    if (error instanceof InputError && [400, 403].includes(error.status))
      notFound();
    throw error;
  }
  const [members, integrations, params, workspaces] = await Promise.all([
    listMembers(id),
    integrationSummaries(id, user.$id),
    props.searchParams,
    listWorkspaces(user.$id),
  ]);
  return (
    <WorkspaceShell
      email={user.email}
      name={user.name}
      workspaceName={workspace.name}
      workspaceId={id}
      workspaces={workspaces}
      active="setup"
    >
      <SetupWizard
        workspace={workspace}
        initialStep={
          typeof params.step === "string" && /^[0-3]$/.test(params.step)
            ? Number(params.step)
            : undefined
        }
        integrations={integrations}
        members={members}
        ready={{
          gmail: providerReady("gmail"),
          slack: providerReady("slack"),
          paypal: providerReady("paypal"),
        }}
        triggerReady={Boolean(process.env.TRIGGER_SECRET_KEY)}
        connectionResult={
          typeof params.connection === "string" ? params.connection : undefined
        }
      />
    </WorkspaceShell>
  );
}
export default function Page(props: Props) {
  return (
    <Suspense
      fallback={
        <LoadingState title="Loading workspace setup…" />
      }
    >
      <Setup {...props} />
    </Suspense>
  );
}
