"use client";
import { useState } from "react";
import Link from "next/link";
import { Dialog, DropdownMenu } from "radix-ui";
import { MoreHorizontal, Pencil, Settings2, X } from "@/components/icons";
import type { Workspace } from "@/lib/workspaces/types";
import { canManage } from "@/lib/workspaces/types";
import { RenameWorkspace } from "./rename-workspace";
import styles from "./settings.module.css";
export function WorkspaceCardMenu({ workspace, disabled }: { workspace: Workspace; disabled: boolean }) {
  const [rename, setRename] = useState(false);
  return <Dialog.Root open={rename} onOpenChange={setRename}>
    <DropdownMenu.Root><DropdownMenu.Trigger className={styles.menuTrigger} disabled={disabled} aria-label={`Options for ${workspace.name}`}><MoreHorizontal size={20} /></DropdownMenu.Trigger>
      <DropdownMenu.Portal><DropdownMenu.Content className={styles.menu} align="end" sideOffset={5} collisionPadding={12} onCloseAutoFocus={(event) => { if (rename) event.preventDefault(); }}>
        {canManage(workspace.role) && <DropdownMenu.Item className={styles.menuItem} onSelect={() => setRename(true)}><Pencil size={16} />Rename organization</DropdownMenu.Item>}
        <DropdownMenu.Item asChild className={styles.menuItem}><Link href={`/workspaces/${workspace.id}/settings`}><Settings2 size={16} />Workspace settings</Link></DropdownMenu.Item>
      </DropdownMenu.Content></DropdownMenu.Portal>
    </DropdownMenu.Root>
    <Dialog.Portal><Dialog.Overlay className={styles.overlay} /><Dialog.Content className={styles.dialog}><Dialog.Title>Rename organization</Dialog.Title><Dialog.Description>Update the name shown throughout your workspace.</Dialog.Description><Dialog.Close className={styles.close} aria-label="Close"><X size={18} /></Dialog.Close><RenameWorkspace compact id={workspace.id} name={workspace.name} onSaved={() => setRename(false)} /></Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
