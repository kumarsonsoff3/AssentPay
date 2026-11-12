import { readJsonBody } from "@/lib/auth/request";
import { requestSource } from "@/lib/auth/source";
import { assertAppOrigin } from "@/lib/auth/origin";
import { InputError } from "@/lib/workspaces/validation";
import { randomBytes } from "node:crypto";
import { Account, AppwriteException, ID, OAuthProvider } from "node-appwrite";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  createAccount,
  saveSession,
  clearSessionCookies,
} from "@/lib/auth/appwrite";
import {
  AuthConfigurationError,
  authConfig,
  OAUTH_COOKIE,
  SESSION_COOKIE,
} from "@/lib/auth/config";
import { allowAuthRequest } from "@/lib/auth/rate-limit";
import {
  normalizeEmail,
  validEmail,
  validToken,
  validatePassword,
} from "@/lib/auth/validation";

const actions = new Set([
  "sign-up",
  "sign-in",
  "sign-out",
  "forgot-password",
  "reset-password",
  "verify-otp",
  "verify-link",
  "send-otp",
  "send-verification",
  "oauth",
]);
const json = (body: object, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
const failed = (message: string, status = 400) =>
  json({ error: message }, status);

class SessionRequiredError extends Error {}

async function sessionAccount(): Promise<Account> {
  const secret = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!secret) throw new SessionRequiredError("Sign in to continue.");
  return createAccount(secret);
}

export async function handleAuth(
  request: NextRequest,
  context: { params: Promise<{ action: string }> },
) {
  const { action } = await context.params;
  if (!actions.has(action)) return failed("Not found.", 404);
  try {
    const config = authConfig();
    assertAppOrigin(request, config.origin);
    const input = await readJsonBody(request, 8192);
    const field = (name: string) =>
      typeof input[name] === "string" ? (input[name] as string) : "";
    const email = normalizeEmail(field("email"));
    const ip = requestSource(request.headers);
    if (
      !allowAuthRequest("global", ip, 100) ||
      !allowAuthRequest(
        `${action}:source`,
        ip,
        action === "sign-out" ? 60 : 20,
      ) ||
      !allowAuthRequest(
        action,
        email || ip,
        action === "send-otp" || action === "send-verification" ? 5 : 10,
      )
    ) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait 15 minutes and try again." },
        {
          status: 429,
          headers: { "Retry-After": "900", "Cache-Control": "no-store" },
        },
      );
    }

    if (
      ["sign-up", "sign-in", "forgot-password"].includes(action) &&
      !validEmail(email)
    )
      return failed("Enter a valid email address.");
    const password = field("password"); // Deliberately never trim, normalize, escape, or truncate passwords.
    if (["sign-up", "reset-password"].includes(action)) {
      const error = validatePassword(password);
      if (error) return failed(error);
      if (password !== field("confirmPassword"))
        return failed("The passwords do not match.");
    }

    switch (action) {
      case "sign-up": {
        const name = field("name").trim();
        if (!name || name.length > 128 || /[\u0000-\u001f\u007f]/.test(name))
          return failed("Enter your name (up to 128 characters).");
        if (input.terms !== true)
          return failed(
            "Please accept the terms and privacy policy to continue.",
          );
        // Account creation keeps Appwrite's public rate limits. Only the session
        // bootstrap uses the narrowly scoped server API key.
        await createAccount().create({
          userId: ID.unique(),
          email,
          password,
          name,
        });
        const session = await createAccount(
          undefined,
          true,
        ).createEmailPasswordSession({ email, password });
        await saveSession(session);
        try {
          await createAccount(session.secret).createEmailVerificationOTP();
        } catch {
          return json({ redirect: "/verify-email?delivery=failed" });
        }
        return json({ redirect: "/verify-email" });
      }
      case "sign-in": {
        // Existing accounts can sign in even if the password policy later changes.
        if (
          !password ||
          password.length > 256 ||
          /[\u0000-\u001f\u007f]/.test(password)
        )
          return failed("Enter your email and password.");
        const session = await createAccount(
          undefined,
          true,
        ).createEmailPasswordSession({ email, password });
        await saveSession(session);
        const user = await createAccount(session.secret).get();
        return json({
          redirect: user.emailVerification ? "/dashboard" : "/verify-email",
        });
      }
      case "sign-out": {
        const secret = (await cookies()).get(SESSION_COOKIE)?.value;
        if (secret) {
          try {
            await createAccount(secret).deleteSession({ sessionId: "current" });
          } catch (error) {
            if (!(error instanceof AppwriteException && error.code === 401))
              throw error;
          }
        }
        await clearSessionCookies();
        return json({ redirect: "/sign-in" });
      }
      case "forgot-password": {
        try {
          await createAccount().createRecovery({
            email,
            url: `${config.origin}/reset-password`,
          });
        } catch (error) {
          // Give the same response for registered and unknown addresses.
          if (!(
            error instanceof AppwriteException &&
            [400, 401, 404].includes(error.code)
          ))
            throw error;
        }
        return json({
          message:
            "If an account uses this email, you’ll receive a password reset link. Check your inbox and spam folder.",
        });
      }
      case "reset-password": {
        const userId = field("userId"),
          secret = field("secret");
        if (!validToken(userId, secret))
          return failed("This reset link is invalid. Request a new one.");
        await createAccount().updateRecovery({ userId, secret, password });
        // The cloud session-invalidation policy is enabled and checked during setup.
        // Clear all local login/connection context and require a fresh sign-in.
        await clearSessionCookies();
        return json({ redirect: "/sign-in?reset=success" });
      }
      case "verify-otp": {
        const account = await sessionAccount();
        const user = await account.get();
        const secret = field("code").trim();
        if (!/^\d{6}$/.test(secret))
          return failed("Enter the six-digit code from your email.");
        await account.updateEmailVerificationOTP({ userId: user.$id, secret });
        return json({ redirect: "/dashboard" });
      }
      case "verify-link": {
        const userId = field("userId"),
          secret = field("secret");
        if (!validToken(userId, secret))
          return failed(
            "This verification link is invalid. Request a new one.",
          );
        await createAccount().updateEmailVerification({ userId, secret });
        return json({ redirect: "/sign-in?verified=success" });
      }
      case "send-otp":
      case "send-verification": {
        const account = await sessionAccount();
        const user = await account.get();
        if (user.emailVerification) return json({ redirect: "/dashboard" });
        if (action === "send-otp") await account.createEmailVerificationOTP();
        else
          await account.createEmailVerification({
            url: `${config.origin}/email-verification`,
          });
        return json({
          message:
            action === "send-otp"
              ? "A new code is on its way. It expires in 15 minutes."
              : "Verification link sent. Check your email.",
        });
      }
      case "oauth": {
        const provider =
          input.provider === undefined ? "google" : field("provider");
        if (provider !== "google" && provider !== "paypal")
          return failed("Choose a supported sign-in provider.");
        const enabled =
          provider === "google"
            ? process.env.AUTH_GOOGLE_ENABLED
            : process.env.AUTH_PAYPAL_ENABLED;
        if (enabled !== "true")
          return failed(
            `${provider === "google" ? "Google" : "PayPal"} sign-in is not available yet.`,
            503,
          );
        const nonce = randomBytes(32).toString("hex");
        const url = await createAccount().createOAuth2Token({
          provider:
            provider === "google" ? OAuthProvider.Google : OAuthProvider.Paypal,
          success: `${config.origin}/auth/callback?state=${nonce}`,
          failure: `${config.origin}/auth/callback?state=${nonce}&failure=1`,
        });
        (await cookies()).set(OAUTH_COOKIE, nonce, {
          httpOnly: true,
          secure: config.secure,
          sameSite: "lax",
          path: "/",
          maxAge: 600,
        });
        return json({ redirect: url });
      }
    }
    return failed("Not found.", 404);
  } catch (error) {
    if (error instanceof InputError)
      return json(
        { error: error.message, code: error.code, redirect: error.redirect },
        error.status,
      );
    if (error instanceof SessionRequiredError)
      return failed(error.message, 401);
    if (error instanceof AuthConfigurationError)
      return failed(error.message, 503);
    if (error instanceof AppwriteException) {
      if (error.code === 429)
        return failed(
          "Too many attempts. Please wait before trying again.",
          429,
        );
      if (action === "sign-in" && [400, 401, 404].includes(error.code))
        return failed("The email or password is incorrect.", 401);
      if (action === "sign-up" && error.code === 409)
        return failed(
          "We couldn’t create this account. Try signing in or resetting your password.",
          409,
        );
      if (
        [
          "user_password_personal_data",
          "user_password_recently_used",
          "user_password_dictionary",
          "user_password_pwned",
          "password_personal_data",
          "password_recently_used",
          "password_dictionary",
          "password_pwned",
        ].includes(error.type)
      )
        return failed(
          "Choose a different password. Avoid your name, email, common passwords, and previously used passwords.",
        );
      if (error.code === 401 && error.type !== "user_invalid_token")
        return failed("Your session has expired. Please sign in again.", 401);
      if (
        ["reset-password", "verify-link", "verify-otp"].includes(action) &&
        [400, 401, 404].includes(error.code)
      )
        return failed(
          "This code or link is invalid or has expired. Request a new one.",
        );
      if (error.code === 400)
        return failed(
          "Appwrite couldn’t accept these details. Check your input and the project’s authentication policies.",
        );
    }
    // Never return provider diagnostics, credentials, or submitted values.
    return failed(
      "Authentication is temporarily unavailable. Please try again.",
      503,
    );
  }
}
