import Link from "next/link";
import { displayTime } from "@/lib/dashboard/date-format";
export { displayTime } from "@/lib/dashboard/date-format";
import { ArrowUpRight, CheckCheck, CircleCheck, Clock3, Inbox, Mail, Settings2, ShieldCheck, Sparkles, TriangleAlert } from "@/components/icons";
import ui from "./workspace-content.module.css";

export type ConversationSummary = { id: string; sender: string; subject: string; snippet: string; receivedAt: string; unread: boolean; financial: boolean };
export function senderName(sender: string) {
  const name = sender.match(/^\s*"?([^"<]+?)"?\s*</)?.[1];
  return name?.trim() || sender.split("@")[0] || "Unknown sender";
}
export function avatarTone(sender: string) {
  const identity = (sender.match(/<([^>]+)>/)?.[1] || sender).trim().toLowerCase();
  let hash = 0;
  for (let index = 0; index < identity.length; index++) hash = (Math.imul(hash, 31) + identity.charCodeAt(index)) >>> 0;
  return ["avatarBlue", "avatarViolet", "avatarRose", "avatarMint", "avatarAmber", "avatarTeal"][hash % 6];
}
export function initials(sender: string) {
  return senderName(sender).split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
const events: Record<string, { title: string; description: string; tone: string; icon: typeof Mail }> = {
  "workspace.profile_updated": { title: "Workspace profile updated", description: "Your business details have been saved.", tone: "violet", icon: Settings2 },
  "job.completed": { title: "Workspace update completed", description: "A saved email or connected-tool update finished processing.", tone: "green", icon: CircleCheck },
  "job.failed": { title: "A task needs attention", description: "Review the background task details below.", tone: "amber", icon: TriangleAlert },
  "inbox.test_received": { title: "Email delivery confirmed", description: "Your test message reached the workspace inbox.", tone: "green", icon: CheckCheck },
  "inbox.test": { title: "Delivery check requested", description: "A new email connection check was started.", tone: "blue", icon: Mail },
  "inbox.verification_received": { title: "Forwarding confirmation received", description: "Your confirmation is available in inbox setup.", tone: "violet", icon: ShieldCheck },
  "inbox.source_updated": { title: "Forwarding mailbox selected", description: "The email address and provider for your setup have been saved.", tone: "blue", icon: Mail },
  "inbox.provisioned": { title: "Workspace inbox created", description: "Your private forwarding address is ready.", tone: "blue", icon: Inbox },
  "message.analyzed": { title: "Email analysis completed", description: "Extracted context is available for review.", tone: "violet", icon: Sparkles },
  "workflow.approved": { title: "Financial proposal approved", description: "An owner authorized the reviewed proposal.", tone: "green", icon: ShieldCheck },
  "workflow.rejected": { title: "Financial proposal declined", description: "The proposed action was rejected during review.", tone: "amber", icon: ShieldCheck },
  "paypal.draft_created": { title: "Invoice draft created", description: "A draft invoice was created in PayPal sandbox.", tone: "green", icon: CircleCheck },
  "paypal.outcome_unknown": { title: "Invoice status needs review", description: "Review the provider outcome before taking another action.", tone: "amber", icon: TriangleAlert },
  "message.received": { title: "New email received", description: "A message was added to your conversations.", tone: "blue", icon: Mail },
};
export function ActivityTimeline({ events: items, timeZone = "UTC", compact = false }: { events: { id: string; action: string; occurredAt: string; kind?: string }[]; timeZone?: string; compact?: boolean }) {
  return <ol className={`${ui.timeline} ${compact ? ui.compactTimeline : ""}`}>{items.map((event) => {
    const taskLabels: Record<string, string> = { "resend-ingest": "Email import", "financial-analyze": "Financial detail review", "document-import": "Attachment import", "gmail-sync": "Gmail message update", "paypal-execute": "Approved invoice draft", "paypal-reconcile": "Invoice status check", "workflow-notify": "Workspace notification", "provider-event": "Connected tool update" };
    const taskLabel = event.kind ? taskLabels[event.kind] : undefined;
    const detail = taskLabel && event.action.startsWith("job.") ? { title: `${taskLabel} ${event.action === "job.completed" ? "completed" : event.action === "job.failed" ? "needs attention" : "stopped"}`, description: "View Email & workspace processing for details.", tone: event.action === "job.failed" ? "amber" : "green", icon: event.action === "job.failed" ? TriangleAlert : CircleCheck } : events[event.action] || { title: event.action.replaceAll(/[._]/g, " ").replace(/^./, (c) => c.toUpperCase()), description: "Recorded in your workspace activity history.", tone: "blue", icon: Sparkles };
    const Icon = detail.icon;
    return <li className={ui.event} key={event.id}><span className={`${ui.eventIcon} ${ui[detail.tone]}`}><Icon size={17} /></span><div className={ui.eventContent}><strong>{detail.title}</strong><p>{detail.description}</p><time dateTime={event.occurredAt} title={`${displayTime(event.occurredAt, timeZone, true)} (${timeZone})`}>{displayTime(event.occurredAt, timeZone, true)}</time></div></li>;
  })}</ol>;
}
export function RecentConversations({ items, timeZone = "UTC" }: { items: ConversationSummary[]; timeZone?: string }) {
  return <><div className={ui.recentList}>{items.map((item) => <Link key={item.id} href={`/dashboard/inbox?message=${encodeURIComponent(item.id)}`} className={ui.recentRow}><span className={`${ui.avatar} ${ui[avatarTone(item.sender)]}`}>{initials(item.sender)}</span><div className={ui.recentContent}><div className={ui.senderLine}><strong>{senderName(item.sender)}</strong><time dateTime={item.receivedAt}>{displayTime(item.receivedAt, timeZone)}</time></div><p className={ui.recentSubject}>{item.subject || "No subject"}</p><p className={ui.excerpt}>{item.snippet || "Open to read this message."}</p></div><span className={ui.rowEnd}>{item.unread && <i aria-label="Unread" />}<ArrowUpRight size={14} /></span></Link>)}</div><Link className={ui.cardFooter} href="/dashboard/inbox">View all conversations <ArrowUpRight size={14} /></Link></>;
}
export function ActivityEmpty() { return <div className={ui.empty}><Clock3 size={25} /><h3>Your activity starts here</h3><p>Messages, processing updates, and review decisions will appear here.</p></div>; }
