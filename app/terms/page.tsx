import type { Metadata } from "next";
import { PreviewNotice } from "@/components/preview-notice";

export const metadata: Metadata = {
  title: "Preview terms — AssentPay",
  description: "Scope and limitations of the AssentPay demonstration site.",
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return <PreviewNotice title="Preview terms" introduction="This site demonstrates the experience we’re building for AssentPay." sections={[
    { title: "What the preview provides", text: "You can explore a simulated financial workflow, sample dashboard, and illustrations of planned capabilities. Approving an action in the demo does not send a message, issue an invoice, or transfer money." },
    { title: "Planned functionality", text: "Descriptions of integrations, AI capabilities, memory, approvals, and financial actions describe the product roadmap. Features and availability may change as the product is developed." },
    { title: "Third-party services", text: "Service names and logos identify intended integrations. They do not imply endorsement. Live integrations will depend on the relevant providers’ supported features, permissions, and eligibility requirements." },
    { title: "Before accounts and payments launch", text: "Production terms identifying the service operator, account conditions, fees where applicable, and support arrangements will be published before the live service becomes available." },
  ]} />;
}
