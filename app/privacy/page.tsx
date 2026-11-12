import type { Metadata } from "next";
import Link from "next/link";

function DevelopmentPrivacyNotice({
  title,
  introduction,
  sections,
}: {
  title: string;
  introduction: string;
  sections: { title: string; text: string }[];
}) {
  return (
    <main className="landing-shell max-w-190 py-10 sm:py-16">
      <Link href="/" className="landing-text-link">
        Back to AssentPay
      </Link>
      <p className="landing-eyebrow mt-12">
        DEVELOPMENT PRIVACY NOTICE · OCTOBER 28, 2026
      </p>
      <h1 className="landing-heading">{title}</h1>
      <p className="landing-description mt-5">{introduction}</p>
      <p className="my-9 rounded-xl border border-[#dbe5f5] bg-[#f4f7fd] p-5 text-sm">
        This notice covers the demonstration and current development processing
        paths. Real connected business data is not fictional demonstration data.
        Production operator details and release verification remain incomplete.
      </p>
      {sections.map(section => (
        <section key={section.title} className="my-8">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <p className="mt-3 text-sm leading-[1.9] text-[#61718a]">
            {section.text}
          </p>
        </section>
      ))}
    </main>
  );
}

export const metadata: Metadata = {
  title: "Preview privacy notice — AssentPay",
  description:
    "How AssentPay handles development accounts, workspaces, and connected tools.",
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <DevelopmentPrivacyNotice
      title="Preview privacy notice"
      introduction="Understand what you’re interacting with while exploring AssentPay."
      sections={[
        {
          title: "Fictional demonstration data",
          text: "The names, messages, agreements, invoices, and transactions shown in the preview are fictional examples. The interactive controls change the demonstration in your browser.",
        },
        {
          title: "Development accounts and connected tools",
          text: "Development accounts and workspaces use Appwrite for authentication, profiles, preferences, team memberships, private workspace records and encrypted document storage. The current inbound-email path uses Resend: messages forwarded to a workspace address, including message content and supported attachments, can be imported and processed. Controlled Gmail sync is available only when enabled by the operator and can import recent messages, contacts and attachment metadata; it is not the default receiving path. Background jobs, provider events and workspace changes create activity records and notifications.",
        },
        {
          title: "AI analysis and workspace memory",
          text: "When a private analysis worker is configured, message content, extracted document text, relevant sender history and active workspace memory can be sent to the configured OpenAI model for financial classification and extraction. When you use AG Studio chat, your prompt and relevant dashboard context can also be sent to OpenAI to build and explain visualizations. Optional document vision can send supported document content to OpenAI when explicitly enabled. Provider processing terms, locations and retention depend on the deployment and provider account; this notice does not promise zero provider retention. Owners and administrators can review, pause, correct or forget AI memory. Forgetting memory does not erase source messages, documents, financial approvals or audit records.",
        },
        {
          title: "Slack and PayPal sandbox",
          text: "Configured Slack review notifications share a review link and limited financial summary with the selected review destination. Verified direct decisions require separate owner identity linking and an exact proposal; a recipient email explicitly selected by the owner is disclosed in that linked Slack account’s decision card. PayPal sandbox draft creation requires owner approval, and invoice sending requires separate approval of a verified send review. Sending can notify the customer and merchant through PayPal; it is not a charge or proof of payment. Selected invoice details and provider statuses are retained for verification and reconciliation. Where explicitly enabled, an owner can approve a sandbox supplier payout for an exact amount and recipient. PayPal receives the approved amount, recipient and identifiers for processing and verification. Live payments are disabled. Availability depends on operator setup and verification.",
        },
        {
          title: "Retention, deletion and connected credentials",
          text: "Connection credentials are encrypted. Disconnecting blocks further execution through that connection but does not erase retained records or revoke the provider grant; grants can be revoked in provider account settings. Slack capabilities and unapproved PayPal send reviews expire after ten minutes for authorization. A running full maintenance worker incrementally deletes expired or consumed Slack capabilities and expired or superseded unapproved send reviews; expiry is not a guaranteed physical-deletion deadline. Reviews referenced by approvals, immutable approval snapshots, financial deduplication and audit evidence are not removed by this transient cleanup. AI memory has its own expiry and forget controls. Workspace deletion and account cleanup have separate scopes; financial evidence can remain where required to preserve integrity. There is no financial-data export endpoint currently. Long-term source, financial-audit and backup retention periods and any applicable legal obligations still require operator policy before real-user release.",
        },
        {
          title: "Before the live product",
          text: "This is a development notice, not a completed production privacy policy or a release-readiness claim. Before real-user use, the operator must publish its legal identity and privacy contact, applicable rights and request process, configured service providers and models, international-transfer information, and actual retention/deletion and backup policies. Those operator-specific facts have not been supplied here. Provider-backed security checks and deployment setup must also be completed; feature illustrations are not evidence that a live integration is ready.",
        },
      ]}
    />
  );
}
