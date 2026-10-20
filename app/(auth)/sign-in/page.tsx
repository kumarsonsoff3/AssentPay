import { AuthPanel } from "@/components/auth/auth-shell";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  AuthScreen,
  type AuthSearchParams,
} from "@/components/auth/auth-screen";

export const metadata: Metadata = { title: "Sign in" };
export default function SignInPage({
  searchParams,
}: {
  searchParams: AuthSearchParams;
}) {
  return (
    <AuthPanel>
      <Suspense fallback={<p role="status">Loading sign in…</p>}>
        <AuthScreen mode="sign-in" searchParams={searchParams} />
      </Suspense>
    </AuthPanel>
  );
}
