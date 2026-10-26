import { Query } from "node-appwrite";
import { readJsonBody } from "@/lib/auth/request";
import { verifyGooglePush } from "@/lib/automation/webhook-auth";
import { dataDatabase } from "@/lib/data/client";
import { withStorageOperation } from "@/lib/data/coordinator";
import { params, receiveEvent } from "@/lib/automation/store";
import { InputError } from "@/lib/workspaces/validation";
import { apiError, json } from "@/lib/workspaces/http";
export async function POST(request: Request) {
  try {
    await verifyGooglePush(request);
    const body = await readJsonBody(request, 16384),
      message = body.message as { messageId?: string; data?: string };
    if (
      body.subscription !== process.env.GMAIL_PUSH_SUBSCRIPTION ||
      !message ||
      typeof message.messageId !== "string" ||
      message.messageId.length > 255 ||
      typeof message.data !== "string"
    )
      throw new InputError("Invalid Gmail notification.");
    let event: { emailAddress?: string; historyId?: string };
    try {
      event = JSON.parse(Buffer.from(message.data, "base64").toString("utf8"));
    } catch {
      throw new InputError("Invalid Gmail notification.");
    }
    if (
      !event.emailAddress ||
      !event.historyId ||
      !/^\d+$/.test(event.historyId)
    )
      throw new InputError("Invalid Gmail notification.");
    const page = await dataDatabase().listRows({
      ...params("integrations"),
      queries: [
        Query.equal("provider", "gmail"),
        Query.equal("externalId", event.emailAddress),
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
          provider: "gmail",
          eventId: message.messageId!,
          eventType: "mailbox.changed",
          payload: { historyId: event.historyId },
          gmail: true,
        });
    });
    return json({ accepted: true });
  } catch (e) {
    return apiError(e);
  }
}
