"use client";

import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { ChevronDown, UserRound, Building2 } from "@/components/icons";
import { SignOutButton } from "@/components/auth/auth-form";
import styles from "./account-menu.module.css";

export function AccountMenu({ name, email, role }: { name?: string; email: string; role?: string }) {
  const label = name || email.split("@")[0] || "Your account";
  const initials = label.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={styles.trigger} aria-label={`Account menu for ${label}`}>
        <span className={styles.avatar}>{initials}</span>
        <span className={styles.identity}><strong>{label}</strong><small>{role || "Personal account"}</small></span>
        <ChevronDown size={15} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.menu} align="end" sideOffset={12} collisionPadding={12}>
          <DropdownMenu.Label className={styles.label}><strong>{label}</strong><span>{email}</span></DropdownMenu.Label>
          <DropdownMenu.Separator className={styles.separator} />
          <DropdownMenu.Item asChild className={styles.item}><Link href="/account"><UserRound size={16} />Account settings</Link></DropdownMenu.Item>
          <DropdownMenu.Item asChild className={styles.item}><Link href="/workspaces"><Building2 size={16} />Manage workspaces</Link></DropdownMenu.Item>
          <DropdownMenu.Separator className={styles.separator} />
          <SignOutButton menuItem className={styles.signOut} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
