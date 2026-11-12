import { Query, type Models, type TablesDB } from "node-appwrite";
import { InputError } from "../workspaces/validation";
import { digest, financialClaimId, quotesObligationReference } from "./financial-safety";
import { optionalRow, params } from "./store";

type Proposal = {
  extraction?: { reference?: string; evidence?: { quote: string }[] };
  obligationEvidence?: boolean;
};

function quotedReference(proposal: Proposal | null) {
  const extraction = proposal?.extraction;
  const reference = typeof extraction?.reference === "string" ? extraction.reference.trim() : "";
  if (!reference || proposal?.obligationEvidence === false ||
      !Array.isArray(extraction?.evidence) ||
      !extraction.evidence.some(e => typeof e?.quote === "string" && quotesObligationReference(e.quote, reference)))
    throw new InputError("A stable obligation reference must be quoted in the source before approval or execution.", 409, "INVOICE_OBLIGATION_REFERENCE_REQUIRED");
  return reference.toLowerCase();
}

function duplicateObligation() {
  return new InputError(
    "This billing email already has an approved invoice or payout for the same reference. Review the existing workflow.",
    409,
    "INVOICE_OBLIGATION_DUPLICATE",
  );
}

function historicalReview() {
  return new InputError(
    "An earlier invoice could not be matched safely. Review the existing invoice history before approving another.",
    409,
    "INVOICE_OBLIGATION_HISTORY_REVIEW",
  );
}

/** Use the owner-approved recipient so different extracted names cannot bypass the claim. */
export async function reserveInvoiceObligation(
  db: TablesDB,
  tx: string,
  workflow: Models.DefaultRow,
  recipientEmail: string,
) {
  const { workspaceId, $id: workflowId } = workflow;
  let proposal: Proposal | null;
  try {
    proposal = JSON.parse(workflow.proposalJson);
  } catch {
    throw historicalReview();
  }
  const reference = quotedReference(proposal);
  const recipient = recipientEmail.trim().toLowerCase();
  const fingerprint = digest(JSON.stringify(["invoice-recipient-v1", workspaceId, recipient, reference]));
  const claimId = financialClaimId(workspaceId, fingerprint);
  const claim = await optionalRow("financial_claims", claimId, db, tx);
  if (claim) {
    if (claim.workspaceId !== workspaceId || claim.fingerprint !== fingerprint) throw historicalReview();
    if (claim.workflowId !== workflowId) throw duplicateObligation();
    return;
  }

  // Actions from before this check have no recipient claim. Include authorized,
  // completed and ambiguous actions so an upgrade cannot authorize a replacement.
  let cursor: string | undefined;
  do {
    const page = await db.listRows({
      ...params("financial_actions"),
      transactionId: tx,
      total: false,
      queries: [
        Query.equal("workspaceId", workspaceId),
        Query.orderAsc("$id"),
        Query.select(["$id", "workspaceId", "workflowId", "requestJson"]),
        Query.limit(100),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
    });
    for (const action of page.rows) {
      if (action.workspaceId !== workspaceId || action.workflowId === workflowId) continue;
      let earlierRecipient: unknown;
      try {
        const request = JSON.parse(action.requestJson).request;
        earlierRecipient = request?.primary_recipients?.[0]?.billing_info?.email_address ?? request?.items?.[0]?.receiver;
      } catch {
        throw historicalReview();
      }
      if (typeof earlierRecipient !== "string") throw historicalReview();
      if (earlierRecipient.trim().toLowerCase() !== recipient) continue;

      const earlier = await optionalRow("financial_workflows", action.workflowId, db, tx);
      if (!earlier || earlier.workspaceId !== workspaceId) throw historicalReview();
      let earlierReference: string;
      try {
        earlierReference = quotedReference(JSON.parse(earlier.proposalJson));
      } catch {
        throw historicalReview();
      }
      if (earlierReference === reference) throw duplicateObligation();
    }
    cursor = page.rows.length === 100 ? page.rows.at(-1)?.$id : undefined;
  } while (cursor);

  await db.createRow({
    ...params("financial_claims", claimId, tx),
    permissions: [],
    data: { workspaceId, workflowId, fingerprint },
  });
}
