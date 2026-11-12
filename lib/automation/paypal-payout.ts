import { InputError } from "../workspaces/validation";
import { exactAmount } from "./financial-safety";
import { paypalBase } from "./paypal-client";

export const payoutsEnabled = () => process.env.PAYPAL_SANDBOX_PAYOUTS_ENABLED === "true";
export const payoutBatchId = (value: unknown): value is string => typeof value === "string" && /^[A-Z0-9]{1,30}$/.test(value);

export function supportsSupplierPayout(extraction: {
  category?: string;
  direction?: string;
  evidence?: { quote: string }[];
}) {
  return extraction.category === "invoice" && extraction.direction === "payable"
    && !!extraction.evidence?.some(e => /\b(invoice|bill)\b/i.test(e.quote));
}

export function payoutRequest(id: string, recipient: string, value: string, currency: string) {
  if (recipient.length > 127 || /[^\x21-\x7e]/.test(recipient)) {
    throw new InputError("Enter a PayPal supplier email of at most 127 ASCII characters.");
  }
  return {
    sender_batch_header: { sender_batch_id: id },
    items: [{ recipient_type: "EMAIL", receiver: recipient, amount: { value, currency }, sender_item_id: id }],
  };
}

export type PayoutRequest = ReturnType<typeof payoutRequest>;

export async function createPayout(token: string, request: PayoutRequest) {
  if (!payoutsEnabled()) throw new InputError("Sandbox supplier payouts are disabled.", 403);
  const result = await fetch(paypalBase + "/v1/payments/payouts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": request.sender_batch_header.sender_batch_id,
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  if (!result.ok) throw new Error("PayPal payout outcome needs review");
  const id = (await result.json()).batch_header?.payout_batch_id;
  if (!payoutBatchId(id)) throw new Error("PayPal payout batch ID unavailable");
  return id;
}

const states: Record<string, string> = {
  SUCCESS: "payout_paid",
  PENDING: "payout_pending",
  ONHOLD: "payout_on_hold",
  UNCLAIMED: "payout_unclaimed",
  FAILED: "payout_failed",
  BLOCKED: "payout_blocked",
  DENIED: "payout_failed",
  RETURNED: "payout_returned",
  REFUNDED: "payout_refunded",
  REVERSED: "payout_reversed",
};

export async function checkPayout(token: string, id: string, request: PayoutRequest) {
  if (!payoutBatchId(id)) throw new InputError("Enter the existing PayPal sandbox payout batch ID.");
  const result = await fetch(paypalBase + "/v1/payments/payouts/" + encodeURIComponent(id), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!result.ok) throw new InputError("PayPal payout verification is unavailable.", 503);
  const batch = await result.json();
  const header = batch.batch_header;
  if (header?.payout_batch_id !== id ||
      header.sender_batch_header?.sender_batch_id !== request.sender_batch_header.sender_batch_id) {
    throw new InputError("PayPal payout does not match the original approval.", 409);
  }
  if (!batch.items?.length && ["PENDING", "PROCESSING"].includes(header.batch_status)) return "payout_pending";
  if (!batch.items?.length && header.batch_status === "DENIED") return "payout_failed";
  const actual = batch.items?.[0], item = actual?.payout_item, expected = request.items[0];
  if (batch.items?.length !== 1 || (batch.total_items !== undefined && batch.total_items !== 1) ||
      item?.sender_item_id !== expected.sender_item_id || item.recipient_type !== expected.recipient_type ||
      item.receiver?.toLowerCase() !== expected.receiver.toLowerCase() || item.amount?.currency !== expected.amount.currency ||
      exactAmount(item.amount.value, item.amount.currency) !== expected.amount.value) {
    throw new InputError("PayPal payout does not match the original approval.", 409);
  }
  const status = states[actual.transaction_status];
  if (!status) throw new InputError("PayPal payout status requires manual review.", 409);
  return status;
}
