type Endpoint = { status: string; errorCode: string };
type Processing = { status: string; errorCode: string } | null;

/** Receiving health is independent of an individual message's import outcome. */
export function inboxDeliveryStatus(endpoint: Endpoint, processing: Processing, hasConfirmation: boolean) {
  if (endpoint.status === "disabled") return "disabled";
  if (["RESEND_RECEIVING_ACCESS_DENIED", "RESEND_NOT_CONFIGURED"].includes(endpoint.errorCode)) return "connection_error";
  // A delivery challenge stays proven while subsequent messages are queued,
  // retried, or rejected. Individual import errors remain in `processing`.
  if (endpoint.status === "receiving") return "receiving";
  if (!hasConfirmation && processing && ["queued", "running", "retry"].includes(processing.status)) return "processing";
  return endpoint.status;
}
