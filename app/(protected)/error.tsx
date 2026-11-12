"use client";
import { RecoveryState } from "@/components/feedback/recovery";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return <RecoveryState title="Your account couldn’t load" description="We couldn’t retrieve your account details. Try again to reconnect." retry={retry} href="/workspaces" action="Go to workspaces"/>;
}
