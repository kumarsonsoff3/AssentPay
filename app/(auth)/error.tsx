"use client";
import { RecoveryState } from "@/components/feedback/recovery";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return <RecoveryState title="We couldn’t open sign in" description="Sign in is temporarily unavailable. Try again in a moment." retry={retry} href="/sign-in" action="Back to sign in"/>;
}
