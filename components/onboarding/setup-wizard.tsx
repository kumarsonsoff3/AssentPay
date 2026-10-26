"use client";
import { ToastNotice, useToast } from "@/components/feedback/toast-provider";
import { Spinner } from "@/components/feedback/feedback";
import { InlineFeedback } from "@/components/feedback/feedback";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCheck,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Mail,
  MessageSquare,
  ShieldCheck,
  Users,
  Zap,
} from "@/components/icons";
import {
  canManage,
  PROVIDERS,
  type Workspace,
  type Provider,
  type IntegrationSummary,
  type Member,
} from "@/lib/workspaces/types";
import { post } from "./client";
import styles from "./onboarding.module.css";
import { WorkspaceInbox } from "./workspace-inbox";
import { ProviderMark } from "./provider-mark";
const steps = [
  {
    title: "Business profile",
    description: "The basics, and your preferences",
    icon: Building2,
  },
  {
    title: "Connect your tools",
    description: "Bring your workflow together",
    icon: Zap,
  },
  {
    title: "Invite your team",
    description: "Better work happens together",
    icon: Users,
  },
  {
    title: "Ready for takeoff",
    description: "One last look at your workspace",
    icon: CheckCheck,
  },
];
const info = {
  gmail: {
    name: "Gmail",
    description: "Connect a business inbox to synchronize conversations and attachments.",
    detail:
      "Read and send permission for inbox analysis and future approved customer emails. Sending is not enabled yet.",
    icon: Mail,
  },
  slack: {
    name: "Slack",
    description: "Choose a workspace and channel for future approvals.",
    detail: "Install the bot and select a channel during Slack consent.",
    icon: MessageSquare,
  },
  paypal: {
    name: "PayPal",
    description: "Connect this workspace’s own sandbox merchant app.",
    detail:
      "Verify this business’s sandbox app credentials. Payments remain in test mode.",
    icon: CreditCard,
  },
};
export function SetupWizard({
  workspace,
  integrations,
  members,
  ready,
  connectionResult,
  triggerReady,
  initialStep,
}: {
  workspace: Workspace;
  integrations: IntegrationSummary[];
  members: Member[];
  ready: Record<Provider, boolean>;
  connectionResult?: string;
  triggerReady: boolean;
  initialStep?: number;
}) {
  const notify = useToast();
  const router = useRouter(),
    [step, setStep] = useState(workspace.profileSaved ? (initialStep ?? 1) : 0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(
      connectionResult === "failed"
        ? "The connection could not be completed. Check the callback settings and try again."
        : "",
    ),
    [paypalOpen, setPaypalOpen] = useState(false);
  const manage = canManage(workspace.role),
    owner = workspace.role === "owner",
    api = `/api/workspaces/${workspace.id}`;
  const current = steps[step];
  async function perform(
    path: string,
    body: unknown = {},
    success?: () => void,
  ) {
    setBusy(true);
    setError("");
    try {
      const result = await post(path, body);
      if (result.redirect) {
        window.location.assign(result.redirect);
        return true;
      }
      if (result.message) notify(result.message);
      success?.();
      router.refresh();
      return true;
    } catch (error) {
      setError((error as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function move(next: number) {
    setStep(next);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?step=${next}`,
    );
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function profile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await perform(
      `${api}/profile`,
      {
        ...values,
        approvalThreshold: Number(values.approvalThreshold),
        emailNotifications: values.emailNotifications === "on",
      },
      () => setStep(1),
    );
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await perform(`${api}/invite`, Object.fromEntries(new FormData(form)), () =>
      form.reset(),
    );
  }
  async function paypal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const ok = await perform(
      `${api}/integrations/paypal/connect`,
      Object.fromEntries(new FormData(form)),
      () => setPaypalOpen(false),
    );
    if (ok) form.reset();
  }
  return (
    <div className={styles.setupPage}>
      <div className={styles.setupPageHeading}>
        <div className={styles.eyebrow}>
          <span />
          LET’S MAKE IT YOURS
        </div>
        <h1>
          {workspace.onboardingComplete
            ? "Your workspace, your way."
            : "A connected business starts here."}
        </h1>
        <p>Set up your space. Connect your tools. Bring your people.</p>
      </div>
      <div className={styles.setup}>
        <aside className={styles.rail}>
          <Link className={styles.backLink} href="/workspaces">
            <ArrowLeft size={16} /> All workspaces
          </Link>
          <span className={styles.railLabel}>WORKSPACE SETUP</span>
          <h2>{workspace.name}</h2>
          <p>
            Everything your business needs,
            <br />
            in one place.
          </p>
          <ol>
            {steps.map((item, index) => (
              <li key={item.title}>
                <button
                  aria-label={`Step ${index + 1}: ${item.title}`}
                  onClick={() => move(index)}
                  disabled={index > 0 && !workspace.profileSaved}
                  aria-current={index === step ? "step" : undefined}
                >
                  <span
                    className={`${styles.stepNumber} ${index === step ? styles.activeNumber : ""}`}
                  >
                    {index < step ? <Check size={17} /> : index + 1}
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className={styles.railFoot}>
            <ShieldCheck size={22} />
            <span>
              Your workspace stays in your control.
              <br />
              <small>Approvals always come first.</small>
            </span>
          </div>
        </aside>
        <section className={styles.content}>
          <div className={styles.topLine}>
            <span>LET’S GET YOU SET UP</span>
            <span>STEP {step + 1} OF 4</span>
          </div>
          <div className={styles.progress}>
            <span style={{ width: `${(step + 1) * 25}%` }} />
          </div>
          <div className={styles.stepHeader}>
            <span className={styles.iconSquare}>
              <current.icon size={24} />
            </span>
            <h2>{current.title}</h2>
            <p>
              {step === 0
                ? "Tell us a little about your business. You can change these details later."
                : step === 1
                  ? "Your inbox, your team, your payments. Connected in one place."
                  : step === 2
                    ? "Bring the right people into your workspace, with the right level of access."
                    : "Your workspace is taking shape. Here’s what you’re starting with."}
            </p>
          </div>
          {!manage && (
            <p className={styles.notice}>
              You have {workspace.role} access. A workspace owner or admin can
              finish setup.
            </p>
          )}
          {error && (
            <InlineFeedback>{error}</InlineFeedback>
          )}
          <ToastNotice message={connectionResult === "success" ? "Account connected successfully." : connectionResult === "cancelled" ? "Connection cancelled. You can try again whenever you’re ready." : ""} tone={connectionResult === "cancelled" ? "info" : "success"} />
          {step === 0 && (
            <form
              method="post"
              action="/api/forms/unavailable"
              onSubmit={profile}
              className={styles.form}
            >
              <fieldset disabled={busy || !manage}>
                <div className={styles.fieldGrid}>
                  <Field
                    label="Business name"
                    name="businessName"
                    value={workspace.businessName}
                    required
                    maxLength={128}
                  />
                  <Field
                    label="Industry"
                    name="industry"
                    value={workspace.industry}
                    placeholder="e.g. Design & creative services"
                    required
                    maxLength={128}
                  />
                  <Field
                    label="Business website"
                    name="website"
                    type="url"
                    value={workspace.website}
                    placeholder="https://yourbusiness.com"
                    maxLength={512}
                  />
                  <Field
                    label="Country code"
                    name="country"
                    value={workspace.country}
                    placeholder="US, IN, GB…"
                    required
                    maxLength={2}
                    pattern="[A-Za-z]{2}"
                  />
                  <Field
                    label="Currency code"
                    name="currency"
                    value={workspace.currency}
                    placeholder="USD, INR, GBP…"
                    required
                    maxLength={3}
                    pattern="[A-Za-z]{3}"
                  />
                  <Field
                    label="Timezone"
                    name="timezone"
                    value={workspace.timezone}
                    placeholder="Asia/Kolkata"
                    required
                    maxLength={64}
                    list="timezones"
                  />
                  <datalist id="timezones">
                    {[
                      "UTC",
                      "Asia/Kolkata",
                      "America/New_York",
                      "America/Los_Angeles",
                      "Europe/London",
                      "Europe/Paris",
                      "Asia/Singapore",
                      "Australia/Sydney",
                    ].map((zone) => (
                      <option key={zone} value={zone} />
                    ))}
                  </datalist>
                </div>
                <div className={styles.preferenceBox}>
                  <h3>Built around your preferences</h3>
                  <Field
                    label={`Review threshold (${workspace.currency})`}
                    name="approvalThreshold"
                    value={String(workspace.approvalThreshold)}
                    type="number"
                    min={0}
                    max={1e9}
                    step="0.01"
                    required
                  />
                  <p className={styles.note}>
                    Saved for future approval rules. All financial actions will
                    still require explicit approval.
                  </p>
                  <label className={styles.checkbox}>
                    <input
                      name="emailNotifications"
                      type="checkbox"
                      defaultChecked={workspace.emailNotifications}
                    />
                    <span>
                      Email me workspace updates{" "}
                      <small>
                        Operational email delivery uses the configured application sender.
                      </small>
                    </span>
                  </label>
                </div>
                <div className={styles.actions}>
                  <span>Your details are saved securely.</span>
                  <button className={styles.primary} disabled={busy || !manage}>{busy && <Spinner size={15}/>} 
                    {busy ? "Saving…" : "Save & continue"}
                    <ArrowRight size={17} />
                  </button>
                </div>
              </fieldset>
            </form>
          )}
          {step === 1 && (
            <>
              <div className={styles.integrationList}>
                <WorkspaceInbox workspaceId={workspace.id} canManage={manage} />
                {PROVIDERS.filter((provider) => provider !== "gmail" || ready.gmail || integrations.some((i) => i.provider === "gmail")).map((provider) => {
                  const item = info[provider],
                    connected = integrations.find(
                      (i) => i.provider === provider,
                    ),
                    allowed = provider === "paypal" ? owner : manage;
                  return (
                    <article className={styles.integrationCard} key={provider}>
                      <div className={styles.integrationTop}>
                        <span
                          className={`${styles.providerIcon} ${styles[provider]}`}
                        >
                          <ProviderMark provider={provider} size={30} />
                        </span>
                        <div>
                          <h2>
                            {item.name}
                            {provider === "paypal" && (
                              <span className={styles.tag}>SANDBOX</span>
                            )}
                          </h2>
                          <p>{item.description}</p>
                        </div>
                        {connected && (
                          <span
                            className={
                              connected.status === "connected"
                                ? styles.connected
                                : styles.attention
                            }
                          >
                            {connected.status === "connected"
                              ? "Connected"
                              : "Needs attention"}
                          </span>
                        )}
                      </div>
                      <p className={styles.integrationDetail}>
                        {connected
                          ? `${connected.label}${connected.channel ? ` · ${connected.channel}` : ""}`
                          : item.detail}
                      </p>
                      {connected && (
                        <p className={styles.note}>
                          Last checked:{" "}
                          <time dateTime={connected.checkedAt}>
                            {new Date(connected.checkedAt)
                              .toISOString()
                              .slice(0, 16)
                              .replace("T", " ")}{" "}
                            UTC
                          </time>{" "}
                          · {connected.environment}
                        </p>
                      )}
                      <div className={styles.integrationButtons}>
                        {connected ? (
                          <>
                            <button
                              className={styles.secondary}
                              disabled={busy || !allowed || !triggerReady}
                              onClick={() =>
                                void perform(
                                  `${api}/integrations/${provider}/check`,
                                )
                              }
                            >{busy && <Spinner size={15}/>} 
                              Check connection
                            </button>
                            <button
                              className={styles.textButton}
                              disabled={busy || !allowed}
                              onClick={() =>
                                void perform(
                                  `${api}/integrations/${provider}/disconnect`,
                                )
                              }
                            >{busy && <Spinner size={15}/>} 
                              Disconnect
                            </button>
                          </>
                        ) : (
                          <button
                            className={styles.secondary}
                            disabled={busy || !allowed || !ready[provider]}
                            onClick={() =>
                              provider === "paypal"
                                ? setPaypalOpen(!paypalOpen)
                                : void perform(
                                    `${api}/integrations/${provider}/connect`,
                                  )
                            }
                          >{busy && <Spinner size={15}/>} 
                            {provider === "paypal"
                              ? "Connect sandbox account"
                              : `Connect ${item.name}`}
                            <ExternalLink size={14} />
                          </button>
                        )}
                        {!ready[provider] && (
                          <small>App configuration needed</small>
                        )}
                        {provider === "paypal" && !owner && (
                          <small>Only the owner can connect PayPal</small>
                        )}
                      </div>
                      {provider === "paypal" && paypalOpen && (
                        <form
                          method="post"
                          action="/api/forms/unavailable"
                          className={styles.paypalForm}
                          onSubmit={paypal}
                        >
                          <div className={styles.paypalInstructions}>
                            <span className={styles.tag}>
                              DEVELOPMENT CONNECTION
                            </span>
                            <h3>Connect your sandbox REST app</h3>
                            <ol>
                              <li>
                                Open PayPal Developer Dashboard → Apps &
                                Credentials.
                              </li>
                              <li>
                                Select <strong>Sandbox</strong> and the app
                                belonging to this business account.
                              </li>
                              <li>
                                Copy the app’s Client ID and Secret below.
                              </li>
                            </ol>
                            <a
                              href="https://developer.paypal.com/dashboard/applications/sandbox"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Open PayPal Developer Dashboard
                              <ExternalLink size={13} />
                            </a>
                          </div>
                          <Field
                            label="Account label"
                            name="merchantLabel"
                            placeholder="Acme sandbox merchant"
                            value={workspace.businessName}
                            required
                            maxLength={128}
                          />
                          <Field
                            label="Sandbox client ID"
                            name="clientId"
                            autoComplete="off"
                            required
                            maxLength={1024}
                          />
                          <Field
                            label="Sandbox client secret"
                            name="clientSecret"
                            type="password"
                            autoComplete="new-password"
                            required
                            maxLength={1024}
                          />
                          <button className={styles.primary} disabled={busy}>{busy && <Spinner size={15}/>} 
                            {busy
                              ? "Verifying sandbox credentials…"
                              : "Verify & connect sandbox app"}
                            <ShieldCheck size={16} />
                          </button>
                        </form>
                      )}
                    </article>
                  );
                })}
              </div>
              <div className={styles.notice}>
                <ShieldCheck size={18} />
                <p>
                  Connections are optional for now. Credentials are encrypted.
                  Disconnecting removes this workspace’s stored access; provider
                  permissions can also be revoked in your provider settings.
                </p>
              </div>
              <div className={styles.actions}>
                <button className={styles.textButton} onClick={() => move(0)}>
                  <ArrowLeft size={15} /> Back
                </button>
                <button
                  className={styles.primary}
                  disabled={busy}
                  onClick={() => move(2)}
                >{busy && <Spinner size={15}/>} 
                  Continue
                  <ArrowRight size={17} />
                </button>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div className={styles.roleGuide}>
                <strong>A role for everyone.</strong>
                <p>
                  <b>Owner</b> manages the team and PayPal. <b>Admins</b> manage
                  the profile and communication integrations.{" "}
                  <b>Members & viewers</b> can view the workspace. Only the workspace owner can approve financial actions.
                </p>
              </div>
              {owner && (
                <form
                  method="post"
                  action="/api/forms/unavailable"
                  className={styles.inviteForm}
                  onSubmit={invite}
                >
                  <Field
                    label="Email address"
                    name="email"
                    type="email"
                    placeholder="teammate@business.com"
                    required
                    maxLength={320}
                  />
                  <label>
                    Role
                    <select name="role" defaultValue="member">
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </label>
                  <button className={styles.primary} disabled={busy}>{busy && <Spinner size={15}/>} 
                    {busy ? "Sending…" : "Send invite"}
                    <ArrowRight size={16} />
                  </button>
                </form>
              )}
              <div className={styles.memberList}>
                {members.map((member) => (
                  <div className={styles.member} key={member.id}>
                    <span className={styles.avatar}>
                      {(member.name || member.email || "?")
                        .slice(0, 1)
                        .toUpperCase()}
                    </span>
                    <div>
                      <strong>{member.name || member.email}</strong>
                      <small>
                        {member.name ? member.email : ""}
                        {!member.confirmed ? " · Invitation pending" : ""}
                      </small>
                    </div>
                    {owner && !member.roles.includes("owner") ? (
                      <>
                        <label
                          className={styles.srOnly}
                          htmlFor={`role-${member.id}`}
                        >
                          Role for {member.email}
                        </label>
                        <select
                          id={`role-${member.id}`}
                          value={member.roles[0] || "viewer"}
                          disabled={busy}
                          onChange={(event) =>
                            void perform(`${api}/role`, {
                              membershipId: member.id,
                              role: event.target.value,
                            })
                          }
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          className={styles.textButton}
                          disabled={busy}
                          onClick={() =>
                            void perform(`${api}/remove`, {
                              membershipId: member.id,
                            })
                          }
                        >{busy && <Spinner size={15}/>} 
                          {member.confirmed ? "Remove" : "Cancel invite"}
                        </button>
                      </>
                    ) : (
                      <span className={styles.roleTag}>
                        {member.roles.join(", ")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className={styles.actions}>
                <button className={styles.textButton} onClick={() => move(1)}>
                  <ArrowLeft size={15} /> Back
                </button>
                <button
                  className={styles.primary}
                  disabled={busy}
                  onClick={() => move(3)}
                >{busy && <Spinner size={15}/>} 
                  {members.length > 1 ? "Continue" : "I’ll invite people later"}
                  <ArrowRight size={17} />
                </button>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <div className={styles.reviewHero}>
                <span>
                  <CheckCheck size={30} />
                </span>
                <h2>A good place to start.</h2>
                <p>{workspace.name} is ready for its next chapter.</p>
              </div>
              <div className={styles.reviewRows}>
                <div>
                  <span>Business profile</span>
                  <strong>
                    {workspace.businessName} <Check size={16} />
                  </strong>
                </div>
                <div>
                  <span>Preferences</span>
                  <strong>
                    {workspace.currency} · {workspace.timezone}
                  </strong>
                </div>
                <div>
                  <span>Connected tools</span>
                  <strong>
                    {integrations.length
                      ? integrations
                          .map((i) => info[i.provider].name)
                          .join(", ")
                      : "Connect later"}
                  </strong>
                </div>
                <div>
                  <span>Team</span>
                  <strong>
                    {members.filter((m) => m.confirmed).length} active ·{" "}
                    {members.filter((m) => !m.confirmed).length} pending
                  </strong>
                </div>
                <div>
                  <span>Payment environment</span>
                  <strong>PayPal sandbox only</strong>
                </div>
              </div>
              <p className={styles.note}>
                Your workspace is ready. Forwarded emails appear in Conversations, where AssentPay checks them for business details. Review any proposed financial actions in Approvals before they proceed.
              </p>
              <div className={styles.actions}>
                <button className={styles.textButton} onClick={() => move(2)}>
                  <ArrowLeft size={15} /> Back
                </button>
                <button
                  className={styles.primary}
                  disabled={busy || !manage}
                  onClick={() => void perform(`${api}/complete`)}
                >{busy && <Spinner size={15}/>} 
                  {busy ? "Opening…" : "Open workspace"}
                  <ChevronRight size={18} />
                </button>
              </div>
            </>
          )}
          <footer className={styles.setupFooter}>
            A calm start to a more connected business.<span>ASSENTPAY</span>
          </footer>
        </section>
      </div>
    </div>
  );
}
function Field({
  label,
  value,
  ...props
}: {
  label: string;
  value?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={styles.field}>
      {label}
      <input defaultValue={value} {...props} />
    </label>
  );
}
