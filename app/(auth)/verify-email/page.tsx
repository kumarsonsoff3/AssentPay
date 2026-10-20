import { AuthPanel } from "@/components/auth/auth-shell";
import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/auth-form";
import {
  AuthScreen,
  type AuthSearchParams,
} from "@/components/auth/auth-screen";
import { getCurrentUser } from "@/lib/auth/appwrite";

export const metadata: Metadata = { title: "Check your email" };

async function Verification({
  searchParams,
}: {
  searchParams: AuthSearchParams;
}) {
  const user = await getCurrentUser();
  if (!user || !user.status) redirect("/sign-in");
  if (user.emailVerification) redirect("/dashboard");
  return (
    <div>
      <AuthScreen
        mode="verify-email"
        email={user.email}
        searchParams={searchParams}
      />
      <div className="mt-6 flex justify-center">
        <SignOutButton />
      </div>
    </div>
  );
}

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: AuthSearchParams;
}) {
  return (
    <AuthPanel compact>
      <Suspense fallback={<p role="status">Loading your account…</p>}>
        <Verification searchParams={searchParams} />
      </Suspense>
    </AuthPanel>
  );
}
