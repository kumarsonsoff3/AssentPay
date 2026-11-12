import type { Column, Table } from "../data/schema";
const v = (key: string, size = 128): Column => ({ key, type: "varchar", size, required: true });
const text = (key: string): Column => ({ key, type: "mediumtext", encrypt: true, required: true });
const date = (key: string): Column => ({ key, type: "datetime", required: true });
const integer = (key: string): Column => ({ key, type: "integer", required: true });
const idx = (key: string, columns: string[], unique = false) => ({ key, columns, type: unique ? "unique" as const : "key" as const });
const scoped = [v("workspaceId", 36)];
export const financialMigrationId = "005_forwarding_financial";
export const financialTables: Table[] = [
  { id: "inbound_endpoints", columns: [...scoped, v("slot", 36), v("address", 320), v("version", 32), v("createdBy", 36), v("status", 40), v("testToken", 32), date("testStartedAt"), date("lastReceivedAt"), v("errorCode", 64)], indexes: [idx("address_unique", ["address"], true), idx("workspace_slot", ["workspaceId", "slot"], true)] },
  { id: "forwarding_verifications", columns: [...scoped, v("endpointId", 36), v("version", 32), date("expiresAt"), text("confirmationJson")], indexes: [idx("workspace_expiry", ["workspaceId", "expiresAt"])] },
  { id: "ingress_limits", columns: [...scoped, integer("count"), date("expiresAt")], indexes: [] },
  { id: "notification_deliveries", columns: [...scoped, v("workflowId", 36), v("channel", 16), v("status", 24), v("providerId", 128), date("attemptedAt")], indexes: [idx("provider_message", ["channel", "providerId"])] },
  { id: "message_analyses", columns: [...scoped, v("messageId", 36), v("category", 40), v("status", 32), text("resultJson")], indexes: [idx("workspace_message", ["workspaceId", "messageId"], true)] },
  { id: "financial_workflows", columns: [...scoped, v("messageId", 36), v("status", 40), v("action", 40), v("counterparty", 320), v("amount", 32), v("currency", 3), v("providerId", 128), v("fingerprint", 64), text("proposalJson")], indexes: [idx("workspace_status", ["workspaceId", "status"]), idx("workspace_fingerprint", ["workspaceId", "fingerprint"]), idx("workspace_provider", ["workspaceId", "providerId"])] },
  { id: "approval_decisions", columns: [...scoped, v("workflowId", 36), v("actorId", 36), v("decision", 16), v("proposalHash", 64), date("decidedAt")], indexes: [idx("workflow_unique", ["workspaceId", "workflowId"], true)] },
  { id: "financial_actions", columns: [...scoped, v("workflowId", 36), v("connectionVersion", 32), v("requestId", 64), v("status", 32), v("providerId", 128), date("attemptedAt"), text("requestJson")], indexes: [idx("workflow_unique", ["workspaceId", "workflowId"], true)] },
  { id: "agent_memory", columns: [...scoped, v("sourceId", 36), v("status", 16), date("expiresAt"), text("factsJson")], indexes: [idx("workspace_status", ["workspaceId", "status"])] },
];
