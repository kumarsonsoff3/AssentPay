import { exactAmount } from "../automation/financial-safety";

export type InvoiceTotals = {
  currency: string;
  collected: string;
  outstanding: string;
  drafts: string;
};
export type CashFlowSummary = {
  currencies: InvoiceTotals[];
  excluded: number;
  partial: boolean;
};
/** Invoice face values only. Never infer settlement from manual marks or uncertain writes. */
export function summarizeInvoices(
  rows: Record<string, unknown>[],
  partial = false,
): CashFlowSummary {
  const totals = new Map<
    string,
    { collected: bigint; outstanding: bigint; drafts: bigint }
  >();
  let excluded = 0;
  for (const row of rows) {
    if (!String(row.providerId || "").startsWith("INV2-")) continue;
    const bucket =
      row.status === "paid"
        ? "collected"
        : ["invoice_sent", "unpaid", "payment_pending"].includes(
              String(row.status),
            )
          ? "outstanding"
          : row.status === "draft_created"
            ? "drafts"
            : null;
    if (!bucket || !row.providerId) {
      excluded++;
      continue;
    }
    const currency = String(row.currency);
    try {
      const amount = exactAmount(String(row.amount), currency);
      const units = BigInt(amount.replace(".", ""));
      const current = totals.get(currency) || {
        collected: BigInt(0),
        outstanding: BigInt(0),
        drafts: BigInt(0),
      };
      current[bucket] += units;
      totals.set(currency, current);
    } catch {
      excluded++;
    }
  }
  return {
    currencies: [...totals]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, values]) => {
        const display = (value: bigint) =>
          ["JPY", "HUF", "TWD"].includes(currency)
            ? String(value)
            : `${value / BigInt(100)}.${String(value % BigInt(100)).padStart(2, "0")}`;
        return {
          currency,
          collected: display(values.collected),
          outstanding: display(values.outstanding),
          drafts: display(values.drafts),
        };
      }),
    excluded,
    partial,
  };
}
export type MemoryHighlight = {
  id: string;
  counterparty: string;
  reference: string;
  expiresAt: string;
};
/** Only active, unexpired context. User corrections replace original values, including blanks. */
export function memoryHighlight(
  row: Record<string, unknown>,
  workspaceId: string,
): MemoryHighlight | null {
  if (
    row.workspaceId !== workspaceId ||
    row.status !== "active" ||
    !(Date.parse(String(row.expiresAt)) > Date.now())
  )
    return null;
  try {
    const facts = JSON.parse(String(row.factsJson));
    const context = facts.userContext || facts;
    return {
      id: String(row.$id),
      counterparty: String(context.counterparty || "Workspace context"),
      reference: String(context.reference || ""),
      expiresAt: String(row.expiresAt),
    };
  } catch {
    return null;
  }
}
