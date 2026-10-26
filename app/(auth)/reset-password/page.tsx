import { LoadingState } from "@/components/feedback/feedback";
import { AuthPanel } from "@/components/auth/auth-shell";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  AuthScreen,
  type AuthSearchParams,
} from "@/components/auth/auth-screen";

export const metadata: Metadata = { title: "Choose a new password" };
export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: AuthSearchParams;
}) {
  return (
    <AuthPanel compact>
      <Suspense fallback={<LoadingState title="Loading password reset…" />}>
        <AuthScreen mode="reset-password" searchParams={searchParams} />
      </Suspense>
    </AuthPanel>
  );
}
