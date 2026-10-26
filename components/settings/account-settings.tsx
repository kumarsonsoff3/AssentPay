"use client";
import { useToast } from "@/components/feedback/toast-provider";
import { InlineFeedback, Spinner } from "@/components/feedback/feedback";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Check, CheckCircle2, Circle, Eye, EyeOff, KeyRound, LockKeyhole, Plus, ShieldCheck } from "@/components/icons";
import type { Workspace } from "@/lib/workspaces/types";
import { post } from "@/components/onboarding/client";
import { DangerZone } from "./danger-zone";
import { SettingsSection } from "./settings-layout";
import styles from "./settings.module.css";

function PasswordField({ label, name, onChange }: { label: string; name: string; onChange?: (value: string) => void }) {
  const [show, setShow] = useState(false);
  return <div className={styles.field}><label htmlFor={`settings-${name}`}>{label}</label><div className={styles.passwordControl}><input id={`settings-${name}`} type={show ? "text" : "password"} name={name} autoComplete={name === "oldPassword" ? "current-password" : "new-password"} required minLength={name === "oldPassword" ? undefined : 12} maxLength={256} onChange={(event) => onChange?.(event.target.value)}/><button type="button" className={styles.revealButton} aria-label={`${show ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={show} onClick={() => setShow(!show)}>{show ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></div>;
}

export function AccountSettings({ name, email, workspaces, section = "profile" }: { name: string; email: string; workspaces: Workspace[]; section?: string }) {
  const notify = useToast();
  const router = useRouter(), pending = useRef(false);
  const [busy, setBusy] = useState("");
  const [displayName, setDisplayName] = useState(name), [savedName, setSavedName] = useState(name), [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState({ action: "", error: false, message: "" });
  async function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault(); if (pending.current) return;
    const form = event.currentTarget; pending.current = true; setBusy(action); setFeedback({ action, error: false, message: "" });
    try {
      const result = await post(`/api/account/${action}`, Object.fromEntries(new FormData(form)));
      if (result.redirect) window.location.assign(result.redirect);
      else { notify(result.message || "Saved."); if (action === "profile") setSavedName(displayName.trim()); router.refresh(); }
      if (action === "password") {form.reset();setPassword("");}
    } catch (error) { setFeedback({ action, error: true, message: (error as Error).message }); }
    finally { pending.current = false; setBusy(""); }
  }
  function message(action: string) {
    return feedback.action === action && feedback.message ? <InlineFeedback tone={feedback.error ? "error" : "success"}>{feedback.message}</InlineFeedback> : null;
  }
  const initials = (savedName || email).split(/\s+/).slice(0,2).map((part)=>part[0]).join("").toUpperCase();
  const changed = displayName.trim() !== savedName;
  const owned = workspaces.filter((workspace) => workspace.role === "owner");
  return <>
    {section === "profile" && <SettingsSection title="Personal information" description="The details your teammates see when you collaborate." note={<><strong>One account. Every workspace.</strong>Your profile follows you across all your organizations.</>}>
      <div className={styles.card}>
        <div className={styles.cardHeader}><span className={`${styles.avatar} ${styles.personalAvatar}`}>{initials}</span><div><h3>{savedName || "Your account"}</h3><p>{email}</p></div></div>
        <form className={styles.cardForm} onSubmit={(event) => void submit(event, "profile")}>
          <div className={styles.formBody}><fieldset disabled={!!busy}>
            <label>Full name<input name="name" value={displayName} onChange={(event)=>setDisplayName(event.target.value)} required maxLength={128} autoComplete="name"/><span className={styles.fieldHint}>Use the name you’d like your team to recognize.</span></label>
            <div className={styles.field}>Email address<div className={styles.readOnlyField}><span>{email}</span><span className={styles.verified}><CheckCircle2 size={13}/>Verified</span></div><span className={styles.fieldHint}>Your sign-in and account confirmation email.</span></div>
          </fieldset></div>
          {message("profile")}
          <div className={styles.formFooter}><span className={styles.footerNote}><ShieldCheck size={12}/>Personal account details</span><div className={styles.footerActions}>{changed && <button type="button" className={styles.ghostButton} disabled={!!busy} onClick={()=>setDisplayName(savedName)}>Discard</button>}<button className={styles.button} disabled={!!busy || !changed || !displayName.trim()}>{busy === "profile" && <Spinner size={16}/>}{busy === "profile" ? "Saving…" : "Save changes"}</button></div></div>
        </form>
      </div>
    </SettingsSection>}
    {section === "organizations" && <SettingsSection title="Your organizations" description="Each organization has its own team, connections, and business details." note={<><strong>Looking for workspace settings?</strong>Choose an organization to manage its name, people, and preferences.</>}>
      <div className={styles.card}>
        <div className={styles.cardHeader}><span className={styles.avatar}><Building2 size={22}/></span><div><h3>Where you work</h3><p>Organizations you own or belong to</p></div><span className={styles.organizationCount}>{workspaces.length}</span></div>
        <div className={styles.organizationList}>{workspaces.length ? workspaces.map((workspace)=><div className={styles.organizationRow} key={workspace.id}><span className={styles.avatar}>{workspace.name.slice(0,2).toUpperCase()}</span><div className={styles.organizationInfo}><strong>{workspace.name}</strong><small>{workspace.role} · {workspace.onboardingComplete ? "Ready to work" : "Setup in progress"}</small></div><Link href={`/workspaces/${workspace.id}/settings`}>Manage<ArrowRight size={14}/></Link></div>) : <div className={styles.emptyOrganizations}>Your first organization starts here.</div>}</div>
        <div className={styles.formFooter}><span className={styles.footerNote}>A separate space for each business</span><Link className={styles.button} href="/workspaces"><Plus size={14}/>Create organization</Link></div>
      </div>
    </SettingsSection>}
    {section === "security" && <SettingsSection title="A stronger sign-in" description="Keep your account protected with a password only you know." note={<><strong>After a password change</strong>You’ll be signed out on every device and asked to sign in again.</>}>
      <div className={styles.card}>
        <div className={styles.cardHeader}><span className={styles.avatar}><LockKeyhole size={22}/></span><div><h3>Change your password</h3><p>Verify your current password to continue</p></div></div>
        <form className={styles.cardForm} onSubmit={(event) => void submit(event, "password")}>
          <div className={styles.formBody}><fieldset disabled={!!busy}>
            <PasswordField label="Current password" name="oldPassword"/>
            <PasswordField label="New password" name="password" onChange={setPassword}/>
            <div className={styles.passwordRules} aria-label="New password requirements">{[["At least 12 characters",password.length>=12],["Upper & lowercase",/[A-Z]/.test(password)&&/[a-z]/.test(password)],["One number",/\d/.test(password)],["One symbol",/[^a-zA-Z0-9\s]/.test(password)]].map(([label,met])=><span key={String(label)} data-met={met || undefined}>{met ? <Check size={12}/> : <Circle size={10}/>} {label}</span>)}</div>
            <PasswordField label="Confirm new password" name="confirmPassword"/>
          </fieldset></div>{message("password")}
          <div className={styles.formFooter}><span className={styles.footerNote}><ShieldCheck size={12}/>Current password required</span><button className={styles.button} disabled={!!busy}>{busy === "password" && <Spinner size={16}/>}{busy === "password" ? "Updating…" : "Update password"}</button></div>
        </form>
      </div>
      <div className={styles.helpStrip}><KeyRound size={16}/><p>Forgot your password or signed up with Google? <Link href="/forgot-password">Set or recover your password</Link>.</p></div>
    </SettingsSection>}
    {section === "danger-zone" && <SettingsSection title="Account deletion" description="Permanently close your account and remove your personal data." note={<><strong>Make sure you’re ready</strong>This action cannot be undone. You’ll review the consequences before confirming.</>}>
      <DangerZone email={email} blocked={owned.length ? "You still own organizations. Delete them individually before closing your account." : undefined}/>
      {owned.length>0 && <div className={styles.helpStrip}><Building2 size={16}/><p><Link href="/account/organizations">Review your organizations</Link> to manage their data first.</p></div>}
    </SettingsSection>}
  </>;
}
