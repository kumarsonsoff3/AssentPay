"use client";
import { useToast } from "@/components/feedback/toast-provider";
import { InlineFeedback } from "@/components/feedback/feedback";
import { Spinner } from "@/components/feedback/feedback";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "@/components/icons";
import { post } from "@/components/onboarding/client";
import styles from "./settings.module.css";

export function RenameWorkspace({ id, name, onSaved, compact = false }: { id: string; name: string; onSaved?: () => void; compact?: boolean }) {
  const notify = useToast();
  const router = useRouter(), pending = useRef(false);
  const [value, setValue] = useState(name), [saved, setSaved] = useState(name);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const changed = value.trim() !== saved;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending.current || !changed) return;
    pending.current = true; setBusy(true); setError("");
    try { await post(`/api/workspaces/${id}/rename`, { name: value.trim() }); setSaved(value.trim()); notify("Organization name updated."); router.refresh(); onSaved?.(); }
    catch (error) { setError((error as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className={compact ? styles.compactForm : `${styles.card} ${styles.settingsEditor}`}>
    {!compact && <div className={styles.cardHeader}><span className={styles.avatar}><Building2 size={23}/></span><div><p>Current display name</p><h3 className={styles.identityName}>{saved}</h3></div></div>}
    <form className={styles.cardForm} action="/api/forms/unavailable" method="post" onSubmit={save}>
      <div className={styles.formBody}><fieldset disabled={busy}><label>Display name<input name="name" value={value} onChange={(event) => {setValue(event.target.value);}} required maxLength={128} autoComplete="organization"/><span className={styles.fieldHint}>Shown in your workspace switcher and throughout AssentPay.</span></label></fieldset></div>
      {error && <InlineFeedback>{error}</InlineFeedback>}
      <div className={styles.formFooter}><span className={styles.footerNote}>Visible to everyone in your organization</span><div className={styles.footerActions}>{changed && <button type="button" className={styles.ghostButton} disabled={busy} onClick={() => {setValue(saved);setError("");}}>Discard</button>}<button className={styles.button} disabled={busy || !changed || !value.trim()}>{busy && <Spinner size={14}/>} {busy ? "Saving…" : "Save changes"}</button></div></div>
    </form>
  </div>;
}
