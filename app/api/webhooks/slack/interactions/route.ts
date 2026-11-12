import { verifySlack, readWebhookText } from "@/lib/automation/webhook-auth";
import { parseReviewInteraction } from "@/lib/automation/slack-interactions";
import { optionalRow } from "@/lib/automation/store";
import { connectionId } from "@/lib/integrations/records";
import { dataClient } from "@/lib/data/client";
import { workerAuthorization } from "@/lib/integrations/health";
import { apiError, json } from "@/lib/workspaces/http";
import { proposalHash } from "@/lib/automation/intelligence";
import { InputError } from "@/lib/workspaces/validation";
import { withStorageOperation } from "@/lib/data/coordinator";
import { handleSlackToken } from "@/lib/automation/slack-approvals";
// No Slack API calls in ingress. Decision tokens require a separately verified
// owner identity and authenticated exact-recipient selection.
export async function POST(request: Request) {
  try {
    const raw = await readWebhookText(request);
    verifySlack(
      raw,
      request.headers.get("x-slack-request-timestamp"),
      request.headers.get("x-slack-signature"),
    );
    const input = parseReviewInteraction(raw);
    if ("token" in input) {
      const text = await withStorageOperation("mutation", () =>
        handleSlackToken(input),
      );
      return json({
        response_type: "ephemeral",
        text,
        replace_original: false,
      });
    }
    const meta = await optionalRow(
      "integrations",
      connectionId(input.workspaceId, "slack"),
    );
    if (
      !meta ||
      meta.workspaceId !== input.workspaceId ||
      meta.externalId !== input.teamId ||
      meta.connectionVersion !== input.connectionVersion ||
      meta.disconnectedAt ||
      meta.status !== "connected"
    )
      throw new InputError("Slack connection changed.", 403);
    await workerAuthorization(dataClient(), input.ownerId)(input.workspaceId, [
      "owner",
    ]);
    const workflow = await optionalRow("financial_workflows", input.workflowId);
    if (
      !workflow ||
      workflow.workspaceId !== input.workspaceId ||
      proposalHash(workflow.proposalJson) !== input.proposalHash
    )
      throw new InputError(
        "Review proposal changed. Open your dashboard.",
        409,
      );
    // Interactive buttons open the authenticated, exact-proposal review. No Slack
    // user-supplied identifier alone can authorize a financial decision.
    return json({
      response_type: "ephemeral",
      text: "Open secure review to verify the amount and recipient, or prepare a one-time Slack decision card.",
      replace_original: false,
    });
  } catch (error) {
    return apiError(error);
  }
}
