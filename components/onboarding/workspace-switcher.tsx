"use client";
import { InlineFeedback } from "@/components/feedback/feedback";
import { Spinner } from "@/components/feedback/feedback";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog, DropdownMenu } from "radix-ui";
import { Building2, Check, ChevronDown, Plus, X } from "@/components/icons";
import type { Workspace } from "@/lib/workspaces/types";
import { post } from "./client";
import styles from "./workspace-switcher.module.css";

export function WorkspaceSwitcher({ workspaces, workspaceId, workspaceName }: {
  workspaces: Workspace[];
  workspaceId?: string;
  workspaceName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function select(id: string) {
    if (busy || id === workspaceId) return;
    setBusy(id);
    setError("");
    try {
      const result = await post(`/api/workspaces/${id}/select`);
      // Reload the shell and clear prefetched data belonging to the old workspace.
      window.location.assign(result.redirect || "/dashboard");
    } catch (error) {
      setError((error as Error).message);
      setBusy(null);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const name = String(new FormData(event.currentTarget).get("name") || "").trim();
    if (!name) { setError("Enter a workspace name."); return; }
    setBusy("create");
    setError("");
    try {
      const result = await post("/api/workspaces", { name });
      router.push(`/workspaces/${result.workspace!.id}/setup`);
      router.refresh();
    } catch (error) {
      setError((error as Error).message);
      setBusy(null);
    }
  }

  return (
    <Dialog.Root open={creating} onOpenChange={(value) => { if (!busy) { setCreating(value); setError(""); } }}>
      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger className={styles.trigger} disabled={!!busy} aria-label={`Switch workspace. ${workspaceName || "Your workspaces"}`}>
          <span className={styles.icon}><Building2 size={20} /></span>
          <span className={styles.copy}><strong>{workspaceName || "Your workspaces"}</strong><small>{busy ? "Switching workspace…" : "Switch workspace"}</small></span>
          {busy ? <Spinner size={16}/> : <ChevronDown size={16} />}
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className={styles.menu} align="start" sideOffset={8} collisionPadding={12} onCloseAutoFocus={(event) => { if (creating) event.preventDefault(); }}>
            <DropdownMenu.Label className={styles.label}>Your workspaces</DropdownMenu.Label>
            <div className={styles.list}>
              {workspaces.map((workspace) => (
                <DropdownMenu.Item key={workspace.id} className={styles.item} disabled={!!busy} onSelect={(event) => { event.preventDefault(); void select(workspace.id); }} aria-label={`${workspace.name}${workspace.id === workspaceId ? ", current workspace" : ""}`}>
                  <span className={styles.icon}><Building2 size={18} /></span>
                  <span className={styles.copy}><strong>{workspace.name}</strong><small>{workspace.role}{!workspace.onboardingComplete ? " · Setup in progress" : ""}</small></span>
                  {busy === workspace.id ? <Spinner size={16}/> : workspace.id === workspaceId ? <Check size={16} className={styles.check} /> : null}
                </DropdownMenu.Item>
              ))}
              {!workspaces.length && <p className={styles.hint}>Create a workspace to get started.</p>}
            </div>
            {error && <InlineFeedback>{error}</InlineFeedback>}
            <DropdownMenu.Separator className={styles.separator} />
            <DropdownMenu.Item className={styles.item} disabled={!!busy} onSelect={() => { setError(""); setCreating(true); }}><Plus size={18} />Create workspace</DropdownMenu.Item>
            <DropdownMenu.Item className={styles.item} disabled={!!busy} asChild><Link href="/workspaces"><Building2 size={18} />Manage workspaces</Link></DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.dialog} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onInteractOutside={(event) => { if (busy) event.preventDefault(); }}>
          <Dialog.Title>Create a workspace</Dialog.Title>
          <Dialog.Description>A separate space for your business, team, and connections.</Dialog.Description>
          <Dialog.Close className={styles.close} aria-label="Close" disabled={!!busy}><X size={20} /></Dialog.Close>
          <form onSubmit={create}>
            <label htmlFor="new-workspace-name">Workspace name</label>
            <input id="new-workspace-name" name="name" placeholder="e.g. Acme Studio" autoComplete="organization" required maxLength={128} disabled={!!busy} />
            {error && <InlineFeedback>{error}</InlineFeedback>}
            <button type="submit" className={styles.create} disabled={!!busy}>{busy ? <Spinner size={16}/> : <Plus size={16} />}{busy ? "Creating workspace…" : "Create workspace"}</button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
