import { NextRequest, NextResponse } from "next/server";
import { handleAuth } from "@/lib/auth/handler";
import { authConfig } from "@/lib/auth/config";
import { assertAppOrigin } from "@/lib/auth/origin";
import { readAuthFormBody } from "@/lib/auth/request";
import { InputError } from "@/lib/workspaces/validation";

const pages: Record<string, string> = {
  "sign-in": "/sign-in",
  "sign-up": "/sign-up",
  "forgot-password": "/forgot-password",
  "reset-password": "/forgot-password",
  "verify-otp": "/verify-email",
  "verify-link": "/verify-email",
};
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );

function resultPage(
  message: string,
  status: number,
  returnPath: string,
  retryAfter?: string | null,
) {
  const heading =
    status < 400 ? "Check your email." : "We couldn’t complete that request.";
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${heading} | AssentPay</title><style>body{margin:0;background:#f5f7fb;color:#14243a;font:16px/1.7 system-ui,sans-serif;display:grid;min-height:100svh;place-items:center}main{box-sizing:border-box;width:min(92%,30rem);padding:2rem;background:white;border:1px solid #dce3ed;border-radius:1rem}h1{font-size:1.5rem;line-height:1.3}a{color:#1762df;display:inline-block;padding:.75rem 0}</style></head><body><main><p>AssentPay</p><h1>${heading}</h1><p role="${status < 400 ? "status" : "alert"}">${escapeHtml(message)}</p><a href="${escapeHtml(returnPath)}">${status < 400 ? "Return to sign in" : "Try again"}</a></main></body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
        ...(retryAfter ? { "Retry-After": retryAfter } : {}),
      },
    },
  );
}

// Progressive enhancement: native POST works even if the browser cannot hydrate
// React. The same handler owns validation, rate limits, tokens and session cookies.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action: string }> },
) {
  const { action } = await context.params;
  const returnPath = Object.hasOwn(pages, action) ? pages[action] : "/sign-in";
  if (!Object.hasOwn(pages, action))
    return resultPage("This form is unavailable.", 404, returnPath);
  try {
    const config = authConfig();
    assertAppOrigin(request, config.origin);
    const input = await readAuthFormBody(request, 8192);
    const headers = new Headers(request.headers);
    headers.set("Content-Type", "application/json");
    headers.delete("Content-Length");
    const response = await handleAuth(
      new NextRequest(request.url, {
        method: "POST",
        headers,
        body: JSON.stringify(input),
      }),
      { params: Promise.resolve({ action }) },
    );
    const result = (await response.json()) as {
      redirect?: string;
      error?: string;
      message?: string;
    };
    if (
      response.ok &&
      result.redirect?.startsWith("/") &&
      !result.redirect.startsWith("//")
    ) {
      return NextResponse.redirect(new URL(result.redirect, config.origin), {
        status: 303,
        headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
      });
    }
    return resultPage(
      response.ok
        ? result.message || "Your request is complete."
        : result.error || "Please try again.",
      response.status,
      response.ok ? "/sign-in" : returnPath,
      response.headers.get("Retry-After"),
    );
  } catch (error) {
    return resultPage(
      error instanceof InputError
        ? error.message
        : "Authentication is temporarily unavailable. Please try again.",
      error instanceof InputError ? error.status : 503,
      returnPath,
    );
  }
}
