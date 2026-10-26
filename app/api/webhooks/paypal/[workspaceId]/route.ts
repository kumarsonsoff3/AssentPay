import { readJsonBody } from "@/lib/auth/request";
import { invokeIntegrationFunction } from "@/lib/integrations/function-client";
import { apiError, json } from "@/lib/workspaces/http";
import { InputError, validId } from "@/lib/workspaces/validation";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const workspaceId = validId((await params).workspaceId),
      event = await readJsonBody(request, 48000),
      headers: Record<string, string> = {};
    for (const name of [
      "auth-algo",
      "cert-url",
      "transmission-id",
      "transmission-sig",
      "transmission-time",
    ]) {
      const value = request.headers.get(`paypal-${name}`);
      if (!value || value.length > 2048)
        throw new InputError("Missing PayPal verification headers.", 401);
      headers[name.replaceAll("-", "_")] = value;
    }
    return json(
      await invokeIntegrationFunction({
        action: "paypal-webhook",
        workspaceId,
        event,
        headers,
      }),
    );
  } catch (e) {
    return apiError(e);
  }
}
