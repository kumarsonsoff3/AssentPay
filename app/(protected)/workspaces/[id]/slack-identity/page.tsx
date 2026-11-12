import { Suspense } from "react";
import { requireVerifiedUser } from "@/lib/auth/appwrite";
import { workspaceAccess } from "@/lib/workspaces/server";
import { validId, InputError } from "@/lib/workspaces/validation";
import { optionalRow } from "@/lib/automation/store";
import { proposalHash } from "@/lib/automation/intelligence";
import { SlackIdentity } from "@/components/integrations/slack-identity";
import { slackApprovalReady } from "@/lib/automation/slack-approvals";
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
    workflow = { id: row.$id, hash: proposalHash(row.proposalJson), amount: String(row.amount), currency: String(row.currency), status: String(row.status), action: String(row.action) };
  }
  return <SlackIdentity workspaceId={id} workflow={workflow} />;
}
export default function Page(props: Props) { return <main style={{ maxWidth: 800, margin: "3rem auto", padding: "1rem" }}><Suspense fallback={<p>Checking owner access…</p>}><OwnerContent {...props} /></Suspense></main>; }
