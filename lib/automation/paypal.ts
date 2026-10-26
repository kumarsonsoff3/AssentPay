import { paypalToken } from "./paypal-client";
import { Query } from "node-appwrite";
import { dataDatabase, dataClient, databaseId } from "../data/client";
import { RuntimeStore } from "../data/runtime";
import { withStorageOperation } from "../data/coordinator";
import { workerAuthorization } from "../integrations/health";
import { openCredentials } from "../integrations/credentials";
import { InputError, validId } from "../workspaces/validation";
import { params, receiveEvent } from "./store";
export async function acceptPaypalEvent(input: Record<string, unknown>) {
  const workspaceId = validId(String(input.workspaceId));
  const webhookIds: Record<string, string> = JSON.parse(
    process.env.PAYPAL_WEBHOOK_IDS_JSON || "{}",
  );
  const webhookId = webhookIds[workspaceId];
  if (!webhookId)
    throw new InputError(
      "PayPal webhook is not configured for this workspace.",
      503,
    );
  const page = await dataDatabase().listRows({
    ...params("integrations"),
    queries: [
      Query.equal("workspaceId", workspaceId),
      Query.equal("provider", "paypal"),
      Query.isNull("disconnectedAt"),
      Query.limit(1),
    ],
  });
  const meta = page.rows[0];
  if (!meta) throw new InputError("Connection unavailable.", 404);
  const authorize = workerAuthorization(dataClient(), meta.connectedBy),
    store = new RuntimeStore(
      dataDatabase(),
      databaseId(),
      meta.connectedBy,
      authorize,
    ),
    found = await store.execution(workspaceId, "paypal");
  if (!found) throw new InputError("Connection unavailable.", 404);
  const credentials = openCredentials(
      workspaceId,
      "paypal",
      found.record.credentials,
    ),
    headers = input.headers as Record<string, string>,
    event = input.event as Record<string, unknown>;
  if (
    !event ||
    typeof event.id !== "string" ||
    typeof event.event_type !== "string" ||
    !headers
  )
    throw new InputError("Invalid PayPal event.");
  const base =
    process.env.ASSENTPAY_SIMULATION === "true" &&
    process.env.NODE_ENV !== "production" &&
    !process.env.APPWRITE_FUNCTION_ID &&
    process.env.SIMULATION_PAYPAL_URL
      ? process.env.SIMULATION_PAYPAL_URL
      : "https://api-m.sandbox.paypal.com";
  const accessToken = await paypalToken(credentials.clientId!, credentials.clientSecret!);
  const response = await fetch(
    `${base}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...headers,
        webhook_id: webhookId,
        webhook_event: event,
      }),
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    },
  );
  if (!response.ok)
    throw new InputError(
      "PayPal verification is temporarily unavailable.",
      503,
    );
  const result = (await response.json()) as { verification_status: string };
  if (result.verification_status !== "SUCCESS")
    throw new InputError("Invalid PayPal signature.", 401);
  return withStorageOperation("mutation", async () => {
    // Recheck the connection generation at the receipt/job commit boundary.
    const latest = await store.integration(workspaceId, "paypal");
    if (
      !latest ||
      latest.disconnected ||
      latest.record.version !== meta.connectionVersion
    )
      throw new InputError("Connection changed.", 409);
    const accepted = await receiveEvent({
      workspaceId,
      integrationId: meta.$id,
      connectionVersion: meta.connectionVersion,
      requestedBy: meta.connectedBy,
      provider: "paypal",
      eventId: event.id as string,
      eventType: event.event_type as string,
      payload: { resourceId: (event.resource as { invoice?: { id?: string }; id?: string })?.invoice?.id || (event.resource as { id?: string })?.id || "" },
    });
    return { status: "accepted", ...accepted };
  });
}
