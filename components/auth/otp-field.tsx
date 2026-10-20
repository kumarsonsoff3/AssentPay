"use client";

import { useState } from "react";

export function OtpField({
  error,
  onEdit,
}: {
  error?: string;
  onEdit: () => void;
}) {
  const [code, setCode] = useState("");
  const [selection, setSelection] = useState(0);

  return (
    <div className="min-w-0">
      <label htmlFor="code" className="mb-2 block text-sm font-medium">
        Verification code
      </label>
      <div className="group relative">
        <input
          id="code"
          name="code"
          className="absolute inset-0 z-10 h-14 w-full cursor-text rounded-lg border-0 bg-transparent text-base text-transparent caret-transparent opacity-0"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          spellCheck={false}
          value={code}
          aria-invalid={!!error}
          aria-describedby={error ? "code-error code-hint" : "code-hint"}
          onChange={(event) => {
            const value = event.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(value);
            onEdit();
            setSelection(
              Math.min(event.target.selectionStart ?? value.length, 5),
            );
          }}
          onSelect={(event) =>
            setSelection(Math.min(event.currentTarget.selectionStart ?? 0, 5))
          }
          onPaste={(event) => {
            const value = event.clipboardData
              .getData("text")
              .replace(/\D/g, "")
              .slice(0, 6);
            if (!value) return;
            event.preventDefault();
            setCode(value);
            onEdit();
            setSelection(Math.min(value.length, 5));
          }}
        />
        <div
          className="pointer-events-none grid grid-cols-6 gap-2"
          aria-hidden="true"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <span
              key={index}
              className={[
                "flex h-14 items-center justify-center rounded-lg border font-mono text-2xl transition-shadow",
                code[index] ? "bg-accent/30" : "bg-background",
                error ? "border-destructive" : "border-input",
                index === selection
                  ? error
                    ? "group-focus-within:ring-3 group-focus-within:ring-destructive/15"
                    : "group-focus-within:border-primary group-focus-within:ring-3 group-focus-within:ring-primary/15"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {code[index] || (
                <span className="text-muted-foreground/60">·</span>
              )}
            </span>
          ))}
        </div>
      </div>
      <p
        id="code-hint"
        className="mt-3 text-[13px] leading-6 text-muted-foreground"
      >
        Enter or paste the six-digit code from your email.
      </p>
      {error && (
        <p
          id="code-error"
          className="mt-2 text-[13px] leading-6 text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
