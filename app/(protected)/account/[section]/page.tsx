import { LoadingState } from "@/components/feedback/feedback";
import { Suspense } from "react";
import type { Metadata } from "next";
import { AccountSettingsPage } from "@/components/settings/account-settings-page";
export const metadata: Metadata = { title: "Account settings | AssentPay", robots: { index: false, follow: false } };
async function Settings({ params }: { params: Promise<{section:string}> }) { return <AccountSettingsPage section={(await params).section} />; }
export default function Page(props: { params: Promise<{section:string}> }) { return <Suspense fallback={<LoadingState title="Loading settings…" />}><Settings {...props}/></Suspense>; }
