import { task } from "@trigger.dev/sdk";
import { invokeIntegrationFunction } from "../../lib/integrations/function-client";
import type { ConnectionCheck } from "../../lib/integrations/health";
export const checkConnection = task({
  id: "check-workspace-connection",
  queue: { concurrencyLimit: 1 },
  maxDuration: 120,
  // Only IDs/epoch cross the queue. Stored credentials are consumed exclusively
  // inside the private Appwrite Function, never in a Trigger worker.
  run: async (payload: ConnectionCheck) =>
    invokeIntegrationFunction({ ...payload, action: "check" }),
});
