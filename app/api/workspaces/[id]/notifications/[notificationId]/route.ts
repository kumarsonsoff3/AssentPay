import { apiUser, workspaceAccess } from "@/lib/workspaces/server";
import { apiError, inputBody, json, rateLimit } from "@/lib/workspaces/http";
import { withStorageOperation } from "@/lib/data/coordinator";
import { optionalRow, params, stableId, signal } from "@/lib/automation/store";
import { InputError, validId } from "@/lib/workspaces/validation";
export async function POST(
  request: Request,
  {
    params: routeParams,
  }: { params: Promise<{ id: string; notificationId: string }> },
) {
  try {
    const { id, notificationId } = await routeParams;
    validId(notificationId);
    await inputBody(request);
    const user = await apiUser();
    await workspaceAccess(id, user.$id);
    rateLimit("notification-read", user.$id, 120);
    await withStorageOperation("mutation", (op) =>
      op.commit(async (db, tx) => {
        const item = await optionalRow("notifications", notificationId, db, tx);
        if (!item || item.workspaceId !== id)
          throw new InputError("Notification not found.", 404);
        await db.upsertRow({
          ...params(
            "notification_reads",
            stableId(id, user.$id, notificationId),
            tx,
          ),
          permissions: [],
          data: { workspaceId: id, userId: user.$id, notificationId },
        });
        await signal(db, tx, id, "notification.read");
      }),
    );
    return json({ read: true });
  } catch (e) {
    return apiError(e);
  }
}
