"use client";
import { requestErrorMessage } from "@/lib/request-feedback";
import { Spinner } from "@/components/feedback/feedback";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Popover } from "radix-ui";
import { ArrowRight, Bell, X } from "@/components/icons";
import styles from "./notification-overlay.module.css";

type Notification = {
  id: string;
  title: string;
  description: string;
  read: boolean;
  updatedAt: string;
};

export function NotificationOverlay({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/resources/notifications`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Couldn’t load notifications.");
        if (!controller.signal.aborted) setItems(result.items);
      } catch (error) {
        if (!controller.signal.aborted) setError(requestErrorMessage(error, "We couldn’t load notifications. Try again."));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [open, workspaceId, retry]);

  const unread = items.some((item) => !item.read);
  return (
    <Popover.Root open={open} onOpenChange={(value) => { setOpen(value); if (value) { setLoading(true); setError(""); } }}>
      <Popover.Trigger className={styles.trigger} aria-label={unread ? "Notifications, unread updates" : "Notifications"}>
        <Bell size={20} />
        {unread && <span className={styles.dot} />}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.overlay} align="end" sideOffset={14} collisionPadding={12} aria-label="Notifications">
          <div className={styles.heading}><div><h2>Notifications</h2><p>Latest updates in this workspace</p></div><Popover.Close className={styles.close} aria-label="Close notifications"><X size={18} /></Popover.Close></div>
          <div className={styles.body} aria-busy={loading}>
            {loading ? (
              <div className={styles.state} role="status"><Spinner size={22}/><p>Loading notifications…</p></div>
            ) : error ? (
              <div className={styles.state}><p role="alert">{error}</p><button onClick={() => { setError(""); setLoading(true); setRetry((value) => value + 1); }}>Try again</button></div>
            ) : items.length ? (
              <ul className={styles.list}>{items.slice(0, 5).map((item) => (
                <li key={item.id} data-unread={!item.read || undefined}>
                  <span className={styles.itemIcon}><Bell size={17} /></span>
                  <div className={styles.copy}><strong>{item.title}</strong><p>{item.description}</p><time dateTime={item.updatedAt}>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(item.updatedAt))}</time></div>
                  {!item.read && <span className={styles.unread} aria-label="Unread" />}
                </li>
              ))}</ul>
            ) : (
              <div className={styles.state}><Bell size={26} /><strong>You’re all caught up</strong><p>Workspace updates will appear here.</p></div>
            )}
          </div>
          <Popover.Close asChild><Link className={styles.viewAll} href="/dashboard/notifications">View all notifications<ArrowRight size={16} /></Link></Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
