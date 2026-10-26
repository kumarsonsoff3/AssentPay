import { z } from "zod";
const nullable = (max: number) => z.string().max(max).nullable();
export const extractionSchema = z.object({
  category: z.enum(["invoice", "quotation", "payment_request", "agreement", "receipt", "payment_confirmation", "financial_correspondence", "business", "irrelevant", "uncertain"]),
  direction: z.enum(["payable", "receivable", "unknown"]),
  counterparty: nullable(320), amount: z.string().regex(/^\d{1,12}(?:\.\d{1,3})?$/).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(), reference: nullable(120), dueDate: nullable(32), purpose: nullable(1000),
  paymentTerms: nullable(1000), evidence: z.array(z.object({ sourceId: z.string().max(128), quote: z.string().max(1000) }).strict()).max(12),
  lineItems: z.array(z.object({ description: z.string().max(500), amount: nullable(32) }).strict()).max(30),
  uncertainties: z.array(z.string().max(500)).max(20), confidence: z.number().min(0).max(1),
}).strict();
export type Extraction = z.infer<typeof extractionSchema>;
