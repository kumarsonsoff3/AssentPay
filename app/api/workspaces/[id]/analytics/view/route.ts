import { apiUser, workspaceAccess } from "@/lib/workspaces/server";
import { apiError, inputBody, json, rateLimit } from "@/lib/workspaces/http";
import { generateAnalyticsView } from "@/lib/dashboard/analytics-server";
import { InputError } from "@/lib/workspaces/validation";
import { z } from "zod";
const input = z.strictObject({ prompt: z.string().trim().min(1).max(1000) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params, user = await apiUser();
    await workspaceAccess(id, user.$id);
    rateLimit("analytics-view", user.$id, 10);
    const body = input.safeParse(await inputBody(request));
    if (!body.success) throw new InputError("Enter a view request of 1–1000 characters.");
    return json({ view: await generateAnalyticsView(body.data.prompt) });
  } catch (error) { return apiError(error); }
}
