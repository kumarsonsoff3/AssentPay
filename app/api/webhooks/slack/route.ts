import { Query } from "node-appwrite";
import { verifySlack, readWebhookText } from "@/lib/automation/webhook-auth";
import { dataDatabase } from "@/lib/data/client";
import { withStorageOperation } from "@/lib/data/coordinator";
import { params, receiveEvent } from "@/lib/automation/store";
import { InputError } from "@/lib/workspaces/validation";
import { apiError, json } from "@/lib/workspaces/http";
export async function POST(request: Request) {
  try {
    const raw = await readWebhookText(request);
    verifySlack(
      raw,
      request.headers.get("x-slack-request-timestamp"),
      request.headers.get("x-slack-signature"),
    );
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new InputError("Invalid Slack event.");
    }
    if (body.type === "url_verification" && typeof body.challenge === "string")
      return json({ challenge: body.challenge });
    if (
      body.type !== "event_callback" ||
      typeof body.event_id !== "string" ||
      typeof body.team_id !== "string" ||
      !body.event ||
      typeof body.event !== "object"
    )
      throw new InputError("Invalid Slack event.");
    const event = body.event as Record<string, unknown>;
    const page = await dataDatabase().listRows({
      ...params("integrations"),
      queries: [
        Query.equal("provider", "slack"),
        Query.equal("externalId", body.team_id),
        Query.isNull("disconnectedAt"),
        Query.limit(100),
      ],
    });
    await withStorageOperation("mutation", async () => {
      for (const meta of page.rows)
        await receiveEvent({
          workspaceId: meta.workspaceId,
          integrationId: meta.$id,
          connectionVersion: meta.connectionVersion,
          requestedBy: meta.connectedBy,
          provider: "slack",
          eventId: String(body.event_id),
          eventType: String(event.type || "unknown"),
          payload: { type: event.type },
        });
    });
    return json({ accepted: true });
  } catch (e) {
    return apiError(e);
  }
}
