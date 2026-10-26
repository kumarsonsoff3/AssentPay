import { schedules, task } from "@trigger.dev/sdk";
import { invokeIntegrationFunction } from "../../lib/integrations/function-client";
// Appwrite's private minute schedule is the primary dispatcher. This task is an
// optional Trigger.dev failover; transactional leases make overlapping runs safe.
export const dispatchAutomationTask = task({
  id: "dispatch-workspace-automation",
  queue: { concurrencyLimit: 1 },
  maxDuration: 120,
  run: async () => invokeIntegrationFunction({ action: "automation-dispatch" }),
});
export const catchUpAutomation = schedules.task({
  id: "catch-up-workspace-automation",
  cron: "*/5 * * * *",
  maxDuration: 120,
  run: async () => invokeIntegrationFunction({ action: "automation-dispatch" }),
});
