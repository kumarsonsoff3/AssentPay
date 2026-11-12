import { Suspense, type ReactNode } from "react";
import { requireVerifiedUser } from "@/lib/auth/appwrite";
import { LoadingState } from "@/components/feedback/feedback";

async function VerifiedAccount({ children }: { children: ReactNode }) {
  await requireVerifiedUser();
  return children;
}

// Defense in depth; pages and data boundaries retain their own checks.
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingState title="Opening your account…"/>}><VerifiedAccount>{children}</VerifiedAccount></Suspense>;
}
