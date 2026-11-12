import { NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/auth/appwrite";
import { authConfig } from "@/lib/auth/config";
import { workspaceAccess, selectWorkspace } from "@/lib/workspaces/server";
import { apiError } from "@/lib/workspaces/http";
import { InputError, validId } from "@/lib/workspaces/validation";
import { optionalRow } from "@/lib/automation/store";
import { storedInvoicePaymentLink } from "@/lib/automation/paypal-invoice-link";
export async function GET(request: Request, { params }: { params: Promise<{ id: string; workflowId: string }> }) {
  const user = await requireVerifiedUser();
  try {
    const { id, workflowId } = await params;
    validId(id); validId(workflowId);
    const openPayPal = new URL(request.url).searchParams.get("open") === "paypal";
    await workspaceAccess(id, user.$id, openPayPal ? ["owner"] : undefined);
    const workflow = await optionalRow("financial_workflows", workflowId);
    if (!workflow || workflow.workspaceId !== id) throw new InputError("Review not found.", 404);
    if (openPayPal) {
      const link = await storedInvoicePaymentLink(id, workflowId, workflow.providerId, workflow.status);
      if (link) return NextResponse.redirect(link, { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
    }
    await selectWorkspace(id);
    const destination = new URL(openPayPal ? "/dashboard/invoices" : "/dashboard/approvals", authConfig().origin);
    destination.searchParams.set("workflow", workflowId);
    return NextResponse.redirect(destination, { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) { return apiError(error); }
}
