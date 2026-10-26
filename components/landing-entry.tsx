import "server-only";
import { Suspense, cache } from "react";
import { cookies } from "next/headers";
import { ArrowUpRight } from "@/components/icons";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/appwrite";
import { listWorkspaces, WORKSPACE_COOKIE } from "@/lib/workspaces/server";
import { pendingInvitation } from "@/lib/workspaces/invitations";
import {
  workspaceDestination,
  type LandingEntry,
} from "@/lib/workspaces/destination";
import { SiteHeader } from "./site-header";
const entry = cache(async (): Promise<LandingEntry> => {
  const user = await getCurrentUser();
  if (!user?.status)
    return { href: "/sign-up", label: "Get started", signedIn: false };
  if (!user.emailVerification)
    return {
      href: "/verify-email",
      label: "Verify your email",
      signedIn: true,
    };
  if (await pendingInvitation())
    return {
      href: "/invitations/accept",
      label: "Review invitation",
      signedIn: true,
    };
  // A storage outage must not break the public landing page or imply the user
  // is signed out. The protected dispatcher can retry the authoritative lookup.
  try {
    return workspaceDestination(
      await listWorkspaces(user.$id),
      (await cookies()).get(WORKSPACE_COOKIE)?.value,
    );
  } catch {
    return { href: "/dashboard", label: "Open workspace", signedIn: true };
  }
});
async function Header() {
  return <SiteHeader entry={await entry()} />;
}
export function LandingHeader() {
  return (
    <Suspense
      fallback={
        <SiteHeader
          entry={{
            href: "/dashboard",
            label: "Open workspace",
            signedIn: true,
          }}
        />
      }
    >
      <Header />
    </Suspense>
  );
}
async function Action({ className }: { className?: string }) {
  const target = await entry();
  return (
    <a href={target.href} className={className}>
      {target.label}
      <ArrowUpRight className="size-4" aria-hidden="true" />
    </a>
  );
}
export function LandingAction({ className }: { className?: string }) {
  return (
    <Suspense
      fallback={
        <Link href="/dashboard" className={className}>
          Open workspace
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      }
    >
      <Action className={className} />
    </Suspense>
  );
}
