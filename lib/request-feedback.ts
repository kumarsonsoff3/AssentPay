/** Keep browser/provider diagnostics out of customer-facing feedback. */
export function requestErrorMessage(error: unknown, fallback = "We couldn’t complete that request. Please try again.") {
  if (error instanceof TypeError) return "We couldn’t reach AssentPay. Check your connection, then try again.";
  if (error instanceof SyntaxError) return "The service returned an unexpected response. Please try again in a moment.";
  return error instanceof Error && error.message ? error.message : fallback;
}
