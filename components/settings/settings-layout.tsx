import type { ReactNode } from "react";
import { ShieldCheck } from "@/components/icons";
import styles from "./settings.module.css";

export function SettingsPage({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <div className={styles.settingsPage}>
    <header className={styles.pageHeader}><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1><p>{description}</p></header>
    {children}
  </div>;
}

export function SettingsSection({ title, description, note, children }: { title: string; description: string; note?: ReactNode; children: ReactNode }) {
  return <section className={styles.sectionGrid}>
    <div className={styles.sectionIntro}><h2>{title}</h2><p>{description}</p>{note && <div className={styles.contextNote}>{note}</div>}</div>
    <div className={styles.sectionContent}>{children}</div>
  </section>;
}

export function PermissionNotice({ children }: { children: ReactNode }) {
  return <div className={styles.permissionNotice}><ShieldCheck size={22}/><div><strong>Managed by your organization</strong><p>{children}</p></div></div>;
}
