"use client";

import { Button } from "@/components/ui/button";

export default function AccountError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg px-6 py-24">
      <h1 className="text-2xl font-semibold">
        Your account is temporarily unavailable.
      </h1>
      <p className="my-5 text-muted-foreground">
        We couldn’t reach the authentication service. Please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
