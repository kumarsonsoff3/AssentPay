import {
  withStorageOperation,
  StorageMaintenanceError,
} from "@/lib/data/coordinator";
import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";
import { apiUser } from "@/lib/workspaces/server";
import { completeOAuth } from "@/lib/integrations/server";
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  let destination = "/workspaces?connection=failed";
  try {
    if (provider !== "gmail" && provider !== "slack") throw new Error();
    const user = await apiUser();
    await withStorageOperation("oauth_callback", async () => {
      const result = await completeOAuth(
        request.nextUrl.searchParams.get("state") || "",
        provider,
        user.$id,
        request.nextUrl.searchParams.get("code"),
        request.nextUrl.searchParams.has("error"),
      );
      destination = `/workspaces/${result.workspaceId}/setup?connection=${result.result}`;
    });
  } catch (error) {
    if (error instanceof StorageMaintenanceError)
      destination = "/workspaces?connection=maintenance";
    /* Provider messages and codes may contain credentials. Never expose them. */
  }
  const response = NextResponse.redirect(
    new URL(destination, authConfig().origin),
    303,
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
