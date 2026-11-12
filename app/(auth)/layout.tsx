import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: { template: "%s | AssentPay", default: "Your account | AssentPay" },
  robots: { index: false, follow: false },
  // Origin only: keep recovery tokens private while allowing native POSTs to
  // carry their real Origin for the server's exact-origin CSRF check.
  referrer: "strict-origin",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthShell>{children}</AuthShell>;
}
