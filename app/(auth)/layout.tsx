import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: { template: "%s | AssentPay", default: "Your account | AssentPay" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthShell>{children}</AuthShell>;
}
