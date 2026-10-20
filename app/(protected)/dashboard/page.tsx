import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/auth/auth-form";
import { requireVerifiedUser } from "@/lib/auth/appwrite";

export const metadata: Metadata = {
  title: "Your account | AssentPay",
  robots: { index: false, follow: false },
};

async function AccountHome() {
  const user = await requireVerifiedUser();
  return (
    <div className="min-h-screen bg-muted/60">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b bg-white px-6 py-5 sm:px-12">
        <Link href="/" aria-label="AssentPay home">
          <Brand />
        </Link>
        <SignOutButton />
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-accent px-3 py-2 text-xs font-medium text-primary">
          <ShieldCheck size={15} />
          ACCOUNT READY
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">
          Welcome, {user.name || "you’re in"}.
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Your account is ready for the next step. Let’s make a little more room
          for your business.
        </p>
        <section
          className="mt-9 rounded-2xl border bg-white p-7 shadow-sm"
          aria-labelledby="account-heading"
        >
          <h2 id="account-heading" className="text-lg font-semibold">
            A secure start.
          </h2>
          <div className="mt-5 flex items-start gap-3">
            <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <Check size={14} />
            </span>
            <div>
              <p className="text-sm font-medium">Email verified</p>
              <p className="mt-1 break-all text-sm text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
          <div className="mt-6 border-t pt-6">
            <p className="text-sm font-medium">Your workspace is next</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Business profiles, team invitations, and integration setup are
              coming in the next part of onboarding.
            </p>
          </div>
        </section>
        <Link
          href="/"
          className="mt-7 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary"
        >
          Explore AssentPay
          <ArrowUpRight size={15} />
        </Link>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <p className="p-12" role="status">
          Loading your account…
        </p>
      }
    >
      <AccountHome />
    </Suspense>
  );
}
