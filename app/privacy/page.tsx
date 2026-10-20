import type { Metadata } from "next";
import { PreviewNotice } from "@/components/preview-notice";

export const metadata: Metadata = {
  title: "Preview privacy notice — AssentPay",
  description:
    "How the current AssentPay product demonstration works and what is planned before live integrations launch.",
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <PreviewNotice
      title="Preview privacy notice"
      introduction="Understand what you’re interacting with while exploring AssentPay."
      sections={[
        {
          title: "Fictional demonstration data",
          text: "The names, messages, agreements, invoices, and transactions shown in the preview are fictional examples. The interactive controls change the demonstration in your browser.",
        },
        {
          title: "No connected business accounts",
          text: "This preview does not provide account registration, connect to an inbox or messaging workspace, or process PayPal payments. Please use fictional values when trying the demo controls.",
        },
        {
          title: "Before the live product",
          text: "The production privacy policy will describe the service operator, connected data, processing providers, retention, deletion, and contact details. Those details are still being finalized and are not represented by the feature illustrations on this site.",
        },
      ]}
    />
  );
}
