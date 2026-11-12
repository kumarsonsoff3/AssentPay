import { z } from "zod";
import { exactAmount } from "./financial-safety";
import { InputError } from "../workspaces/validation";

const termsSchema = z.object({
  action: z.enum(["create_draft_invoice", "pay_supplier"]),
  amount: z.string().trim(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  reference: z.string().trim().min(1).max(120),
  purpose: z.string().trim().min(1).max(200),
  confirmedOutstanding: z.literal(true),
});

export function reviewedTerms(value: unknown) {
  const parsed = termsSchema.safeParse(value);
  if (!parsed.success) throw new InputError("Confirm the open obligation, amount, currency, reference and description.");
  const terms = parsed.data;
  return { ...terms, amount: exactAmount(terms.amount, terms.currency) };
}

export type ReviewedTerms = ReturnType<typeof reviewedTerms>;
