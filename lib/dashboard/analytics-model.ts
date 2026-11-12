import { z } from "zod";
import type { CashFlowSummary } from "./overview-summary";
export const analyticsColumns = [
  "counterparty",
  "status",
  "currency",
  "amount",
  "updatedAt",
] as const;
export const workflowReviewStatuses = [
  "pending_approval",
  "needs_review",
  "duplicate_review",
  "reconciliation_required",
  "send_reconciliation_required",
  "payout_reconciliation_required",
];

export type AnalyticsRow = {
  id: string;
  counterparty: string;
  status: string;
  currency: string;
  amount: string;
  updatedAt: string;
};
const date = z
  .string()
  .refine(
    value =>
      !value ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
        Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
        new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value),
    "Use a valid YYYY-MM-DD date.",
  );
export const analyticsViewSchema = z
  .strictObject({
    columns: z
      .array(z.enum(analyticsColumns))
      .min(1)
      .max(5)
      .refine(
        values => new Set(values).size === values.length,
        "Duplicate columns are not allowed.",
      ),
    counterparty: z.string().max(200),
    status: z.string().max(80),
    currency: z.string().regex(/^$|^[A-Z]{3}$/),
    from: date,
    to: date,
    sort: z.enum(analyticsColumns),
    direction: z.enum(["asc", "desc"]),
  })
  .refine(
    view => !view.from || !view.to || view.from <= view.to,
    "Start date must precede end date.",
  )
  .refine(
    view => view.columns.includes(view.sort),
    "The sort column must be visible.",
  );
export type AnalyticsView = z.infer<typeof analyticsViewSchema>;
export const defaultAnalyticsView: AnalyticsView = {
  columns: [...analyticsColumns],
  counterparty: "",
  status: "",
  currency: "",
  from: "",
  to: "",
  sort: "updatedAt",
  direction: "desc",
};
export type AnalyticsData = {
  items: AnalyticsRow[];
  summary: CashFlowSummary;
  partial: boolean;
  scanned: number;
  environment: "sandbox" | "live";
  aiAvailable: boolean;
};
/** Defense in depth: discard unexpected tenant rows and never expose proposals, email bodies or approval authority. */
export function analyticsRows(
  rows: Record<string, unknown>[],
  workspaceId: string,
): AnalyticsRow[] {
  return rows
    .filter(row => row.workspaceId === workspaceId)
    .map(row => ({
      id: String(row.$id),
      counterparty: String(row.counterparty || ""),
      status: String(row.status || ""),
      currency: String(row.currency || ""),
      amount: String(row.amount || ""),
      updatedAt: String(row.$updatedAt || ""),
    }));
}
export function filterAnalyticsRows(rows: AnalyticsRow[], view: AnalyticsView) {
  return rows.filter(
    row =>
      (!view.counterparty ||
        row.counterparty
          .toLowerCase()
          .includes(view.counterparty.toLowerCase())) &&
      (!view.status || row.status === view.status) &&
      (!view.currency || row.currency === view.currency) &&
      (!view.from || row.updatedAt.slice(0, 10) >= view.from) &&
      (!view.to || row.updatedAt.slice(0, 10) <= view.to),
  );
}
/** RFC 4180 quoting plus spreadsheet-formula protection, including leading control/space characters. */
export function analyticsCsv(
  rows: AnalyticsRow[],
  columns: readonly (typeof analyticsColumns)[number][],
) {
  const cell = (value: string) =>
    '"' +
    (/^[\s\u0000-\u001f]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value)
      ? "'" + value
      : value
    ).replaceAll('"', '""') +
    '"';
  return [
    columns.map(cell).join(","),
    ...rows.map(row => columns.map(column => cell(row[column])).join(",")),
  ].join("\r\n");
}

/** Exact positive decimal comparison; never coerce monetary strings to floating point. */
export function compareAnalyticsAmounts(left: string, right: string) {
  if (!/^\d+(?:\.\d+)?$/.test(left) || !/^\d+(?:\.\d+)?$/.test(right))
    return left.localeCompare(right);
  const [lw, lf = ""] = left.split("."),
    [rw, rf = ""] = right.split(".");
  const wholeLeft = lw.replace(/^0+(?=\d)/, ""),
    wholeRight = rw.replace(/^0+(?=\d)/, "");
  return (
    wholeLeft.length - wholeRight.length ||
    wholeLeft.localeCompare(wholeRight) ||
    lf
      .padEnd(Math.max(lf.length, rf.length), "0")
      .localeCompare(rf.padEnd(Math.max(lf.length, rf.length), "0"))
  );
}
