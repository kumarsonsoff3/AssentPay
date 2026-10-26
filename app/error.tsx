"use client";
import { RecoveryState } from "@/components/feedback/recovery";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return <RecoveryState title="Something interrupted this page" description="We couldn’t finish loading this page. Try again to pick up where you left off." retry={retry} href="/" action="Go to home"/>;
}
