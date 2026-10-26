import { Functions, ExecutionMethod } from "node-appwrite";
import { dataClient } from "../data/client";
import {
  StorageMaintenanceError,
  RevisionConflictError,
} from "../data/coordinator";
import { InputError, validId } from "../workspaces/validation";
import { object } from "../data/model";
export const integrationFunctionId = () =>
  process.env.APPWRITE_INTEGRATION_FUNCTION_ID || "assentpay-integrations";
export async function invokeIntegrationFunction(
  input: Record<string, unknown>,
) {
  const execution = await new Functions(dataClient()).createExecution({
    functionId: integrationFunctionId(),
    body: JSON.stringify(input),
    async: false,
    method: ExecutionMethod.POST,
  });
  let result: Record<string, unknown>;
  try {
    result = object(JSON.parse(execution.responseBody));
  } catch {
    throw new InputError("The integration service is unavailable.", 503);
  }
  if (execution.responseStatusCode !== 200) {
    if (result.code === "STORAGE_MAINTENANCE")
      throw new StorageMaintenanceError();
    if (result.code === "REVISION_CONFLICT") throw new RevisionConflictError();
    const status = [400, 401, 403, 409, 429, 502, 503].includes(
      execution.responseStatusCode,
    )
      ? execution.responseStatusCode
      : 503;
    throw new InputError(
      status === 403
        ? "Your current account or workspace role cannot perform this operation."
        : "The integration operation could not complete. Check permissions and try again.",
      status,
    );
  }
  // Allowlist results: never pass arbitrary execution output into HTTP responses.
  if (input.action === "automation-dispatch" && result.status === "dispatched")
    return { status: "dispatched", processed: Number(result.processed) || 0 };
  if (input.action === "paypal-webhook" && result.status === "accepted")
    return { status: "accepted", duplicate: result.duplicate === true };
  if (
    input.action === "oauth-begin" &&
    typeof result.codeChallenge === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(result.codeChallenge)
  )
    return { codeChallenge: result.codeChallenge };
  if (
    input.action === "oauth-complete" &&
    typeof result.workspaceId === "string" &&
    ["success", "cancelled"].includes(String(result.result))
  )
    return {
      workspaceId: validId(result.workspaceId),
      result: String(result.result),
    };
  if (
    input.action === "status" &&
    result.protocol === "storage-v1" &&
    result.credentialRuntime === "appwrite-function"
  )
    return {
      protocol: "storage-v1",
      storage: String(result.storage),
      mode: String(result.mode),
      credentialRuntime: "appwrite-function",
    };
  if (
    ["check", "paypal-connect"].includes(String(input.action)) &&
    [
      "connected",
      "needs_attention",
      "superseded",
      "access_removed",
      "storage_paused",
    ].includes(String(result.status))
  )
    return { status: String(result.status) };
  throw new InputError(
    "The integration service returned an invalid result.",
    503,
  );
}
