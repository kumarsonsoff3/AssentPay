"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Toast } from "radix-ui";
import { CircleCheck, Info, X } from "@/components/icons";
import styles from "./toast.module.css";

type Tone = "success" | "info";
type Notice = { id: number; message: string; tone: Tone };
type Notify = (message: string, tone?: Tone) => void;
const ToastContext = createContext<Notify | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const sequence = useRef(0);
  const notify = useCallback<Notify>((message, tone = "success") => {
    if (!message.trim()) return;
    const notice = { id: ++sequence.current, message, tone };
    // Repeated copies restart the timeout instead of stacking identical notices.
    setNotices((current) => [...current.filter((item) => item.message !== message).slice(-2), notice]);
  }, []);
  return <ToastContext.Provider value={notify}>
    <Toast.Provider duration={3500} swipeDirection="right" label="Notification">
      {children}
      {notices.map((notice) => <Toast.Root key={notice.id} className={`${styles.toast} ${styles[notice.tone]}`} defaultOpen type="foreground" onOpenChange={(open) => { if (!open) setNotices((current) => current.filter((item) => item.id !== notice.id)); }}>
        <span className={styles.icon} aria-hidden="true">{notice.tone === "success" ? <CircleCheck size={19} tone="success" /> : <Info size={19} tone="info" />}</span>
        <Toast.Description className={styles.message}>{notice.message}</Toast.Description>
        <Toast.Close className={styles.close} aria-label="Dismiss notification"><X size={16} /></Toast.Close>
      </Toast.Root>)}
      <Toast.Viewport className={styles.viewport} label="Notifications ({hotkey})" />
    </Toast.Provider>
  </ToastContext.Provider>;
}

export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error("Toast notifications require ToastProvider.");
  return notify;
}

/** For a notification supplied by a redirect or an existing controlled view. */
export function ToastNotice({ message, tone = "success" }: { message: string; tone?: Tone }) {
  const notify = useToast();
  useEffect(() => { if (message) notify(message, tone); }, [message, tone, notify]);
  return null;
}
