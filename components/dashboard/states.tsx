import { LoadingState } from "@/components/feedback/feedback";
import Link from "next/link";
import { ArrowUpRight, Inbox, ShieldCheck } from "@/components/icons";
import styles from "./dashboard.module.css";
export function EmptyState({
  title,
  description,
  href,
  action = "Manage connections",
  compact = false,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
  compact?: boolean;
}) {
  return (
    <div className={`${styles.empty} ${compact ? styles.compact : ""}`}>
      <span className={styles.emptyIcon}>
        <Inbox size={22} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {href && (
        <Link className={styles.textLink} href={href}>
          {action}
          <ArrowUpRight size={14} />
        </Link>
      )}
    </div>
  );
}
export function PhaseNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.notice}>
      <ShieldCheck size={17} />
      <p>{children}</p>
    </div>
  );
}
export function DashboardLoading() {
  return (
    <div className={styles.page}>
      <LoadingState compact title="Loading your workspace…" description="Preparing the latest overview and activity."/>
      <div className={styles.skeletonHeading} />
      <div className={styles.metrics}>
        {[1, 2, 3, 4].map((i) => (
          <div className={styles.skeletonCard} key={i} />
        ))}
      </div>
      <div className={styles.skeletonPanel} />

    </div>
  );
}
