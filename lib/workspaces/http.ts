import "server-only";
import { readJsonBody } from "@/lib/auth/request";
import { assertAppOrigin } from "@/lib/auth/origin";
import { NextResponse } from "next/server";
import { AppwriteException } from "node-appwrite";
import { AuthConfigurationError, authConfig } from "@/lib/auth/config";
import { allowAuthRequest } from "@/lib/auth/rate-limit";
import { InputError } from "./validation";
import { isTransactionConflict } from "@/lib/errors";
import {
  CleanupBusyError,
  StorageMaintenanceError,
  RevisionConflictError,
} from "@/lib/data/coordinator";
export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
export async function inputBody(request: Request) {
  assertAppOrigin(request, authConfig().origin);
  return readJsonBody(request, 16384);
}
export function rateLimit(action: string, userId: string, limit = 30) {
  if (!allowAuthRequest(`workspace:${action}`, userId, limit))
    throw new InputError(
      "Too many requests. Please try again in 15 minutes.",
      429,
    );
}
export function apiError(error: unknown) {
  if (isTransactionConflict(error))
    return json({ error: "Another workspace update was in progress. Please try again.", code: "TRANSACTION_CONFLICT" }, 409);
  if (error instanceof CleanupBusyError) return json({ error: error.message, code: "CLEANUP_BUSY" }, 409);
  if (error instanceof StorageMaintenanceError) {
    const response = json({ error: error.message, code: error.code }, 503);
    response.headers.set("Retry-After", "30");
    return response;
  }
  if (error instanceof RevisionConflictError)
    return json({ error: error.message, code: "REVISION_CONFLICT" }, 409);
  if (error instanceof InputError)
    return json(
      {
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
        ...(error.redirect ? { redirect: error.redirect } : {}),
      },
      error.status,
    );
  if (error instanceof AppwriteException) {
    if (error.code === 429)
      return json(
        { error: "Too many requests. Please wait a moment, then try again." },
        429,
      );
    if (error.type === "team_invite_already_exists")
      return json({ error: "This person already belongs to the workspace or has a pending invitation." }, 409);
    if (error.code === 409)
      return json({ error: "This update conflicts with an existing record. Refresh and try again." }, 409);
    if (error.code === 401)
      return json({ error: "Your session expired. Sign in again." }, 401);
    if (error.code === 403)
      return json(
        {
          error:
            "This action isn’t available with your current access. Ask your workspace owner for help.",
        },
        403,
      );
  }
  if (error instanceof AuthConfigurationError)
    return json({ error: error.message }, 503);
  return json(
    { error: "The service could not complete this request. Please try again." },
    503,
  );
}
