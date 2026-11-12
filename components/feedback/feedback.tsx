import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, LoaderCircle } from "@/components/icons";
import styles from "./feedback.module.css";

/** Decorative inside a labelled control or a LoadingState live region. */
export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <LoaderCircle
      size={size}
      className={styles.spinner}
      aria-hidden="true"
    />
  );
}

export function LoadingState({
  title = "Getting things ready…",
  description = "This should only take a moment.",
  compact = false,
}: {
  title?: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`${styles.loading} ${compact ? styles.compact : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className={styles.loadingIcon}>
        <Spinner size={compact ? 22 : 28} />
      </span>
      <div>
        <strong>{title}</strong>
        {description && <p>{description}</p>}
      </div>
      {!compact && (
        <div className={styles.placeholder} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}

export function InlineFeedback({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "success";
}) {
  const Icon = tone === "error" ? CircleAlert : CircleCheck;
  return (
    <div
      className={`${styles.inline} ${tone === "success" ? styles.success : ""}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon size={18} tone={tone === "error" ? "danger" : "success"} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
