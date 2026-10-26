import { LoadingState } from "@/components/feedback/feedback";
import { Suspense } from "react";
import type { Metadata } from "next";
import { WorkspaceSettingsPage } from "@/components/settings/workspace-settings-page";
export const metadata: Metadata = { title: "Workspace settings | AssentPay", robots: { index: false, follow: false } };
export default function Page(props: { params: Promise<{ id: string }> }) { return <Suspense fallback={<LoadingState title="Loading settings…" />}><WorkspaceSettingsPage {...props} /></Suspense>; }
