import { z } from "zod";

export const agreementAmountSchema = z.object({
  role: z.enum(["invoice_total", "contract_total", "paid", "outstanding", "installment", "deposit", "fee", "other"]),
  amount: z.string().regex(/^\d{1,12}(?:\.\d{1,3})?$/),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  label: z.string().max(180),
  sourceId: z.string().max(128),
  quote: z.string().min(1).max(1000),
}).strict();

type AgreementAmount = z.infer<typeof agreementAmountSchema>;

export function requiresAmountReview(category: string, amounts: AgreementAmount[]) {
  return category === "receipt" || category === "payment_confirmation" || amounts.length > 1 ||
    amounts.some(({ role }) => ["paid", "contract_total", "installment", "deposit", "fee"].includes(role));
}

export const amountRoleLabel = {
  invoice_total: "Invoice total",
  contract_total: "Contract total",
  paid: "Reported paid",
  outstanding: "Reported outstanding",
  installment: "Installment",
  deposit: "Deposit",
  fee: "Fee",
  other: "Other amount",
} satisfies Record<z.infer<typeof agreementAmountSchema>["role"], string>;

export function quotedAmounts(quote: string) {
  return [...quote.matchAll(/(?<![\d.,])\d+(?:(?:,\d{2})*,\d{3}|(?:,\d{3})+)?(?:\.\d+)?(?!\d|[.,]\d)/g)]
    .map(match => {
      const [whole, fraction = ""] = match[0].replaceAll(",", "").split(".");
      const decimals = fraction.replace(/0+$/, "");
      return String(BigInt(whole)) + (decimals ? "." + decimals : "");
    });
}

export function verifiedAgreementAmounts(
  amounts: AgreementAmount[],
  sources: Record<string, string>,
) {
  return amounts.filter(({ sourceId, quote, amount }) =>
    sources[sourceId]?.includes(quote) && quotedAmounts(quote).includes(quotedAmounts(amount)[0]),
  );
}
