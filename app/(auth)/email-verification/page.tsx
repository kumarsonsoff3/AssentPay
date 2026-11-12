import { LoadingState } from "@/components/feedback/feedback";
import { AuthPanel } from "@/components/auth/auth-shell";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  AuthScreen,
  type AuthSearchParams,
} from "@/components/auth/auth-screen";

export const metadata: Metadata = { title: "Verify your email" };
export default function EmailVerificationPage({
  searchParams,
}: {
  searchParams: AuthSearchParams;
}) {
  return (
    <AuthPanel compact>
      <Suspense fallback={<LoadingState title="Loading email verification…" />}>
        <AuthScreen mode="email-verification" searchParams={searchParams} />
      </Suspense>
    </AuthPanel>
  );
}
