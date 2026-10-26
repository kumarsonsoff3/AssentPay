import { cookies } from "next/headers";
import { apiUser, workspaceAccess } from "@/lib/workspaces/server";
import { createAccount } from "@/lib/auth/appwrite";
import { SESSION_COOKIE } from "@/lib/auth/config";
import { optionalRow } from "@/lib/automation/store";
import { apiError } from "@/lib/workspaces/http";
export const maxDuration = 60;
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params,
      user = await apiUser();
    await workspaceAccess(id, user.$id);
    const session = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!session) throw new Error("No session");
    let stop = () => {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false,
          busy = false;
        const started = Date.now();
        const encoder = new TextEncoder();
        const close = () => {
          if (closed) return;
          closed = true;
          clearInterval(timer);
          request.signal.removeEventListener("abort", close);
          try {
            controller.close();
          } catch {}
        };
        stop = close;
        const tick = async () => {
          if (closed || busy) return;
          busy = true;
          try {
            if (Date.now() - started > 50000) {
              close();
              return;
            }
            // Avoid React's request cache: recheck the actual session on every heartbeat.
            const current = await createAccount(session).get();
            if (
              current.$id !== user.$id ||
              !current.status ||
              !current.emailVerification
            )
              throw new Error("Session ended");
            await workspaceAccess(id, current.$id);
            const event = await optionalRow("workspace_events", id);
            if (!closed)
              controller.enqueue(
                encoder.encode(
                  `event: change\ndata: ${JSON.stringify({ revision: event?.revision || "initial", kind: event?.kind || "connected" })}\n\n`,
                ),
              );
          } catch {
            close();
          } finally {
            busy = false;
          }
        };
        const timer = setInterval(() => void tick(), 5000);
        request.signal.addEventListener("abort", close, { once: true });
        void tick();
      },
      cancel() {
        stop();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-store, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
