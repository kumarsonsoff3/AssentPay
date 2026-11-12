import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "@/components/icons";
import styles from "./section-header.module.css";

export function SectionHeader({ category, title, description, icon, tone = "blue", action }: {
  category: string;
  title: string;
  description: string;
  icon: ReactNode;
  tone?: "blue" | "violet" | "teal" | "rose";
  action?: { href: string; label: string };
}) {
  return (
    <header className={styles.header} data-tone={tone}>
      <div className={styles.identity}>
        <span className={styles.icon} aria-hidden="true">{icon}</span>
        <div className={styles.copy}>
          <p className={styles.category}>{category}</p>
          <h1>{title}</h1>
          <p className={styles.description}>{description}</p>
        </div>
      </div>
      {action && <Link href={action.href} className={styles.action}>{action.label}<ArrowUpRight size={15} aria-hidden="true" /></Link>}
    </header>
  );
}
