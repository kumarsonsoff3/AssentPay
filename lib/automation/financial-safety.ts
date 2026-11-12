import { createHash } from "node:crypto";
import { InputError } from "../workspaces/validation";
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
// Execution generations fence authority, but must not change message identity.
export const gmailMessageId = (
  workspace: string,
  mailbox: string,
  message: string,
) =>
  digest(JSON.stringify([workspace, mailbox.toLowerCase(), message])).slice(
    0,
    32,
  );
export const financialClaimId = (workspace: string, fingerprint: string) =>
  digest(JSON.stringify([workspace, fingerprint, "financial-claim-v1"])).slice(
    0,
    32,
  );
export function exactAmount(value: string, currency: string) {
  const supported = new Set(
    "AUD BRL CAD CHF CNY CZK DKK EUR GBP HKD HUF ILS JPY MXN MYR NOK NZD PHP PLN SEK SGD THB TWD USD".split(
      " ",
    ),
  );
  const exponent = ["JPY", "HUF", "TWD"].includes(currency) ? 0 : 2;
  if (
    !supported.has(currency) ||
    !/^\d{1,12}(?:\.\d{1,2})?$/.test(value) ||
    (value.split(".")[1]?.length || 0) > exponent ||
    !/[1-9]/.test(value)
  )
    throw new InputError(
      "The amount or PayPal currency requires manual review.",
      409,
    );
  const [whole, fraction = ""] = value.split(".");
  return (
    String(BigInt(whole)) +
    (exponent ? "." + fraction.padEnd(exponent, "0") : "")
  );
}
export function sameFinancialValue(
  left: string,
  leftCurrency: string,
  right: string,
  rightCurrency: string,
) {
  if (leftCurrency !== rightCurrency) return false;
  try {
    return (
      exactAmount(left, leftCurrency) === exactAmount(right, rightCurrency)
    );
  } catch {
    return left === right;
  }
}
export type ApprovedInvoice = {
  detail: { currency_code: string; reference: string };
  primary_recipients: { billing_info: { email_address: string } }[];
  items: {
    name: string;
    quantity: string;
    unit_amount: { currency_code: string; value: string };
  }[];
};
export function assertInvoiceMatches(
  invoice: unknown,
  request: ApprovedInvoice,
  providerId: string,
) {
  const actual = invoice as {
    id?: string;
    detail?: { reference?: string };
    amount?: { currency_code?: string; value?: string };
    primary_recipients?: { billing_info?: { email_address?: string } }[];
  };
  const currency = request.detail.currency_code;
  if (
    actual?.id !== providerId ||
    actual.detail?.reference !== request.detail.reference ||
    actual.amount?.currency_code !== currency ||
    typeof actual.amount.value !== "string" ||
    exactAmount(actual.amount.value, currency) !==
      exactAmount(request.items[0].unit_amount.value, currency) ||
    actual.primary_recipients?.length !== 1 ||
    actual.primary_recipients[0].billing_info?.email_address?.toLowerCase() !==
      request.primary_recipients[0].billing_info.email_address.toLowerCase()
  )
    throw new InputError(
      "Provider invoice differs from the immutable approval.",
      409,
      "PAYPAL_CORRELATION_MISMATCH",
    );
}
export function boundRequest<Request = ApprovedInvoice>(requestJson: string, expectedHash: string) {
  const bound = JSON.parse(requestJson);
  if (digest(JSON.stringify(bound.request)) !== expectedHash)
    throw new InputError("Approved provider request changed.", 403);
  return bound as {
    request: Request;
    recipient: string;
    proposalHash: string;
    approvedBy: string;
  };
}

export function supportedBillingIntent(extraction: {
  category?: string;
  direction?: string;
  evidence?: { quote: string }[];
}) {
  return (
    extraction.category === "payment_request" &&
    extraction.direction === "receivable" &&
    !!extraction.evidence?.some(e =>
      /\b(?:please (?:invoice|bill) (?:me|us)|(?:send|issue|create) (?:me |us )?(?:an? |the )?invoice|request(?:ing)? (?:an? )?invoice)\b/i.test(
        e.quote,
      ),
    )
  );
}
/** Current quoted evidence, never retrieved memory, must support the proposed value. */
export function billingEvidenceWarnings(
  extraction: {
    amount: string | null;
    currency: string | null;
    reference: string | null;
    evidence: { sourceId: string; quote: string }[];
  },
  sources: Record<string, string>,
) {
  const warnings: string[] = [];
  const quotes = extraction.evidence
    .filter(e => e.quote.trim() && sources[e.sourceId]?.includes(e.quote))
    .map(e => e.quote);
  let amount = "";
  try { amount = exactAmount(extraction.amount || "", extraction.currency || ""); } catch { /* Invalid amounts require review. */ }
  const supportedValue = !!amount && quotes.some(quote => {
    // Explicit ISO currency and adjacent decimal amount only; no inferred symbols,
    // rounded values, partial numeric matches or facts supplied solely by memory.
    const values = quote.matchAll(
      /\b([A-Z]{3})\s+(\d+(?:\.\d+)?)(?!\w|[.,]\d)|(?<![\w.])(?<!\d,)(\d+(?:\.\d+)?)\s+([A-Z]{3})\b/g,
    );
    return [...values].some(match =>
      sameFinancialValue(
        match[2] || match[3],
        match[1] || match[4],
        amount,
        extraction.currency || "",
      ),
    );
  });
  if (!supportedValue)
    warnings.push(
      "Current quoted evidence does not support the exact amount and currency; retrieved context cannot supply financial authority.",
    );
  if (!extraction.reference?.trim())
    warnings.push("A stable obligation reference is required before approval.");
  else if (!quotes.some(quote => quotesObligationReference(quote, extraction.reference!)))
    warnings.push(
      "Current quoted evidence does not support the proposed obligation reference.",
    );
  const references = new Set<string>();
  for (const source of Object.values(sources)) {
    for (const match of source.matchAll(
      /\b(?:invoice|bill)\s+(?:(?:no\.?|number|#)\s*)?([a-z0-9][a-z0-9_/-]*\d[a-z0-9_/-]*)\b/gi,
    ))
      references.add(match[1].toLowerCase());
  }
  if (references.size > 1)
    warnings.push(
      "Multiple invoice obligations occur in current sources; review them separately instead of approving a flattened extraction.",
    );
  return warnings;
}
export function quotesObligationReference(quote: string, reference: string) {
  const literal = reference.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return !!literal && new RegExp(
    `(?<![\\p{L}\\p{N}_/-])${literal}(?![\\p{L}\\p{N}_/-])`,
    "iu",
  ).test(quote);
}
const settlementRank: Record<string, number> = {
  draft_created: 0,
  scheduled: 1,
  invoice_sent: 2,
  unpaid: 2,
  payment_pending: 3,
  partially_paid: 4,
  externally_marked_paid: 4,
  paid: 5,
  partially_refunded: 6,
  refunded: 7,
  cancelled: 5,
};
export function reconciliationState(current: string, incoming: string) {
  if (current === incoming) return current;
  if (
    current === "paid" &&
    !["partially_refunded", "refunded"].includes(incoming)
  )
    return current;
  if (["refunded", "cancelled"].includes(current)) return current;
  return (settlementRank[incoming] ?? -1) >= (settlementRank[current] ?? -1)
    ? incoming
    : current;
}
