import { Suspense } from "react";
import { requireVerifiedUser } from "@/lib/auth/appwrite";
import { workspaceAccess } from "@/lib/workspaces/server";
import { validId, InputError } from "@/lib/workspaces/validation";
import { optionalRow } from "@/lib/automation/store";
import { proposalHash } from "@/lib/automation/intelligence";
import { quotedRecipientEmail } from "@/lib/automation/extraction";
import { sendId } from "@/lib/automation/paypal-invoice-link";
import { sendReviewView } from "@/lib/automation/paypal-send-view";
import { SlackIdentity } from "@/components/integrations/slack-identity";
import { SectionHeader } from "@/components/dashboard/section-header";
import { IntegrationMark } from "@/components/integration-mark";
import styles from "@/components/integrations/slack-identity.module.css";
import { slackApprovalReady, slackIdentityLinked } from "@/lib/automation/slack-approvals";
import Link from "next/link";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ workflowId?: string }> };
async function OwnerContent({ params, searchParams }: Props) {
  const { id } = await params, query = await searchParams, user = await requireVerifiedUser();
  validId(id); await workspaceAccess(id, user.$id, ["owner"]);
  if (!await slackApprovalReady()) return <section><h1>Verified Slack decisions are unavailable</h1><p>Ask the operator to apply and verify additive migration 008 and Slack interactivity setup. No Slack decision access has been granted.</p><Link href="/dashboard/approvals">Continue secure dashboard review</Link></section>;
  let workflow;
  if (query.workflowId) {
    validId(query.workflowId);
    const row = await optionalRow("financial_workflows", query.workflowId);
    if (!row || row.workspaceId !== id) throw new InputError("Workflow unavailable.", 404);
    const reviewRow = row.status === "draft_created" && row.action === "create_draft_invoice"
      ? await optionalRow("paypal_send_reviews", sendId(id, row.$id)) : null;
    const review = reviewRow?.workflowId === row.$id ? sendReviewView(reviewRow, id, true) : null;
    const invoice = review?.snapshot.invoice;
    const recipient = invoice?.primary_recipients[0]?.billing_info.email_address;
    const sendReview = review && review.snapshot.providerId === row.providerId && recipient && invoice?.amount.currency_code && invoice.amount.value
      ? { snapshotHash: review.snapshotHash, recipient, amount: `${invoice.amount.currency_code} ${invoice.amount.value}` } : null;
    workflow = { id: row.$id, hash: proposalHash(row.proposalJson), amount: String(row.amount), currency: String(row.currency), status: String(row.status), action: String(row.action), counterparty: String(row.counterparty || ""), sourceEmail: quotedRecipientEmail(JSON.parse(row.proposalJson)), sendReview };
  }
  return <SlackIdentity workspaceId={id} initiallyLinked={await slackIdentityLinked(id, user.$id)} workflow={workflow} />;
}
export default function Page(props: Props) {
  return <main className={styles.page}>
    <SectionHeader category="Workspace" title="Slack decisions" description="Review financial proposals and send private decision buttons to Slack." icon={<IntegrationMark provider="slack" />} />
    <Suspense fallback={<p>Checking workspace access…</p>}><OwnerContent {...props} /></Suspense>
  </main>;
}
