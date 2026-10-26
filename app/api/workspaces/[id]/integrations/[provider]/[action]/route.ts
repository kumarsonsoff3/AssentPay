import { tasks } from "@trigger.dev/sdk";
import {
  apiUser,
  workspaceAccess,
  workspaceStore,
} from "@/lib/workspaces/server";
import { apiError, inputBody, json, rateLimit } from "@/lib/workspaces/http";
import { InputError, text } from "@/lib/workspaces/validation";
import { isProvider } from "@/lib/workspaces/types";
import { withStorageOperation } from "@/lib/data/coordinator";
import { beginOAuth } from "@/lib/integrations/server";
import { invokeIntegrationFunction } from "@/lib/integrations/function-client";
export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string; provider: string; action: string }>;
  },
) {
  try {
    const { id, provider, action } = await context.params,
      input = await inputBody(request),
      user = await apiUser();
    if (
      !isProvider(provider) ||
      !["connect", "disconnect", "check"].includes(action)
    )
      throw new InputError("Not found.", 404);
    await workspaceAccess(
      id,
      user.$id,
      provider === "paypal" ? ["owner"] : ["owner", "admin"],
    );
    rateLimit(`integration:${action}`, user.$id, 20);
    return await withStorageOperation("mutation", async (op) => {
      const store = workspaceStore(user.$id);
      if (action === "disconnect") {
        await store.disconnect(id, provider);
        return json({
          message:
            "Connection removed from this workspace. You can also revoke app access in your provider’s account settings.",
        });
      }
      if (action === "check") {
        if (!process.env.TRIGGER_SECRET_KEY || !process.env.TRIGGER_PROJECT_REF)
          throw new InputError(
            "Configure Trigger.dev and start its development worker before checking connections.",
            503,
          );
        const current = await store.integration(id, provider);
        if (!current || current.disconnected)
          throw new InputError("Connect this account first.");
        await op.check();
        const run = await tasks.trigger(
          "check-workspace-connection",
          {
            workspaceId: id,
            provider,
            version: current.record.version,
            storageEpoch: op.state.epoch,
            requestedBy: user.$id,
          },
          {
            idempotencyKey: `health:${op.state.epoch}:${id}:${provider}:${current.record.version}:${Math.floor(Date.now() / 60000)}`,
          },
        );
        return json(
          {
            message:
              "Connection check queued. Refresh this page shortly to see the result.",
            runId: run.id,
          },
          202,
        );
      }
      if (provider !== "paypal")
        return json({ redirect: await beginOAuth(id, user.$id, provider) });
      const clientId = text(input, "clientId", 1024),
        clientSecret = text(input, "clientSecret", 1024),
        merchantLabel = text(input, "merchantLabel", 128);
      if (
        !clientId ||
        clientId.includes(":") ||
        /\s/.test(clientId) ||
        !clientSecret ||
        /\s/.test(clientSecret)
      )
        throw new InputError(
          "Enter valid PayPal sandbox REST app credentials.",
        );
      await op.check();
      await invokeIntegrationFunction({
        action: "paypal-connect",
        workspaceId: id,
        requestedBy: user.$id,
        clientId,
        clientSecret,
        merchantLabel,
      });
      return json({
        message: "PayPal sandbox app credentials verified and connected.",
      });
    });
  } catch (error) {
    return apiError(error);
  }
}
