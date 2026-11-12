import { InputError } from "./validation";
export function assertDeletionConsent(input: Record<string, unknown>, registeredEmail: string, workspaceName?: string) {
  if (input.consent !== true) throw new InputError("Confirm that you understand this deletion is permanent.");
  if (typeof input.confirmationEmail !== "string" || input.confirmationEmail.trim().toLowerCase() !== registeredEmail.toLowerCase()) throw new InputError("Type your registered email address to confirm deletion.");
  if (workspaceName !== undefined && input.confirmationName !== workspaceName) throw new InputError("Type the organization name exactly to confirm deletion.");
}
export function assertNoOwnedOrganizations(memberships: { roles: string[] }[]) {
  if (memberships.some((membership) => membership.roles.includes("owner"))) throw new InputError("Delete your owned organizations before deleting your account. Each organization needs its own confirmation.", 409);
}
