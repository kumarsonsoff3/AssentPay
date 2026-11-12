export type LandingEntry = { href: string; label: string; signedIn: boolean };
type WorkspaceState = { id: string; onboardingComplete: boolean };
export function workspaceDestination(
  workspaces: WorkspaceState[],
  selected?: string,
): LandingEntry {
  if (!workspaces.length)
    return {
      href: "/onboarding",
      label: "Set up your workspace",
      signedIn: true,
    };
  const workspace =
    workspaces.find((w) => w.id === selected) ||
    (workspaces.length === 1 ? workspaces[0] : null);
  if (!workspace)
    return {
      href: "/workspaces",
      label: "Choose your workspace",
      signedIn: true,
    };
  return workspace.onboardingComplete
    ? { href: "/dashboard", label: "Open dashboard", signedIn: true }
    : {
        href: `/workspaces/${workspace.id}/setup`,
        label: "Continue setup",
        signedIn: true,
      };
}
