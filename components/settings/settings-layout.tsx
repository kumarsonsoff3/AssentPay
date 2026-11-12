import type { ReactNode } from "react";
import { ShieldCheck, Settings2, Trash2, UserRound } from "@/components/icons";
import { SectionHeader } from "@/components/dashboard/section-header";
import styles from "./settings.module.css";

export function SettingsPage({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  const danger = title === "Danger zone";
  const Icon = danger ? Trash2 : eyebrow === "ACCOUNT SETTINGS" ? UserRound : Settings2;
  return <div className={styles.settingsPage}>
    <div className={styles.settingsHero}>
      <SectionHeader category={eyebrow} title={title} description={description} icon={<Icon size={26} />} tone={danger ? "rose" : "teal"} />
    </div>
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
