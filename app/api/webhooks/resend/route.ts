import { readBody } from "@/lib/auth/request";
import { apiError, json } from "@/lib/workspaces/http";
import { withStorageOperation } from "@/lib/data/coordinator";
import { acceptResend, verifyResend } from "@/lib/automation/resend";
export async function POST(request: Request) {
  try {
    const raw = await readBody(request, 65536, "application/json");
    const event = verifyResend(raw, request.headers);
    return json(await withStorageOperation("mutation", () => acceptResend(event)), 202);
  } catch (e) { return apiError(e); }
}
