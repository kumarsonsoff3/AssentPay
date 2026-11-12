"use client";
import { useToast } from "@/components/feedback/toast-provider";
import { requestErrorMessage } from "@/lib/request-feedback";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import Link from "next/link";
import { InlineFeedback, LoadingState, Spinner } from "@/components/feedback/feedback";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronDown, Copy, Mail, RefreshCw, ShieldCheck, X } from "@/components/icons";
import { ForwardingGuide, ForwardingProviderPicker } from "./forwarding-guide";
import { forwardingProviders, safeGoogleConfirmationLink, type ForwardingProvider } from "@/lib/email-forwarding";
import styles from "./workspace-inbox.module.css";

type Inbox = { address: string; sourceEmail: string; sourceProvider: ForwardingProvider; status: string; testToken: string; lastReceivedAt: string; errorCode: string; processing?: { status: string; errorCode: string; delayed: boolean } | null; confirmation: { code: string; link: string; expiresAt: string } | null };
const labels: Record<string, string> = { not_configured: "Ready to set up", processing: "Preparing your email", connection_error: "Needs attention", awaiting_verification: "Setup in progress", awaiting_test: "Ready for a delivery check", receiving: "Email delivery working", disabled: "Forwarding paused" };
const steps = ["Choose mailbox", "Set up forwarding", "Check delivery"];

export function WorkspaceInbox({ workspaceId, canManage, onStatusChange }: { workspaceId: string; canManage: boolean; onStatusChange?: (status: string | null) => void }) {
  const notify = useToast();
  const [loading, setLoading] = useState(true);
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [open, setOpen] = useState(false), [step, setStep] = useState(0), [source, setSource] = useState("");
  const [provider, setProvider] = useState<ForwardingProvider>("gmail");
  const loadedWorkspace = useRef("");
  const [confirmationRequested, setConfirmationRequested] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"rotate" | "disable" | null>(null);
  const endpoint = `/api/workspaces/${workspaceId}/inbox`;
  const receiving = inbox?.status === "receiving";
  const selectedProvider = forwardingProviders.find(item => item.id === provider)!;
  const googleSetup = selectedProvider.confirmation === "google";
  const awaitingSetup = !!inbox && open && (
    (step === 1 && googleSetup && !inbox.confirmation) ||
    (step === 2 && !!inbox.testToken && !receiving)
  );
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(endpoint, { cache: "no-store", signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load your email setup.");
    if (signal?.aborted) return;
    if (loadedWorkspace.current !== workspaceId) {
      setProvider(data.inbox?.sourceProvider || "gmail");
      loadedWorkspace.current = workspaceId;
    }
    setInbox(data.inbox); setError(""); setLoading(false);
  }, [endpoint, workspaceId]);
  useEffect(() => {
    if (!canManage) return;
    const controller = new AbortController();
    void load(controller.signal).catch(() => {
      if (controller.signal.aborted) return;
      setError("We couldn’t check your email setup. Select Refresh status to try again.");
      setLoading(false);
    });
    return () => controller.abort();
  }, [canManage, load]);

  useEffect(() => {
    if (!canManage || !awaitingSetup || busy) return;
    const controller = new AbortController();
    let checks = 0;
    let timer: number | undefined;
    function scheduleCheck() {
      if (checks >= 4 || document.hidden || timer !== undefined) return;
      timer = window.setTimeout(async () => {
        if (!document.hidden) {
          checks++;
          try { await load(controller.signal); } catch { /* Check now remains available. */ }
        }
        timer = undefined;
        if (!controller.signal.aborted) scheduleCheck();
      }, 15000);
    }
    scheduleCheck();
    document.addEventListener("visibilitychange", scheduleCheck);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", scheduleCheck);
    };
  }, [awaitingSetup, busy, canManage, load]);
  useEffect(() => {
    if (!loading) onStatusChange?.(inbox?.status ?? null);
  }, [loading, inbox?.status, onStatusChange]);
  async function action(action: string, extra: Record<string, string> = {}) {
    if (busy) return false;
    setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setInbox(data.inbox); setConfirmAction(null); return true;
    } catch (e) { setError(requestErrorMessage(e, "We couldn’t update your email setup. Try again.")); return false; }
    finally { setBusy(false); }
  }
  async function refresh() {
    setBusy(true);
    try { await load(); } catch (e) { setError(requestErrorMessage(e)); } finally { setBusy(false); }
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); notify("Copied to clipboard."); }
    catch { setError("Select the address or code to copy it manually."); }
  }
  function begin(at = 0) {
    setStep(at); setSource(inbox?.sourceEmail || ""); setConfirmationRequested(false); setError(""); setOpen(true);
  }
  if (!canManage) return <p className={styles.note}>Ask a workspace owner or admin to set up email forwarding for your team.</p>;
  const confirmationLink = safeGoogleConfirmationLink(inbox?.confirmation?.link);
  const pending = inbox?.processing && ["queued", "running", "retry"].includes(inbox.processing.status);
  const needsAttention = inbox?.errorCode || inbox?.processing?.errorCode;
  const feedback = <>{error && <InlineFeedback tone="error">{error}</InlineFeedback>}</>;
  const addressBox = inbox && <div className={styles.addressBox}><div><span>YOUR WORKSPACE FORWARDING ADDRESS</span><code>{inbox.address}</code></div><button type="button" className={styles.secondary} onClick={() => void copy(inbox.address)}><Copy size={15} />Copy address</button></div>;
  const confirmation = inbox?.confirmation && <div className={styles.confirmation}><span className={styles.smallIcon}><Mail size={18} /></span><div><strong>A forwarding confirmation has arrived</strong><p>Use this only for a forwarding request you just made. A confirmation does not prove email delivery.</p><label className={styles.checkbox}><input type="checkbox" checked={confirmationRequested} onChange={(event) => setConfirmationRequested(event.target.checked)} />I requested this confirmation in my email provider’s settings.</label>{inbox.confirmation.code && <div className={styles.codeRow}><code>{inbox.confirmation.code}</code><button className={styles.secondary} disabled={!confirmationRequested} onClick={() => void copy(inbox.confirmation!.code)}><Copy size={14} />Copy code</button></div>}{confirmationLink && (confirmationRequested ? <a className={styles.primary} href={confirmationLink} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Confirm in Google <ArrowUpRight size={14} /></a> : <button className={styles.primary} disabled>Confirm in Google <ArrowUpRight size={14} /></button>)}{!inbox.confirmation.code && !confirmationLink && <p>No usable code or link was found. Follow your provider’s official setup instructions or request a new confirmation.</p>}<small>Private to workspace admins. Available for 24 hours. Next, save your forwarding settings and check delivery.</small></div></div>;
  const changeProvider = (value: ForwardingProvider) => { setProvider(value); setConfirmationRequested(false); };
  return <article className={styles.integrationCard}>
    <header className={styles.integrationTop}>
      <span className={styles.gmailMark}><Mail size={28} /></span>
      <div><span className={styles.eyebrow}>WORKSPACE EMAIL</span><h2>Bring your business emails into AssentPay</h2><p>Forward from Gmail, Google Workspace, Outlook, Microsoft 365 or another mailbox.</p></div>
      <span className={receiving ? styles.connected : styles.attention}><i />{loading ? "Checking…" : inbox ? labels[inbox.status] || "Needs attention" : "Setup needed"}</span>
    </header>
    {!open && feedback}
    {loading ? <LoadingState compact title="Checking your email setup…" description="Finding your forwarding address and delivery status." /> : <>
      {addressBox || <div className={styles.setupIntro}><div><h3>One address for your business email</h3><p>Create your private workspace address, then choose your email provider.</p></div><button className={styles.primary} disabled={busy} onClick={() => begin()}>Set up email<ArrowRight size={15} /></button></div>}
      {inbox && <div className={receiving ? styles.success : styles.deliveryStatus} role="status">
        {receiving ? <CheckCheck size={19} /> : <Mail size={19} />}
        <div><strong>{receiving ? "Test email received. Delivery is working." : inbox.status === "disabled" ? "Your workspace inbox is paused." : "Check delivery after saving your forwarding settings."}</strong>
          <p>{receiving ? "This proves receipt at your workspace address. Your email provider controls which messages get forwarded." : "Provider confirmation and AssentPay’s delivery check are separate steps."}</p>
          {inbox.lastReceivedAt && Date.parse(inbox.lastReceivedAt) > 0 && <p>Last email received: <time dateTime={inbox.lastReceivedAt}>{new Date(inbox.lastReceivedAt).toLocaleString()}</time></p>}
        </div>
        {receiving && <Link href="/dashboard/inbox" className={styles.textButton}>View conversations<ArrowUpRight size={14} /></Link>}
      </div>}
      <div className={styles.privacy}><ShieldCheck size={16} /><p>You choose what to forward. AssentPay receives those messages and supported attachments. Forwarding does not grant mailbox history or permission to send from your account.</p></div>
      <div className={styles.guideHeading}><h3>How to forward</h3><span>Choose your email provider</span></div>
      <ForwardingProviderPicker value={provider} onChange={changeProvider} />
      <ForwardingGuide provider={provider} />
      {inbox && <div className={styles.setupIntro}><div><h3>{receiving ? "Manage your forwarding setup" : inbox.status === "disabled" ? "Resume receiving email" : "Finish setup with a delivery check"}</h3><p>{inbox.sourceEmail ? `Forwarding mailbox: ${inbox.sourceEmail}` : "Save your source mailbox, configure forwarding, then send a fresh test message."}</p></div>
        {inbox.status === "disabled" ? <button className={styles.primary} disabled={busy} onClick={() => void action("enable")}>Enable inbox</button> : <button className={styles.primary} disabled={busy} onClick={() => begin(inbox.sourceEmail ? 1 : 0)}>{receiving ? "Manage setup" : "Continue setup"}<ArrowRight size={15} /></button>}
      </div>}
      {pending && <div className={styles.processing} role="status"><Spinner size={16} /><div><strong>{inbox?.processing?.delayed ? "Your email is waiting to be added" : "Adding your received email"}</strong><p>The email arrived and is being processed. Use Refresh status to check progress.</p></div></div>}
      {needsAttention && <InlineFeedback tone="error">Your email arrived, but we couldn’t add its contents to the workspace. {inbox?.processing?.status === "failed" ? "Try importing it again below." : "Ask your workspace administrator to check the email service connection."}</InlineFeedback>}
      <footer className={styles.cardActions}><button className={styles.secondary} disabled={busy} onClick={() => void refresh()}><RefreshCw size={14} />Refresh status</button>
        {inbox?.processing?.status === "failed" && <button className={styles.secondary} disabled={busy} onClick={() => void action("retry-processing")}>Try importing again</button>}
        {inbox && <details className={styles.advanced}><summary>Advanced options<ChevronDown size={13} /></summary><div><p>Replacing the address requires updating your email provider’s forwarding settings.</p><button className={styles.textButton} onClick={() => setConfirmAction("rotate")}>Replace forwarding address</button>{inbox.status !== "disabled" && <button className={styles.textButton} onClick={() => setConfirmAction("disable")}>Pause workspace inbox</button>}</div></details>}
      </footer>
    </>}
    <Dialog.Root open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}><Dialog.Portal><Dialog.Overlay className={styles.overlay} /><Dialog.Content className={styles.dialog}>
      <Dialog.Close className={styles.close} aria-label="Close email setup" disabled={busy}><X size={19} /></Dialog.Close>
      <div className={styles.dialogBrand}><Mail size={29} /><span>EMAIL FORWARDING</span></div>
      <Dialog.Title className={styles.dialogTitle}>{step === 0 ? "Where do your business emails arrive?" : step === 1 ? "Choose which emails reach AssentPay" : receiving ? "Your workspace email is ready" : "Let’s check email delivery"}</Dialog.Title>
      <Dialog.Description className={styles.dialogDescription}>{step === 0 ? "Choose your provider and the mailbox you will forward from." : step === 1 ? "Save forwarding in your email provider, then return here to check delivery." : receiving ? "Your test message arrived at the workspace address." : "Send a fresh message through the forwarding route you configured."}</Dialog.Description>
      <ol className={styles.stepper}>{steps.map((label, index) => <li key={label} className={index === step ? styles.currentStep : index < step ? styles.completeStep : ""} aria-current={index === step ? "step" : undefined}><span>{index < step ? <Check size={12} /> : index + 1}</span>{label}</li>)}</ol>
      {feedback}
      {step === 0 ? <form onSubmit={async (event) => { event.preventDefault(); if (!inbox && !await action("provision")) return; if (await action("source", { sourceEmail: source, sourceProvider: provider })) setStep(1); }}>
        <ForwardingProviderPicker value={provider} onChange={changeProvider} />
        <label className={styles.sourceField}>Your forwarding mailbox<div><Mail size={20} /><input type="email" autoComplete="email" required maxLength={254} placeholder="you@yourbusiness.com" value={source} onChange={(event) => setSource(event.target.value)} /></div></label>
        <p className={styles.note}>This identifies your setup mailbox. It does not connect your account or prove ownership.</p>
        <div className={styles.dialogActions}><span>{selectedProvider.name} forwarding</span><button className={styles.primary} disabled={busy}>{busy && <Spinner size={15} />}Continue<ArrowRight size={15} /></button></div>
      </form> : step === 1 ? <>
        <div className={styles.accountPill}><Mail size={19} /><span>{selectedProvider.name} · {inbox?.sourceEmail}</span><button className={styles.textButton} onClick={() => setStep(0)}>Change</button></div>
        {addressBox}<ForwardingGuide provider={provider} />
        {(selectedProvider.confirmation !== "none" && confirmation) || (googleSetup ? <div className={styles.waiting}><Mail size={19} /><div><strong>Google’s confirmation will appear here</strong><p>After adding the address in Gmail, we’ll check up to four times. You can also select Check now.</p></div><button className={styles.textButton} disabled={busy} onClick={() => void refresh()}>Check now</button></div> : <p className={styles.note}>{selectedProvider.confirmation === "none" ? "No Google confirmation is needed. Complete any Microsoft security prompts in your mailbox, save your settings, then check delivery." : "Confirmation requirements depend on your provider. Unrecognized formats and non-Google confirmation links are not supported here; follow your provider’s official instructions."}</p>)}
        <div className={styles.dialogActions}><button className={styles.textButton} onClick={() => setStep(0)}><ArrowLeft size={14} />Back</button><button className={styles.primary} disabled={busy} onClick={async () => { if (await action("source", { sourceEmail: source || inbox?.sourceEmail || "", sourceProvider: provider })) setStep(2); }}>I’ve saved my forwarding settings<ArrowRight size={15} /></button></div>
      </> : receiving ? <>
        <div className={styles.ready}><span><CheckCheck size={30} /></span><h3>Test email received</h3><p>Delivery to your workspace is working. AssentPay cannot inspect your provider’s forwarding settings or prove which route a message used.</p></div>
        <div className={styles.dialogActions}><button className={styles.secondary} disabled={busy} onClick={() => void action("test")}>Check delivery again</button><Dialog.Close className={styles.primary}>Done<Check size={15} /></Dialog.Close></div>
      </> : <>
        <div className={styles.accountPill}><Mail size={19} /><span>Send a fresh email to {inbox?.sourceEmail || "your source mailbox"}</span></div>
        {!inbox?.testToken ? <div className={styles.ready}><Mail size={29} /><h3>Ready for a quick check?</h3><p>Create a unique code, then have someone email it to your source mailbox in a message that matches your forwarding rule.</p><button className={styles.primary} disabled={busy} onClick={() => void action("test")}>{busy && <Spinner size={15} />}Create test code<ArrowRight size={15} /></button></div> : <>
          <div className={styles.testCode}><span>INCLUDE THIS CODE IN THE NEW EMAIL BODY</span><code>{inbox.testToken}</code><button className={styles.secondary} onClick={() => void copy(inbox.testToken)}><Copy size={14} />Copy test code</button></div>
          <ol className={styles.instructions}><li><span>1</span><div><strong>Ask someone to email your source mailbox</strong><p>Use a fresh message sent after creating this code. Put the code in its body and make sure the message matches your forwarding rule. If you chose manual forwarding, forward this new message yourself.</p></div></li><li><span>2</span><div><strong>We’ll show you when it arrives</strong><p>We check up to four times. If it takes longer, select Check for my test email.</p></div></li></ol>
          <p className={styles.note}>Send through your source mailbox to exercise your forwarding route. Sending directly to the workspace address only checks direct delivery.</p>
          <details className={styles.troubleshooting}><summary>Test email hasn’t arrived?</summary><p>Check the destination address, saved rule conditions and your source mailbox’s spam folder. For work accounts, ask your administrator whether external forwarding is allowed. Provider security prompts must be completed in that provider’s settings.</p></details>
        </>}
        <div className={styles.dialogActions}><button className={styles.textButton} onClick={() => setStep(1)}><ArrowLeft size={14} />Back</button><button className={styles.secondary} disabled={busy} onClick={() => void refresh()}><RefreshCw size={14} />Check for my test email</button></div>
      </>}
    </Dialog.Content></Dialog.Portal></Dialog.Root>
    <Dialog.Root open={!!confirmAction} onOpenChange={(value) => { if (!value && !busy) setConfirmAction(null); }}><Dialog.Portal><Dialog.Overlay className={styles.overlay} /><Dialog.Content className={`${styles.dialog} ${styles.smallDialog}`}>
      <Dialog.Title className={styles.dialogTitle}>{confirmAction === "rotate" ? "Replace your forwarding address?" : "Pause your workspace inbox?"}</Dialog.Title>
      <Dialog.Description className={styles.dialogDescription}>{confirmAction === "rotate" ? "The old address will stop receiving email and its pending imports will be cancelled. Update the destination in your email provider after replacing it." : "New emails sent to this workspace address will no longer be imported. Existing conversations stay available. You can enable the inbox again later."}</Dialog.Description>
      {error && <InlineFeedback tone="error">{error}</InlineFeedback>}
      <div className={styles.dialogActions}><Dialog.Close className={styles.secondary} disabled={busy}>Keep current setup</Dialog.Close><button className={styles.primary} disabled={busy} onClick={() => confirmAction && void action(confirmAction)}>{busy && <Spinner size={15} />}{confirmAction === "rotate" ? "Replace address" : "Pause inbox"}</button></div>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </article>;
}
