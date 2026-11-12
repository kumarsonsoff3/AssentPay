"use client";
import Link from "next/link";
import { useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  FileQuestion,
  RefreshCw,
  WifiOff,
} from "@/components/icons";
import { Spinner } from "./feedback";
import styles from "./feedback.module.css";

export function RecoveryState({
  title = "We couldn’t load this page",
  description = "The connection may have been interrupted. Try again in a moment.",
  retry,
  href = "/workspaces",
  action = "Go to workspaces",
  missing = false,
}: {
  title?: string;
  description?: string;
  retry?: () => void;
  href?: string;
  action?: string;
  missing?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const Icon = missing ? FileQuestion : WifiOff;
  return (
    <section className={styles.recovery} aria-labelledby="recovery-title">
      <div className={styles.recoveryCard}>
        <div className={styles.illustration} aria-hidden="true">
          <span />
          <span />
          <div>
            <Icon size={36} />
          </div>
        </div>
        <span className={styles.eyebrow}>
          {missing ? "PAGE NOT FOUND · 404" : "LET’S GET YOU BACK"}
        </span>
        <h1 id="recovery-title">{title}</h1>
        <p>{description}</p>
        <div className={styles.actions}>
          {retry && (
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(retry)}
            >
              {pending ? <Spinner size={17} /> : <RefreshCw size={17} />}{" "}
              {pending ? "Trying again…" : "Try again"}
            </button>
          )}
          <Link href={href}>
            {retry ? <ArrowLeft size={16} /> : null}
            {action}
            {!retry && <ArrowRight size={16} />}
          </Link>
        </div>
        <div className={styles.recoveryHelp}>
          {missing
            ? "Check the address, or open a workspace to continue."
            : "Still having trouble? Wait a moment, then try again. If you were editing a form, review it before submitting again."}
        </div>
      </div>
    </section>
  );
}
