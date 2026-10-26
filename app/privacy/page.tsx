import type { Metadata } from "next";
import { PreviewNotice } from "@/components/preview-notice";

export const metadata: Metadata = {
  title: "Preview privacy notice — AssentPay",
  description:
    "How AssentPay handles development accounts, workspaces, and connected tools.",
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
          title: "Development accounts and connected tools",
          text: "Development accounts and workspaces use Appwrite for authentication, profiles, preferences, and team memberships. Connected Gmail mailboxes synchronize recent messages, contact details and attachment metadata into private workspace storage. Selected attachments can be imported into encrypted document storage. Background jobs, provider events and workspace changes create activity records and notifications. Gmail consent includes send permission for future approved customer emails; sending is not enabled yet. Gmail and Slack tokens and per-workspace PayPal sandbox credentials are encrypted. Disconnecting stops access through the connection and hides that connection’s imported records; it does not erase retained records or revoke the provider grant. You can revoke grants in the provider’s account settings. AI financial execution is not enabled.",
        },
        {
          title: "Before the live product",
          text: "The production privacy policy will describe the service operator, connected data, processing providers, retention, deletion, and contact details. Those details are still being finalized and are not represented by the feature illustrations on this site.",
        },
      ]}
    />
  );
}
