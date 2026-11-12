import {
  apiUser,
  createWorkspace,
  listWorkspaces,
} from "@/lib/workspaces/server";
import { apiError, inputBody, json, rateLimit } from "@/lib/workspaces/http";
import { text } from "@/lib/workspaces/validation";
export async function GET() {
  try {
    const user = await apiUser();
    return json({ workspaces: await listWorkspaces(user.$id) });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const input = await inputBody(request),
      user = await apiUser();
    rateLimit("create", user.$id, 10);
    return json(
      { workspace: await createWorkspace(text(input, "name"), user.$id) },
      201,
    );
  } catch (error) {
    return apiError(error);
  }
}
