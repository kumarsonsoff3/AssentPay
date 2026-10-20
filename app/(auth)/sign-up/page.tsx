import { AuthPanel } from "@/components/auth/auth-shell";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Create an account" };
export default function SignUpPage() {
  return (
    <AuthPanel>
      <AuthForm
        mode="sign-up"
        googleEnabled={process.env.AUTH_GOOGLE_ENABLED === "true"}
        paypalEnabled={process.env.AUTH_PAYPAL_ENABLED === "true"}
      />
    </AuthPanel>
  );
}
