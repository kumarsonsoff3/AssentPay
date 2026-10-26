"use client";
import Link from "next/link";
import { useState } from "react";
import { post } from "@/components/onboarding/client";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Inbox,
  Handshake,
  ShieldCheck,
  FileText,
  Users,
  FolderOpen,
  Bot,
  BrainCircuit,
  ChartNoAxesCombined,
  SlidersHorizontal,
  Settings2,
  Settings,
  PlugZap,
  Trash2,
  LockKeyhole,
  UserRound,
  Bell,
  ChevronDown,
  Building2,
} from "@/components/icons";
import { sections, sectionHref } from "@/lib/dashboard/navigation";
import styles from "./dashboard.module.css";
type NavigationProps = { workspaceId?: string; ready?: boolean; selectBeforeNavigation?: boolean };

export function MobileDashboardNavigation(props: NavigationProps) {
  return (
    <details
      className={styles.mobileMenu}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button:not(:disabled)"))
          e.currentTarget.removeAttribute("open");
      }}
    >
      <summary>
        <LayoutGrid size={16} />
        Workspace menu
      </summary>
      <DashboardNavigation {...props} />
    </details>
  );
}
const icons = {
  overview: LayoutGrid, inbox: Inbox, deals: Handshake, approvals: ShieldCheck,
  invoices: FileText, clients: Users, documents: FolderOpen, activity: Bot,
  memory: BrainCircuit, analytics: ChartNoAxesCombined, integrations: PlugZap,
  agent: SlidersHorizontal, team: Users, notifications: Bell, settings: Settings,
};
export function DashboardBreadcrumb() {
  const path = usePathname();
  return sections.find((item) => sectionHref(item.id) === path)?.label || "Overview";
}
export function DashboardNavigation({ workspaceId, ready = true, selectBeforeNavigation = false }: NavigationProps) {
  const path = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function navigate(href: string) {
    if (busy || !workspaceId) return;
    setBusy(true);
    setError("");
    try {
      await post(`/api/workspaces/${workspaceId}/select`);
      window.location.assign(href);
    } catch (error) {
      setError((error as Error).message);
      setBusy(false);
    }
  }
  function navigationItem(item: (typeof sections)[number]) {
    if (!ready && item.id !== "settings") return null;
    const Icon = icons[item.id];
    const href = item.id === "settings" && workspaceId ? `/workspaces/${workspaceId}/settings` : sectionHref(item.id);
    const content = <><Icon size={17} /><span>{item.id === "settings" ? "General" : item.label}</span></>;
    if (item.id === "settings" && workspaceId) return <Link key={item.id} href={href} aria-current={path === href ? "page" : undefined}>{content}</Link>;
    if (!ready || selectBeforeNavigation) {
      return <button key={item.id} type="button" disabled={!ready || busy} onClick={() => void navigate(href)}>{content}</button>;
    }
    return <Link key={item.id} href={href} aria-current={path === href ? "page" : undefined}>{content}</Link>;
  }
  const settingsPage = path.startsWith(`/workspaces/${workspaceId}/settings`) || sections.some((item) => item.group === "manage" && item.id !== "notifications" && sectionHref(item.id) === path);
  return (
    <nav aria-label="Workspace navigation" className={styles.navigation}>
      {workspaceId && (!ready || path === `/workspaces/${workspaceId}/setup`) && (
        <Link href={`/workspaces/${workspaceId}/setup`} aria-current={path === `/workspaces/${workspaceId}/setup` ? "page" : undefined}><Settings2 size={17} /><span>Workspace setup</span></Link>
      )}
      {!ready && <p className={styles.navigationHint}>Finish setup to open your dashboard.</p>}
      {error && <p role="alert">{error}</p>}
      {ready && (["workspace", "intelligence"] as const).map((group) => (
        <div key={group}>
          <p>{group === "workspace" ? "WORKSPACE" : "INTELLIGENCE"}</p>
          {sections.filter((item) => item.group === group).map(navigationItem)}
        </div>
      ))}
      <details key={settingsPage ? "active-settings" : "settings"} className={styles.settingsGroup} open={settingsPage || undefined}>
        <summary data-active={settingsPage || undefined}><Settings2 size={17} /><span>Workspace settings</span><ChevronDown size={15} className={styles.settingsChevron} /></summary>
        <div className={styles.settingsLinks}>
          {workspaceId && <Link href={`/workspaces/${workspaceId}/settings/organization`} aria-current={path === `/workspaces/${workspaceId}/settings/organization` ? "page" : undefined}><Building2 size={17} /><span>Organization name</span></Link>}
          {sections.filter((item) => item.group === "manage" && item.id !== "notifications").sort((a, b) => Number(b.id === "settings") - Number(a.id === "settings")).map(navigationItem)}
          {workspaceId && <Link href={`/workspaces/${workspaceId}/settings/danger-zone`} aria-current={path === `/workspaces/${workspaceId}/settings/danger-zone` ? "page" : undefined}><Trash2 size={17} /><span>Danger zone</span></Link>}
        </div>
      </details>
    </nav>
  );
}

export function AccountNavigation({ mobile = false, settings = false }: { mobile?: boolean; settings?: boolean }) {
  const path = usePathname();
  const items = [
    { href: "/account", label: "Profile", icon: UserRound },
    { href: "/account/organizations", label: "Organizations", icon: Building2 },
    { href: "/account/security", label: "Password & security", icon: LockKeyhole },
    { href: "/account/danger-zone", label: "Danger zone", icon: Trash2 },
  ];
  return (
    <nav className={mobile ? styles.accountMobileNavigation : styles.navigation} aria-label="Account navigation">
      {!(settings || path.startsWith("/account")) && <Link href="/workspaces" aria-current={path === "/workspaces" || path === "/onboarding" ? "page" : undefined}><Building2 size={17} />Workspaces</Link>}
      {(settings || path.startsWith("/account")) && <div className={styles.accountSettingsLinks}><p>ACCOUNT SETTINGS</p>{items.map(({href,label,icon:Icon}) => <Link key={href} href={href} aria-current={path === href ? "page" : undefined}><Icon size={17}/>{label}</Link>)}</div>}
    </nav>
  );
}
