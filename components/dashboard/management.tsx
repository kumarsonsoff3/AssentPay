"use client";

import { SelectField, workspaceRoleOptions } from "@/components/controls/select-field";
import { IndustrySelect } from "@/components/controls/industry-select";
import { RegionalSelect } from "@/components/controls/regional-select";
import type { RegionalOptions } from "@/lib/workspaces/regions";
import { useToast } from "@/components/feedback/toast-provider";
import { InlineFeedback, Spinner } from "@/components/feedback/feedback";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import connections from "@/components/settings/integrations.module.css";
import {
  ArrowUpRight,
  ArrowRight,
  Clock3,
  TriangleAlert,
  X,
  Check,
  RefreshCw,
  Unplug,
  UserPlus,
  ShieldCheck,
  Building2,
  SlidersHorizontal,
} from "@/components/icons";
import {
  PROVIDERS,
  canManage,
  type IntegrationSummary,
  type Member,
  type Provider,
  type Workspace,
} from "@/lib/workspaces/types";
import { post } from "@/components/onboarding/client";
import { WorkspaceInbox } from "@/components/onboarding/workspace-inbox";
import { ProviderMark } from "@/components/onboarding/provider-mark";
import { PhaseNotice } from "./states";
import styles from "./dashboard.module.css";
import ui from "@/components/settings/settings.module.css";
import { SettingsSection } from "@/components/settings/settings-layout";
function useMutation() {
  const notify = useToast();
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false);
  async function run(path: string, body: unknown = {}) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await post(path, body);
      if (result.redirect) {
        window.location.assign(result.redirect);
        return true;
      }
      notify(result.message || "Saved.");
      router.refresh();
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The request could not be completed.",
      );
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return {
    busy,
    run,
    feedback: (
      <>
        {error && (
          <InlineFeedback>{error}</InlineFeedback>
        )}
      </>
    ),
  };
}
export function IntegrationManager({
  workspace, integrations, checkedAtLabels, ready, triggerReady, initialInboxStatus = null,
}: {
  workspace: Workspace;
  integrations: IntegrationSummary[];
  checkedAtLabels: Partial<Record<Provider, string>>;
  ready: Record<Provider, boolean>;
  triggerReady: boolean;
  initialInboxStatus?: string | null;
}) {
  const { busy, run, feedback } = useMutation();
  const [confirm, setConfirm] = useState<Provider | null>(null);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [liveInboxStatus, setInboxStatus] = useState<string | null>();
  const inboxStatus = liveInboxStatus === undefined ? initialInboxStatus : liveInboxStatus;
  const api = `/api/workspaces/${workspace.id}/integrations`;
  const providers = PROVIDERS.filter((provider) => provider !== "gmail" || ready.gmail || integrations.some((item) => item.provider === "gmail"));
  const gmailConnected = inboxStatus === "receiving" || integrations.some((item) => item.provider === "gmail" && item.status === "connected");
  const connected = integrations.filter((item) => item.provider !== "gmail" && item.status === "connected").length + Number(gmailConnected);
  const descriptions = {
    gmail: { name: "Gmail", category: "DIRECT EMAIL CONNECTION", summary: "Bring connected mailbox conversations into your workspace.", features: ["Retrieve messages through your Google connection", "Review synced messages in Conversations", "Manage forwarding separately in Workspace email"] },
    slack: { name: "Slack", category: "TEAM UPDATES", summary: "Keep review requests and workspace updates close to your team.", features: ["Deliver review notifications to your chosen channel", "Keep your team informed about workspace activity", "Review financial proposals before approving them"] },
    paypal: { name: "PayPal", category: "INVOICES & PAYMENTS", summary: "Prepare approved invoice drafts in your PayPal sandbox.", features: ["Create sandbox drafts after the owner’s approval", "Check invoice updates against PayPal records", "Sandbox only — no real payments"] },
  };
  async function paypal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await run(`${api}/paypal/connect`, Object.fromEntries(new FormData(form)))) {
      form.reset(); setCredentialsOpen(false);
    }
  }
  return <div className={connections.manager}>
    {!credentialsOpen && !confirm && feedback}
    <div className={connections.sectionHeading}><div><span className={connections.eyebrow}>YOUR CONNECTED WORKSPACE</span><h2>Connected services</h2><p>Check setup and permissions for email, team alerts, and sandbox payments.</p></div><span className={connections.connectionCount}><span />{connected} tool{connected === 1 ? "" : "s"} connected</span></div>
    <div className={connections.groupHeading}><span className={connections.groupNumber}>01</span><div><h3>Email & conversations</h3><p>Choose which business emails reach your workspace.</p></div></div>
    <WorkspaceInbox workspaceId={workspace.id} canManage={canManage(workspace.role)} onStatusChange={setInboxStatus} />
    <div className={connections.groupHeading}><span className={connections.groupNumber}>02</span><div><h3>Your connected tools</h3><p>Connect a tool below, then manage its account and connection status here.</p></div></div>
    <div className={connections.grid}>{providers.map((provider) => {
      const item = integrations.find((connection) => connection.provider === provider);
      const manage = provider === "paypal" ? workspace.role === "owner" : canManage(workspace.role);
      const detail = descriptions[provider];
      const healthy = item?.status === "connected";
      return <section className={connections.card} key={provider}>
        <header className={connections.cardHeader}><span className={connections.providerMark}><ProviderMark provider={provider} size={30} /></span><div><span className={connections.category}>{detail.category}</span><h3>{detail.name}{provider === "paypal" && <span className={connections.sandbox}>Sandbox</span>}</h3></div><span className={`${connections.status} ${healthy ? connections.healthy : item ? connections.attention : connections.inactive}`}>{healthy ? <Check size={11} /> : <span />}{healthy ? "Connected" : item ? "Needs attention" : "Not connected"}</span></header>
        <div className={connections.cardBody}><p className={connections.description}>{detail.summary}</p><ul className={connections.features}>{detail.features.map((feature) => <li key={feature}><Check size={13} /><span>{feature}</span></li>)}</ul>
          <div className={connections.account}><span className={connections.accountIcon}>{item ? <ShieldCheck size={17} /> : <Unplug size={17} />}</span><div><span>{provider === "slack" ? "SLACK WORKSPACE" : provider === "paypal" ? "MERCHANT APP" : "GOOGLE ACCOUNT"}</span><strong>{item?.label || "No account connected yet"}</strong>{item?.channel && <small>Channel · {item.channel}</small>}</div></div>
          {item?.checkedAt && <p className={connections.checked}><Clock3 size={12} />Last checked <time dateTime={item.checkedAt}>{checkedAtLabels[provider]}</time></p>}
          {!manage && <p className={connections.roleNote}><ShieldCheck size={13} />A workspace {provider === "paypal" ? "owner" : "owner or admin"} can manage this connection.</p>}
          {manage && !ready[provider] && <div className={connections.setupNotice}><TriangleAlert size={15} /><p><strong>Service setup needed</strong>Your administrator needs to configure {detail.name} before you can connect an account.</p></div>}
        </div>
        <footer className={connections.cardFooter}><div className={connections.cardActions}>{manage && <>{provider === "paypal" ? <button className={connections.primary} disabled={busy || !ready.paypal} onClick={() => setCredentialsOpen(true)}>{item ? "Update sandbox app" : "Connect PayPal"}<ArrowUpRight size={13} /></button> : <button className={connections.primary} disabled={busy || !ready[provider]} onClick={() => void run(`${api}/${provider}/connect`)}>{busy && <Spinner size={14} />}{item ? `Reconnect ${detail.name}` : `Connect ${detail.name}`}<ArrowUpRight size={13} /></button>}{item && <button className={connections.secondary} disabled={busy || !triggerReady} title={!triggerReady ? "Connection checks will be available when workspace processing is configured." : "Verify the saved account connection"} onClick={() => void run(`${api}/${provider}/check`)}>{busy ? <Spinner size={14} /> : <RefreshCw size={14} />}Check status</button>}</>}{!manage && <span className={connections.readOnly}>Managed by your workspace {provider === "paypal" ? "owner" : "admins"}</span>}</div>{manage && item && <button className={connections.disconnect} disabled={busy} onClick={() => setConfirm(provider)} aria-label={`Disconnect ${detail.name}`}><Unplug size={13} />Disconnect</button>}</footer>
      </section>;
    })}</div>
    <div className={connections.securityNote}><span><ShieldCheck size={20} /></span><div><strong>Connection security</strong><p>Credentials are encrypted and kept on the server. Forwarded messages appear in Conversations; financial proposals are available in Approvals for your review.</p></div></div>
    <Dialog.Root open={credentialsOpen} onOpenChange={(open) => { if (!busy) setCredentialsOpen(open); }}><Dialog.Portal><Dialog.Overlay className={connections.overlay} /><Dialog.Content className={connections.dialog}><Dialog.Close className={connections.close} disabled={busy} aria-label="Close PayPal setup"><X size={18} /></Dialog.Close><span className={connections.dialogMark}><ProviderMark provider="paypal" size={31} /></span><span className={connections.category}>PAYPAL SANDBOX</span><Dialog.Title>Connect your sandbox merchant app</Dialog.Title><Dialog.Description>Use this business’s sandbox REST app credentials. PayPal features and transaction currencies depend on the merchant account. Your workspace preferences don’t change what PayPal supports.</Dialog.Description>{feedback}<form action="/api/forms/unavailable" method="post" onSubmit={paypal} className={connections.credentialsForm}><fieldset disabled={busy}><label>Merchant label<input name="merchantLabel" required maxLength={128} autoComplete="off" placeholder="Your business name" /><small>A friendly name to identify this merchant account.</small></label><label>Sandbox client ID<input name="clientId" required maxLength={1024} autoComplete="off" spellCheck={false} placeholder="Paste your sandbox client ID" /></label><label>Sandbox client secret<input type="password" name="clientSecret" required maxLength={1024} autoComplete="new-password" placeholder="Paste your sandbox client secret" /><small>Stored securely on the server after verification.</small></label></fieldset><div className={connections.sandboxNote}><ShieldCheck size={15} />This connects a sandbox app. It does not move real money.</div><div className={connections.dialogActions}><Dialog.Close type="button" className={connections.secondary} disabled={busy}>Cancel</Dialog.Close><button className={connections.primary} disabled={busy}>{busy && <Spinner size={15} />}{busy ? "Verifying app…" : "Verify & connect"}<ArrowRight size={14} /></button></div></form></Dialog.Content></Dialog.Portal></Dialog.Root>
    <Dialog.Root open={!!confirm} onOpenChange={(open) => { if (!open && !busy) setConfirm(null); }}><Dialog.Portal><Dialog.Overlay className={connections.overlay} /><Dialog.Content className={`${connections.dialog} ${connections.disconnectDialog}`}><Dialog.Close className={connections.close} disabled={busy} aria-label="Close disconnect confirmation"><X size={18} /></Dialog.Close><span className={connections.disconnectIcon}><Unplug size={23} /></span><Dialog.Title>Disconnect {confirm ? descriptions[confirm].name : "this tool"}?</Dialog.Title><Dialog.Description>This removes the saved connection from this workspace. You can reconnect later. To revoke the provider’s permissions too, use its account settings.</Dialog.Description>{feedback}<div className={connections.dialogActions}><Dialog.Close className={connections.secondary} disabled={busy}>Keep connection</Dialog.Close><button className={connections.dangerButton} disabled={busy} onClick={async () => { if (confirm && await run(`${api}/${confirm}/disconnect`)) setConfirm(null); }}>{busy && <Spinner size={15} />}Disconnect tool</button></div></Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}
export function TeamManager({
  workspace,
  members,
}: {
  workspace: Workspace;
  members: Member[];
}) {
  const { busy, run, feedback } = useMutation(),
    [remove, setRemove] = useState<string | null>(null),
    [inviteRole, setInviteRole] = useState("member"),
    owner = workspace.role === "owner",
    api = `/api/workspaces/${workspace.id}`;
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await run(`${api}/invite`, Object.fromEntries(new FormData(form)))) {
      form.reset();
      setInviteRole("member");
    }
  }
  return (
    <>
      {feedback}
      {owner && (
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <h2>Invite a teammate</h2>
            <UserPlus size={18} />
          </div>
          <form
            action="/api/forms/unavailable"
            method="post"
            className={styles.inviteForm}
            onSubmit={invite}
          >
            <label>
              Email address
              <input
                name="email"
                type="email"
                placeholder="teammate@company.com"
                required
                maxLength={320}
              />
            </label>
            <label>
              Workspace role
              <SelectField name="role" value={inviteRole} onValueChange={setInviteRole} options={workspaceRoleOptions} />
            </label>
            <button className={styles.button} disabled={busy}>{busy && <Spinner size={15}/>} 
              {busy ? "Sending…" : "Send invitation"}
            </button>
          </form>
        </section>
      )}
      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <h2>People in this workspace</h2>
          <span>
            {members.filter((m) => m.confirmed).length} active ·{" "}
            {members.filter((m) => !m.confirmed).length} pending
          </span>
        </div>
        <div className={styles.tableWrap} role="region" aria-label="Workspace members" tabIndex={0}>
          <table className={styles.teamTable} role="table">
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader">Name</th>
                <th role="columnheader">Role</th>
                <th role="columnheader">Status</th>
                <th role="columnheader">Actions</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {members.map((m) => (
                <tr role="row" key={m.id}>
                  <td role="cell">
                    <div className={ui.memberIdentity}>
                      <span className={ui.memberAvatar} aria-hidden="true">
                        {(m.name || m.email || (m.confirmed ? "M" : "I")).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                      </span>
                      <div>
                        <strong>{m.name || m.email || (m.confirmed ? "Workspace member" : "Invited teammate")}</strong>
                        {m.name && m.email && <small>{m.email}</small>}
                      </div>
                    </div>
                  </td>
                  <td role="cell">
                    <span className={styles.mobileCellLabel} aria-hidden="true">Role</span>
                    {owner && !m.roles.includes("owner") ? (
                      <SelectField
                        aria-label={`Role for ${m.email}`}
                        value={
                          m.roles.find((r) =>
                            ["admin", "member", "viewer"].includes(r),
                          ) || "viewer"
                        }
                        options={workspaceRoleOptions}
                        disabled={busy}
                        onValueChange={(role) =>
                          run(`${api}/role`, {
                            membershipId: m.id,
                            role,
                          })
                        }
                      />
                    ) : (
                      <span className={styles.memberRole}>{m.roles.join(", ")}</span>
                    )}
                  </td>
                  <td role="cell">
                    <span className={styles.mobileCellLabel} aria-hidden="true">Status</span>
                    <span
                      className={
                        m.confirmed ? styles.connected : styles.mutedStatus
                      }
                    >
                      {m.confirmed ? "Active" : "Invited"}
                    </span>
                  </td>
                  <td role="cell">
                    {owner &&
                      !m.roles.includes("owner") &&
                      (remove === m.id ? (
                        <div className={styles.actions}>
                          <button
                            className={styles.danger}
                            disabled={busy}
                            onClick={async () => {
                              if (
                                await run(`${api}/remove`, {
                                  membershipId: m.id,
                                })
                              )
                                setRemove(null);
                            }}
                          >{busy && <Spinner size={15}/>} 
                            Confirm
                          </button>
                          <button
                            className={styles.secondary}
                            disabled={busy}
                            onClick={() => setRemove(null)}
                          >{busy && <Spinner size={15}/>} 
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className={styles.danger}
                          disabled={busy}
                          onClick={() => setRemove(m.id)}
                          aria-label={!m.confirmed && m.email ? `Cancel invite for ${m.email}` : undefined}
                        >{busy && <Spinner size={15}/>} 
                          {m.confirmed ? "Remove" : "Cancel invite"}
                        </button>
                      ))}
                    {m.roles.includes("owner") && (
                      <span className={styles.mutedStatus}>
                        <ShieldCheck size={13} />
                        Protected
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <PhaseNotice>
        Only workspace owners can invite teammates, change roles, and approve financial actions.
      </PhaseNotice>
    </>
  );
}
type WorkspaceSettingsProps = { workspace: Workspace } & (
  | { rulesOnly: true; profileOnly?: never; regionalOptions?: never }
  | { rulesOnly?: false; profileOnly?: boolean; regionalOptions: RegionalOptions }
);

export function WorkspaceSettings({ workspace, rulesOnly, profileOnly, regionalOptions }: WorkspaceSettingsProps) {
  const { busy, run, feedback } = useMutation();
  const [dirty, setDirty] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  const manage = canManage(workspace.role);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(event.currentTarget));
    const data = {
      businessName: workspace.businessName,
      website: workspace.website,
      industry: workspace.industry,
      country: workspace.country,
      currency: workspace.currency,
      timezone: workspace.timezone,
      ...input,
      ...(!rulesOnly ? {businessName: String(input.businessName || "").trim() || workspace.name} : {}),
      approvalThreshold: profileOnly ? workspace.approvalThreshold : Number(input.approvalThreshold),
      emailNotifications: profileOnly ? workspace.emailNotifications : input.emailNotifications === "on",
    };
    if (await run(`/api/workspaces/${workspace.id}/profile`, data)) setDirty(false);
  }
  return <SettingsSection
    title={rulesOnly ? "Approval policy" : "Details & local preferences"}
    description={rulesOnly ? "Set the preferences your organization uses when reviewing financial work." : "Keep your business profile accurate and set the currency and time zone for your workspace."}
    note={rulesOnly ? <><strong>Your team stays in control</strong>These preferences do not authorize payments or activate financial execution.</> : <><strong>Organization name</strong>{workspace.name}<br/>Change the workspace’s primary name in Organization name.</>}
  >
    <div className={`${ui.card} ${ui.settingsEditor}`}>
      <div className={ui.cardHeader}><span className={ui.avatar}>{rulesOnly ? <SlidersHorizontal size={22}/> : <Building2 size={22}/>}</span><div><h3>{rulesOnly ? "Review preferences" : "Business details"}</h3><p>{rulesOnly ? "Applied to this organization only" : "Your business profile and regional defaults"}</p></div></div>
      <form action="/api/forms/unavailable" method="post" onSubmit={save} onChange={() => setDirty(true)} onReset={() => { setDirty(false); setResetCount(count => count + 1); }} className={ui.cardForm}>
        <div className={ui.formBody}><fieldset disabled={busy || !manage}>
          <legend className="sr-only">{rulesOnly ? "Approval preferences" : "Business profile"}</legend>
          {!rulesOnly && <>
            <div className={ui.profileGroup}>
            <h4>Business identity</h4>
            <label>Trading name <span className={ui.optional}>Optional</span><input name="businessName" defaultValue={workspace.businessName === workspace.name ? "" : workspace.businessName} placeholder={workspace.name} maxLength={128}/><span className={ui.fieldHint}>Only needed if your business uses a different name. Otherwise, we’ll use {workspace.name}.</span></label>
            <label>Business website<input name="website" type="url" defaultValue={workspace.website} placeholder="https://yourbusiness.com" maxLength={512}/></label>
            <IndustrySelect key={`${workspace.industry}:${resetCount}`} className={ui.field} value={workspace.industry} />
            </div>
            <div className={ui.profileGroup}>
            <h4>Regional preferences</h4>
            <div className={ui.fieldPair}>
              <RegionalSelect className={ui.field} label="Country or region" name="country" value={workspace.country} options={regionalOptions.country} />
              <RegionalSelect className={ui.field} label="Currency" name="currency" value={workspace.currency} options={regionalOptions.currency} hint="Default currency for workspace amounts." hintClassName={ui.fieldHint} />
            </div>
            <RegionalSelect className={ui.field} label="Time zone" name="timezone" value={workspace.timezone} options={regionalOptions.timezone} hint="Used to display dates and times." hintClassName={ui.fieldHint} />
            </div>
          </>}
          {!profileOnly && <>
            <label>Approval threshold<div className={ui.amountInput}><span>{workspace.currency}</span><input name="approvalThreshold" type="number" min="0" max="1000000000" step="0.01" defaultValue={workspace.approvalThreshold} required/></div><span className={ui.fieldHint}>Your saved amount for reviewing approval requests.</span></label>
            <label className={ui.toggleRow}><div><strong>Email updates</strong><span>Receive notifications about workspace activity.</span></div><input name="emailNotifications" type="checkbox" defaultChecked={workspace.emailNotifications}/></label>
          </>}
        </fieldset></div>
        {feedback}
        <div className={ui.formFooter}><span className={ui.footerNote}>{manage ? "Changes apply to this organization" : "Only owners and admins can edit these details"}</span><div className={ui.footerActions}>{dirty && manage && <button type="reset" className={ui.ghostButton} disabled={busy}>{busy && <Spinner size={15}/>} Discard</button>}<button className={ui.button} disabled={busy || !manage || !dirty}>{busy && <Spinner size={16}/>}{busy ? "Saving…" : "Save changes"}</button></div></div>
      </form>
    </div>
  </SettingsSection>;
}
