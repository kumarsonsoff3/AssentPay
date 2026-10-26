// A fail-closed native POST fallback. Never parse, reflect, log, or redirect a body.
export async function POST() {
  return new Response(
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Form unavailable | AssentPay</title><body><h1>This form could not load safely.</h1><p>No action was taken. Enable JavaScript and reload the page before trying again.</p><a href="/sign-in">Return to sign in</a></body></html>',
    {
      status: 400,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      },
    },
  );
}
