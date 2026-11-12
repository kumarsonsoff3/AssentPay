"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "@/components/icons";
import { Spinner } from "@/components/feedback/feedback";

export function RefreshDashboard({ className }: { className: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      aria-label={pending ? "Refreshing dashboard" : "Refresh dashboard"}
      title="Refresh dashboard"
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? <Spinner size={18} /> : <RefreshCw size={18} />}
    </button>
  );
}
