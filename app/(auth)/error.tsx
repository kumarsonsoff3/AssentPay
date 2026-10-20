"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AuthError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto my-auto w-full max-w-lg rounded-2xl border bg-background p-6 sm:p-8">
      <h2 className="text-2xl font-semibold">We couldn’t load your account.</h2>
      <p className="my-5 text-muted-foreground">
        Authentication is temporarily unavailable. Please try again shortly.
      </p>
      <Button className="min-h-11" onClick={reset}>
        Try again
      </Button>
      <Link
        className="mt-5 flex min-h-11 items-center text-sm font-medium text-primary"
        href="/sign-in"
      >
        Back to sign in
      </Link>
    </div>
  );
}
