import { AuthForm, type AuthMode } from "./auth-form";
import { validToken } from "@/lib/auth/validation";

export type AuthSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export async function AuthScreen({
  mode,
  searchParams,
  email,
}: {
  mode: AuthMode;
  searchParams: AuthSearchParams;
  email?: string;
}) {
  const params = await searchParams;
  const userId = typeof params.userId === "string" ? params.userId : "";
  const secret = typeof params.secret === "string" ? params.secret : "";
  const initialMessage =
    params.reset === "success"
      ? "Password updated. Sign in with your new password."
      : params.verified === "success"
        ? "Email verified. You can now sign in."
        : "";
  const initialError =
    params.oauth === "failed"
      ? "Social sign-in was cancelled or could not be completed. Please try again."
      : params.delivery === "failed"
        ? "Your account was created, but the verification email couldn’t be sent. Request a new code below."
        : "";
  return (
    <AuthForm
      mode={mode}
      email={email}
      googleEnabled={process.env.AUTH_GOOGLE_ENABLED === "true"}
      paypalEnabled={process.env.AUTH_PAYPAL_ENABLED === "true"}
      tokens={validToken(userId, secret) ? { userId, secret } : null}
      initialMessage={initialMessage}
      initialError={initialError}
    />
  );
}
