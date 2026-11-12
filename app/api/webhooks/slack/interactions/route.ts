import { after } from "next/server";
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
export const maxDuration = 60;

const ephemeral = (text: string) => ({ response_type: "ephemeral", text, replace_original: false });
export async function POST(request: Request) {
  try {
    const raw = await readWebhookText(request);
    verifySlack(
      raw,
      request.headers.get("x-slack-request-timestamp"),
      request.headers.get("x-slack-signature"),
    );
    const input = parseReviewInteraction(raw);
    if ("openLink" in input) return new Response(null, { status: 200 });
    if ("token" in input) {
      const decide = () => withStorageOperation("mutation", () => handleSlackToken(input));
      const responseUrl = input.responseUrl;
      if (!responseUrl) return json(ephemeral(await decide()));

      after(async () => {
        let message: string;
        try {
          message = await decide();
        } catch (error) {
          message = error instanceof InputError ? error.message : "Could not confirm this decision. Check the proposal in AssentPay.";
        }
        try {
          await fetch(responseUrl, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ephemeral(message)), redirect: "error", signal: AbortSignal.timeout(5000),
          });
        } catch { /* The workspace retains the decision even if Slack feedback is unavailable. */ }
      });
      return new Response(null, { status: 200 });
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
