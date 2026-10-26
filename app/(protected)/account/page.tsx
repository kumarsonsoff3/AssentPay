import { LoadingState } from "@/components/feedback/feedback";
import { Suspense } from "react";
import type { Metadata } from "next";
import { AccountSettingsPage } from "@/components/settings/account-settings-page";
export const metadata: Metadata = { title: "Account settings | AssentPay", robots: { index: false, follow: false } };
export default function Page() { return <Suspense fallback={<LoadingState title="Loading your account…" />}><AccountSettingsPage /></Suspense>; }
