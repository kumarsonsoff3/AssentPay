"use client";
import { InlineFeedback } from "@/components/feedback/feedback";
import { Spinner } from "@/components/feedback/feedback";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Dialog } from "radix-ui";
import { ArrowLeft, ArrowRight, Check, Trash2, X } from "@/components/icons";
import { post } from "@/components/onboarding/client";
import styles from "./settings.module.css";

export function DangerZone({ email, workspace, blocked }: { email: string; workspace?: { id: string; name: string }; blocked?: string }) {
  const pending = useRef(false), textInput = useRef<HTMLInputElement>(null), cancelButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false), [step, setStep] = useState(1);
  const [confirmationEmail, setEmail] = useState(""), [confirmationName, setName] = useState("");
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const target = workspace ? "organization" : "account";
  const valid = confirmationEmail.trim().toLowerCase() === email.toLowerCase() && consent && (!workspace || confirmationName === workspace.name);
  useEffect(() => { if (open && step === 2) textInput.current?.focus(); }, [open, step]);
  function changeOpen(value: boolean) {
    if (pending.current) return;
    setOpen(value); setStep(1); setConsent(false); setEmail(""); setName(""); setError("");
  }
  async function remove(event: FormEvent) {
    event.preventDefault();
    if (step !== 2 || !valid || pending.current || blocked) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const result = await post(workspace ? `/api/workspaces/${workspace.id}/delete` : "/api/account/delete", { confirmationEmail, confirmationName, consent });
      window.location.assign(result.redirect || (workspace ? "/workspaces" : "/sign-in"));
    } catch (error) { setError((error as Error).message); pending.current = false; setBusy(false); }
  }
  return <section className={`${styles.panel} ${styles.danger}`}>
    <div className={styles.dangerIntro}><span className={styles.dangerIcon}><Trash2 size={22}/></span><div><h2>Delete {target}</h2><p>{workspace ? `Permanently remove ${workspace.name} and its data for everyone in the organization.` : "Permanently remove your account and personal data. This action cannot be undone."}</p></div></div>
    {blocked && <p className={styles.warning}>{blocked}</p>}
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger className={styles.dangerButton} disabled={!!blocked}>Delete {target}…</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={`${styles.dialog} ${styles.deleteDialog}`} onOpenAutoFocus={(event) => { event.preventDefault(); cancelButton.current?.focus(); }} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onInteractOutside={(event) => { if (busy) event.preventDefault(); }}>
          <Dialog.Close className={styles.close} aria-label="Close deletion dialog" disabled={busy}><X size={18}/></Dialog.Close>
          <div className={styles.steps} aria-label={`Step ${step} of 2`}><span data-current={step === 1 || undefined}>{step === 2 ? <Check size={12}/> : "1"}</span><span>Review</span><i/><span data-current={step === 2 || undefined}>2</span><span>Confirm</span></div>
          <span className={styles.dangerIcon}><Trash2 size={24}/></span>
          <Dialog.Title>{step === 1 ? `Delete ${workspace?.name || "your account"}?` : "Confirm permanent deletion"}</Dialog.Title>
          <Dialog.Description>{step === 1 ? "Review what will be removed before you continue." : "Type the details below to authorize this irreversible action."}</Dialog.Description>
          {step === 1 ? <>
            <div className={styles.deletionSummary}>
              <strong>{workspace ? "This organization will lose:" : "Your account will lose:"}</strong>
              <ul>{(workspace ? ["Conversations, documents, and stored files", "Connections, credentials, and pending automation", "Financial records, approvals, and notifications", "All team memberships and invitations"] : ["Your profile, sessions, and account access", "Personal connections and imported connection data", "Memberships, read receipts, and pending personal work"]).map((item) => <li key={item}>{item}</li>)}</ul>
              <p>{workspace ? "Everyone in this organization will lose access. Deleting it does not reverse transactions at payment providers." : "Records owned by other organizations remain with those organizations, with your user reference removed."}</p>
            </div>
            <label className={styles.consent}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)}/>I understand this permanently deletes the {target}{workspace ? " and its data for everyone" : " and its personal data"} and cannot be undone.</label>
            <div className={styles.dialogActions}><Dialog.Close ref={cancelButton} className={styles.secondaryButton}>Cancel</Dialog.Close><button className={styles.dangerButton} disabled={!consent} onClick={() => setStep(2)}>Continue to confirmation<ArrowRight size={15}/></button></div>
          </> : <form className={`${styles.form} ${styles.confirmForm}`} onSubmit={remove}>
            <fieldset disabled={busy}>
              {workspace && <label>Organization name<span className={styles.fieldHint}>Type <strong>{workspace.name}</strong> exactly.</span><input ref={textInput} value={confirmationName} onChange={(event) => setName(event.target.value)} required autoComplete="off" /></label>}
              <label>Registered email<span className={styles.fieldHint}>Type <strong>{email}</strong> to confirm.</span><input ref={workspace ? undefined : textInput} type="email" value={confirmationEmail} onChange={(event) => setEmail(event.target.value)} required autoComplete="off" spellCheck={false} /></label>
              {error && <InlineFeedback>{error}</InlineFeedback>}
              <div className={styles.dialogActions}><button type="button" className={styles.secondaryButton} onClick={() => {setStep(1);setError("");}}><ArrowLeft size={15}/>Back</button><button className={styles.dangerButton} disabled={!valid}>{busy ? <Spinner size={16}/> : <Trash2 size={15}/>} {busy ? "Deleting…" : `Delete ${target} permanently`}</button></div>
            </fieldset>
          </form>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </section>;
}
