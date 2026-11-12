export class AuthConfigurationError extends Error {}

export function isTransactionConflict(error: unknown): boolean {
  return !!error && typeof error === "object" &&
    "code" in error && error.code === 409 &&
    "type" in error && error.type === "transaction_conflict";
}
