import { createHash } from "node:crypto";
/** Stable application credential identity, NOT a merchant/account identity or eligibility proof. */
export const paypalApplicationIdentity = (clientId: string) =>
  "sandbox-oauth-client:" + createHash("sha256").update(clientId).digest("hex");
