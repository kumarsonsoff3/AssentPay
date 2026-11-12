const decimal = /^(?:\d{1,12})(?:\.\d{1,3})?$/;
const printedAmount = String.raw`(?:\d{1,2}(?:,\d{2})+,\d{3}|\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,3})?`;
const rupeeLabel = String.raw`(?:₹|\bINR\b|\bIndian rupees?\b|\bRs\.?)`;
const foreignRupee = /\b(?:PKR|NPR|LKR|MUR|SCR|Pakistani rupees?|Nepalese rupees?|Sri Lankan rupees?|Mauritian rupees?|Seychellois rupees?)\b/i;

export function rupeeEvidence(
  amount: unknown,
  quotes: readonly string[],
  sources: readonly string[],
  indiaWorkspace: boolean,
): "explicit" | "workspace" | "ambiguous" | null {
  if (typeof amount !== "string" || !decimal.test(amount)) return null;
  const canonical = (value: string) => value.replaceAll(",", "")
    .replace(/^0+(?=\d)/, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  const target = canonical(amount);
  const values = new RegExp(
    String.raw`(?<![\w.,])(?:(${rupeeLabel})\s*(${printedAmount})(?!\w|[.,]\d)|(${printedAmount})\s*(${rupeeLabel})(?!\w))`,
    "gi",
  );
  let ambiguous = false;
  for (const quote of quotes) {
    for (const match of quote.matchAll(values)) {
      if (canonical(match[2] || match[3]) !== target) continue;
      if (!/^Rs\.?$/i.test(match[1] || match[4])) return "explicit";
      ambiguous = true;
    }
  }
  if (!ambiguous) return null;
  return indiaWorkspace && !sources.some(source => foreignRupee.test(source)) ? "workspace" : "ambiguous";
}
