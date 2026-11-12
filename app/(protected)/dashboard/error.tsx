"use client";
import { RecoveryState } from "@/components/feedback/recovery";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <RecoveryState
      title="Your workspace couldn’t load"
      description="We couldn’t retrieve this workspace. Try again to reconnect, or choose another workspace."
      retry={retry}
      href="/workspaces"
      action="Choose a workspace"
    />
  );
}
