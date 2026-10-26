"use client";
import { requestErrorMessage } from "@/lib/request-feedback";
import { Spinner } from "@/components/feedback/feedback";

import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { GoogleMark, PayPalMark } from "@/components/brand";
import {
  normalizeEmail,
  passwordRules,
  validEmail,
  validatePassword,
} from "@/lib/auth/validation";
import { OtpField } from "./otp-field";
import { useResendCooldown } from "./use-resend-cooldown";

const inputClassName =
  "h-12 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-3 focus:ring-primary/10 focus:outline-none disabled:bg-muted aria-invalid:border-destructive aria-invalid:focus:border-destructive aria-invalid:focus:ring-destructive/15";
const labelClassName = "mb-2 block text-sm font-medium";
const fieldErrorClassName = "mt-2 text-[13px] leading-6 text-destructive";
const primaryButtonClassName = "h-12 w-full gap-2 rounded-lg text-sm shadow-sm";
const textButtonClassName =
  "inline-flex min-h-11 items-center justify-center text-sm font-medium text-primary underline-offset-4 hover:underline disabled:cursor-default disabled:opacity-60";

export type AuthMode =
  | "sign-in"
  | "sign-up"
  | "forgot-password"
  | "reset-password"
  | "verify-email"
  | "email-verification";

const copy: Record<
  AuthMode,
  { eyebrow: string; title: string; description: string; button: string; pending: string }
> = {
  "sign-in": {
    eyebrow: "WELCOME BACK",
    title: "Good to see you again.",
    description: "Sign in to keep your business moving forward.",
    button: "Sign in",
    pending: "Signing in…",
  },
  "sign-up": {
    eyebrow: "LET’S GET STARTED",
    title: "Create your AssentPay account.",
    description: "Create your account. A little less admin starts here.",
    button: "Create account",
    pending: "Creating account…",
  },
  "forgot-password": {
    eyebrow: "A FRESH START",
    title: "Forgot your password?",
    description:
      "It happens. Enter your email and we’ll send you a link to reset it.",
    button: "Send reset link",
    pending: "Sending reset link…",
  },
  "reset-password": {
    eyebrow: "A FRESH START",
    title: "Set a new password.",
    description: "Choose a strong password you haven’t used before.",
    button: "Save new password",
    pending: "Saving password…",
  },
  "verify-email": {
    eyebrow: "ONE MORE STEP",
    title: "Check your inbox.",
    description:
      "We sent a six-digit code to your email. Verify your address to finish creating your account.",
    button: "Verify email",
    pending: "Verifying email…",
  },
  "email-verification": {
    eyebrow: "ONE MORE STEP",
    title: "Verify your email.",
    description:
      "Confirm your email address to finish setting up your account.",
    button: "Confirm email address",
    pending: "Verifying email…",
  },
};

class AuthRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function send(action: string, payload: object = {}) {
  const response = await fetch(`/api/auth/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok && result.code === "APP_ORIGIN_MISMATCH" && result.redirect)
    window.location.assign(result.redirect);
  if (!response.ok)
    throw new AuthRequestError(
      result.error || "Something went wrong. Please try again.",
      response.status,
    );
  return result as { redirect?: string; message?: string };
}

function PasswordField({
  name,
  label,
  onChange,
  reveal,
  onReveal,
  isNew = false,
  error,
}: {
  name: string;
  label: string;
  onChange?: (value: string) => void;
  reveal: boolean;
  onReveal: () => void;
  isNew?: boolean;
  error?: string;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={name} className={labelClassName}>
        {label}
      </label>
      <div className="relative">
        <input
          id={name}
          className={`${inputClassName} pr-12`}
          name={name}
          type={reveal ? "text" : "password"}
          autoComplete={isNew ? "new-password" : "current-password"}
          required
          maxLength={256}
          minLength={isNew ? 12 : undefined}
          onChange={
            onChange ? (event) => onChange(event.target.value) : undefined
          }
          placeholder={
            isNew ? "Create a strong password" : "Enter your password"
          }
          aria-invalid={!!error}
          aria-describedby={
            [
              isNew && name === "password" ? "password-rules" : "",
              error ? `${name}-error` : "",
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
        />
        <button
          type="button"
          aria-label={reveal ? "Hide password" : "Show password"}
          aria-pressed={reveal}
          onClick={onReveal}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-muted-foreground hover:text-primary"
        >
          {reveal ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {error && (
        <p id={`${name}-error`} className={fieldErrorClassName} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function AuthForm({
  mode,
  googleEnabled = false,
  paypalEnabled = false,
  email,
  tokens = null,
  initialMessage = "",
  initialError = "",
}: {
  mode: AuthMode;
  googleEnabled?: boolean;
  paypalEnabled?: boolean;
  email?: string;
  tokens?: { userId: string; secret: string } | null;
  initialMessage?: string;
  initialError?: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState(initialMessage);
  const [requestPending, setBusy] = useState(false);
  const [navigationPending, startNavigation] = useTransition();
  const busy = requestPending || navigationPending;
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const confirmationRef = useRef<HTMLHeadingElement>(null);
  const hasShownConfirmation = useRef(false);
  const pendingFocus = useRef<string | null>(null);
  const { seconds: cooldown, start: startCooldown } = useResendCooldown();
  const isNew = mode === "sign-up" || mode === "reset-password";
  const authEntry = mode === "sign-in" || mode === "sign-up";
  const submitAction =
    mode === "verify-email"
      ? "verify-otp"
      : mode === "email-verification"
        ? "verify-link"
        : mode;
  const content = copy[mode];

  useEffect(() => {
    if (mode === "reset-password" || mode === "email-verification") {
      // Strip credentials from the address bar and keep them in component props.
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname,
      );
    }
  }, [mode]);

  useEffect(() => {
    if (recoveryEmail) {
      confirmationRef.current?.focus();
      hasShownConfirmation.current = true;
    } else if (hasShownConfirmation.current) {
      formRef.current?.querySelector<HTMLInputElement>("#email")?.focus();
    }
  }, [recoveryEmail]);

  useEffect(() => {
    if (!busy && pendingFocus.current) {
      formRef.current
        ?.querySelector<HTMLInputElement>(`#${pendingFocus.current}`)
        ?.focus();
      pendingFocus.current = null;
    }
  }, [busy, fieldErrors]);

  function clearField(name: string) {
    setFieldErrors((previous) => {
      if (!previous[name]) return previous;
      const next = { ...previous };
      delete next[name];
      return next;
    });
  }

  async function perform(action: string, payload?: object) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await send(action, payload);
      if (result.redirect) {
        // Clear sensitive fields before the router can retain this form in its
        // navigation cache, including after a later sign-out.
        formRef.current?.reset();
        setPassword("");
        if (action === "oauth") window.location.assign(result.redirect);
        else {
          startNavigation(() => {
            router.replace(result.redirect!);
            router.refresh();
          });
        }
      } else {
        if (
          action === "forgot-password" &&
          payload &&
          "email" in payload &&
          typeof payload.email === "string"
        ) {
          setRecoveryEmail(normalizeEmail(payload.email));
          startCooldown();
          setMessage(
            recoveryEmail
              ? "If this email belongs to an account, another reset link is on its way."
              : "",
          );
        } else {
          setMessage(result.message || "Done.");
        }
        if (action === "send-otp" || action === "send-verification") {
          startCooldown();
        }
      }
    } catch (cause) {
      const issue =
        requestErrorMessage(cause);
      // Account/network failures remain form-level; a rejected code belongs
      // beside the code field, including expired or already-used codes.
      if (
        action === "verify-otp" &&
        cause instanceof AuthRequestError &&
        cause.status === 400
      ) {
        setFieldErrors({ code: issue });
        pendingFocus.current = "code";
      } else setError(issue);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    // Password managers and early typing can populate the DOM before React
    // receives a change event. Validate the values that will actually be sent.
    const submittedPassword = String(fields.get("password") || "");
    const payload = Object.fromEntries(fields.entries());
    const issues: Record<string, string> = {};
    if (mode === "sign-up" && !String(fields.get("name") || "").trim())
      issues.name = "Enter your full name.";
    if (
      (authEntry || mode === "forgot-password") &&
      !validEmail(normalizeEmail(String(fields.get("email") || "")))
    )
      issues.email = "Enter a valid email address.";
    if (mode === "sign-in" && !submittedPassword)
      issues.password = "Enter your password.";
    if (isNew) {
      const issue = validatePassword(submittedPassword);
      if (issue) issues.password = issue;
      if (!fields.get("confirmPassword"))
        issues.confirmPassword = "Confirm your password.";
      else if (submittedPassword !== fields.get("confirmPassword"))
        issues.confirmPassword = "The passwords do not match.";
    }
    if (
      mode === "verify-email" &&
      !/^\d{6}$/.test(String(fields.get("code") || ""))
    )
      issues.code = "Enter all six digits from your email.";
    if (mode === "sign-up" && fields.get("terms") !== "on")
      issues.terms = "Accept the terms and privacy policy to continue.";
    setFieldErrors(issues);
    setError("");
    if (Object.keys(issues).length) {
      const first = Object.keys(issues)[0];
      event.currentTarget
        .querySelector<HTMLInputElement>(`[name="${first}"]`)
        ?.focus();
      return;
    }
    void perform(submitAction, {
      ...payload,
      ...tokens,
      terms: fields.get("terms") === "on",
    });
  }

  const invalidLink =
    (mode === "reset-password" || mode === "email-verification") && !tokens;

  return (
    <div className="w-full min-w-0">
      <div className="mb-6">
        {!authEntry && (
          <div className="mb-5 flex size-12 items-center justify-center rounded-xl border border-primary/15 bg-accent text-primary">
            {recoveryEmail ||
            mode === "verify-email" ||
            mode === "email-verification" ? (
              <Mail size={23} />
            ) : (
              <LockKeyhole size={23} />
            )}
          </div>
        )}
        <span className="text-[11px] font-semibold tracking-widest text-primary">
          {content.eyebrow}
        </span>
        <h1
          className="mt-3 text-[27px] leading-tight font-semibold tracking-tight text-balance outline-none sm:text-3xl"
          ref={confirmationRef}
          tabIndex={recoveryEmail ? -1 : undefined}
        >
          {recoveryEmail ? "Check your email." : content.title}
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          {recoveryEmail
            ? "If an account uses this email, you’ll receive a link to reset your password."
            : content.description}
        </p>
        {(email || recoveryEmail) && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/60 px-3 py-3 text-sm font-medium break-all">
            <Mail
              size={16}
              className="mt-0.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            {recoveryEmail || email}
          </p>
        )}
      </div>
      {authEntry && (googleEnabled || paypalEnabled) && (
        <>
          <div
            className={
              googleEnabled && paypalEnabled
                ? "grid gap-3 sm:grid-cols-2"
                : "grid gap-3"
            }
          >
            {googleEnabled && (
              <Button
                variant="outline"
                className="h-12 w-full gap-2 rounded-lg px-3 text-[13px] font-medium shadow-none"
                disabled={busy}
                onClick={() => void perform("oauth", { provider: "google" })}
              >
                <GoogleMark className="size-4.5" />
                Continue with Google
              </Button>
            )}
            {paypalEnabled && (
              <Button
                variant="outline"
                className="h-12 w-full gap-2 rounded-lg px-3 text-[13px] font-medium shadow-none"
                disabled={busy}
                onClick={() => void perform("oauth", { provider: "paypal" })}
              >
                <PayPalMark className="size-5" />
                Continue with PayPal
              </Button>
            )}
          </div>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
            <span>or continue with email</span>
          </div>
        </>
      )}
      {error && (
        <div
          className="mb-5 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}
      {message && (
        <div
          className="mb-5 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800"
          role="status"
        >
          <CheckCircle2 size={17} className="mt-1 shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {recoveryEmail ? (
        <div className="flex flex-col gap-3">
          <div className="mb-2 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-7 text-emerald-800">
            <CheckCircle2
              size={19}
              className="mt-1 shrink-0"
              aria-hidden="true"
            />
            <p>
              Check your inbox and spam folder. The link is valid for one hour.
            </p>
          </div>
          <Button
            className={primaryButtonClassName}
            disabled={busy || cooldown > 0}
            onClick={() =>
              void perform("forgot-password", { email: recoveryEmail })
            }
          >
            {busy
              ? "Sending…"
              : cooldown > 0
                ? `Resend link in ${cooldown}s`
                : "Resend reset link"}
          </Button>
          <button
            className={textButtonClassName}
            disabled={busy}
            onClick={() => {
              setRecoveryEmail("");
              setMessage("");
              setError("");
              setFieldErrors({});
            }}
          >
            Use another email address
          </button>
        </div>
      ) : invalidLink ? (
        <div
          className="rounded-lg border border-border bg-muted/60 p-4 text-sm leading-7 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4"
          role="alert"
        >
          This link is missing or incomplete.{" "}
          {mode === "reset-password" ? (
            <Link href="/forgot-password">Request a new reset link</Link>
          ) : (
            <Link href="/verify-email">
              Sign in and request another verification email
            </Link>
          )}
          .
        </div>
      ) : (
        <form
          method="post"
          action={`/api/forms/auth/${submitAction}`}
          data-auth-pending={content.pending}
          ref={formRef}
          onSubmit={submit}
          noValidate
          className="w-full"
          aria-busy={busy}
          onInput={(event) => {
            if (event.target instanceof HTMLInputElement)
              clearField(event.target.name);
          }}
        >
          {tokens && (
            <>
              <input type="hidden" name="userId" value={tokens.userId} />
              <input type="hidden" name="secret" value={tokens.secret} />
            </>
          )}
          <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
            {mode === "sign-up" && (
              <div className="min-w-0">
                <label htmlFor="name" className={labelClassName}>
                  Full name
                </label>
                <input
                  id="name"
                  className={inputClassName}
                  name="name"
                  autoComplete="name"
                  placeholder="Your full name"
                  maxLength={128}
                  required
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={fieldErrors.name ? "name-error" : undefined}
                />
                {fieldErrors.name && (
                  <p
                    id="name-error"
                    className={fieldErrorClassName}
                    role="alert"
                  >
                    {fieldErrors.name}
                  </p>
                )}
              </div>
            )}
            {(authEntry || mode === "forgot-password") && (
              <div className="min-w-0">
                <label htmlFor="email" className={labelClassName}>
                  Email address
                </label>
                <input
                  id="email"
                  className={inputClassName}
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@company.com"
                  maxLength={254}
                  required
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={
                    fieldErrors.email ? "email-error" : undefined
                  }
                />
                {fieldErrors.email && (
                  <p
                    id="email-error"
                    className={fieldErrorClassName}
                    role="alert"
                  >
                    {fieldErrors.email}
                  </p>
                )}
              </div>
            )}
            {(authEntry || mode === "reset-password") && (
              <PasswordField
                name="password"
                label={isNew ? "Create password" : "Password"}
                onChange={setPassword}
                reveal={reveal}
                onReveal={() => setReveal(!reveal)}
                isNew={isNew}
                error={fieldErrors.password}
              />
            )}
            {isNew && (
              <>
                <ul
                  className="-mt-1 grid grid-cols-1 gap-x-3 gap-y-1.5 text-xs leading-5 text-muted-foreground sm:grid-cols-2"
                  id="password-rules"
                  aria-label="Password requirements"
                >
                  {passwordRules.map((rule) => (
                    <li
                      key={rule.label}
                      className="flex items-start gap-1.5 data-[met=true]:text-emerald-700"
                      data-met={password.length > 0 && rule.test(password)}
                    >
                      {password.length > 0 && rule.test(password) ? (
                        <Check
                          size={14}
                          className="mt-0.5 shrink-0 rounded-full bg-emerald-50 p-px"
                          aria-hidden="true"
                        />
                      ) : (
                        <Circle
                          size={14}
                          className="mt-0.5 shrink-0 text-muted-foreground/60"
                          aria-hidden="true"
                        />
                      )}
                      <span className="sr-only">
                        {password.length > 0 && rule.test(password)
                          ? "Met: "
                          : "Required: "}
                      </span>
                      {rule.label}
                    </li>
                  ))}
                </ul>
                <PasswordField
                  name="confirmPassword"
                  label="Confirm password"
                  reveal={reveal}
                  onReveal={() => setReveal(!reveal)}
                  isNew
                  error={fieldErrors.confirmPassword}
                />
              </>
            )}
            {mode === "sign-in" && (
              <div className="-mt-2 flex justify-end text-[13px] font-medium text-primary">
                <Link
                  className="inline-flex min-h-11 items-center"
                  href="/forgot-password"
                >
                  Forgot password?
                </Link>
              </div>
            )}
            {mode === "verify-email" && (
              <OtpField
                error={fieldErrors.code}
                onEdit={() => clearField("code")}
              />
            )}
            {mode === "sign-up" && (
              <div>
                <label className="flex min-h-11 cursor-pointer items-start gap-2 text-[13px] leading-6 text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 accent-primary"
                    name="terms"
                    required
                    aria-invalid={!!fieldErrors.terms}
                    aria-describedby={
                      fieldErrors.terms ? "terms-error" : undefined
                    }
                  />
                  <span>
                    I agree to the <Link href="/terms">Terms of service</Link>{" "}
                    and <Link href="/privacy">Privacy policy</Link>.
                  </span>
                </label>
                {fieldErrors.terms && (
                  <p
                    id="terms-error"
                    className={fieldErrorClassName}
                    role="alert"
                  >
                    {fieldErrors.terms}
                  </p>
                )}
              </div>
            )}
            <Button
              className={primaryButtonClassName}
              type="submit"
              disabled={busy}
            >
              {busy ? (
                <Spinner size={17}/>
              ) : null}
              {busy ? content.pending : content.button}
              {!busy && <ArrowRight size={16} />}
            </Button>
          </fieldset>
        </form>
      )}
      {mode === "verify-email" && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-2 text-center text-[13px] text-muted-foreground">
          <p className="mb-3 w-full leading-6">
            Your code expires 15 minutes after it’s sent.
          </p>
          <p className="w-full">Didn’t receive an email?</p>
          <button
            className={textButtonClassName}
            disabled={busy || cooldown > 0}
            onClick={() => void perform("send-otp")}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
          <span>or</span>
          <button
            className={textButtonClassName}
            disabled={busy || cooldown > 0}
            onClick={() => void perform("send-verification")}
          >
            Send a verification link
          </button>
        </div>
      )}
      {authEntry && (
        <p className="mt-5 flex flex-wrap items-center justify-center gap-1 text-center text-[13px] text-muted-foreground">
          {mode === "sign-in"
            ? "New to AssentPay?"
            : "Already have an account?"}{" "}
          <Link
            className="inline-flex min-h-11 items-center gap-1 font-medium text-primary"
            href={mode === "sign-in" ? "/sign-up" : "/sign-in"}
          >
            {mode === "sign-in" ? "Create an account" : "Sign in"}
            <ArrowUpRightIcon />
          </Link>
        </p>
      )}
      {!authEntry && (
        <Link
          href="/sign-in"
          className="mt-4 flex min-h-11 items-center justify-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft size={14} />
          Back to sign in
        </Link>
      )}
      <div className="mt-6 flex items-start justify-center gap-2 border-t border-border pt-5 text-center text-xs leading-5 text-muted-foreground">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        <span>
          {isNew
            ? "A strong password. A safer start."
            : "A secure start to smarter financial operations."}
        </span>
      </div>
    </div>
  );
}

function ArrowUpRightIcon() {
  return <span aria-hidden="true">↗</span>;
}

export function SignOutButton({ menuItem = false, className }: { menuItem?: boolean; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const signOut = (
      <Button
        variant={menuItem ? "ghost" : "outline"}
        className={className || "min-h-11"}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await send("sign-out");
            router.replace("/sign-in");
            router.refresh();
          } catch {
            setError("Couldn’t sign out. Please try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy && <Spinner size={16}/>} {busy ? "Signing out…" : "Sign out"}
      </Button>
  );
  return (
    <>
      {menuItem ? <DropdownMenu.Item asChild onSelect={(event) => event.preventDefault()}>{signOut}</DropdownMenu.Item> : signOut}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </>
  );
}
