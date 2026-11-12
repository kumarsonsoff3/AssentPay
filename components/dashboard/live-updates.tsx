"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
export function LiveUpdates({ workspaceId }: { workspaceId: string }) {
  const router = useRouter(),
    revision = useRef<string | null>(null);
  useEffect(() => {
    revision.current = null;
    const source = new EventSource(`/api/workspaces/${workspaceId}/events`);
    const changed = (event: MessageEvent) => {
      try {
        const next = JSON.parse(event.data).revision;
        if (revision.current && next !== revision.current) router.refresh();
        revision.current = next;
      } catch {}
    };
    source.addEventListener("change", changed);
    return () => source.close();
  }, [workspaceId, router]);
  return null;
}
