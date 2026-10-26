import {
  ArrowDownUp,
  BellRing,
  FileText,
  ListChecks,
  ReceiptText,
  RefreshCcw,
} from "@/components/icons";
import { PaymentLifecycle } from "@/components/payment-lifecycle";

const features = [
  {
    icon: FileText,
    title: "Client invoices and deposits",
    copy: "Prepare invoices from agreed terms, track milestone amounts, and send after approval with a PayPal payment page.",
  },
  {
    icon: ArrowDownUp,
    title: "Supplier invoices and bills",
    copy: "Identify what your business owes, who needs paying, and when it’s due. Keep the original invoice ready for review.",
  },
  {
    icon: BellRing,
    title: "Payment reminders, both ways",
    copy: "Prepare a follow-up for an unpaid client invoice, or surface a supplier’s due-date reminder in Slack.",
  },
  {
    icon: ListChecks,
    title: "Actions with assigned owners",
    copy: "Turn payment-related emails into tasks to review, remind, clarify, or proceed—with the amount, source, and owner attached.",
  },
  {
    icon: ReceiptText,
    title: "Receipts and confirmations",
    copy: "Match evidence of money received or money paid to the relevant invoice and notify the team of the updated status.",
  },
  {
    icon: RefreshCcw,
    title: "Reconciliation and refunds",
    copy: "Connect payments to their invoices, surface discrepancies, and prepare refund-related actions for review.",
  },
];

export function PayPalCapabilities() {
  return (
    <section
      id="payments"
      className="landing-section bg-white"
      aria-labelledby="payments-heading"
    >
      <div className="landing-shell">
        <div className="landing-heading-row">
          <div>
            <p className="landing-eyebrow">
              PAYMENT OPERATIONS, IN BOTH DIRECTIONS
            </p>
            <h2 id="payments-heading" className="landing-heading">
              Money coming in. Money going out.
              <br />
              <span className="brand-gradient">Every step accounted for.</span>
            </h2>
          </div>
          <p className="landing-description max-w-92.5">
            Send client invoices, stay on top of supplier bills, and track
            what’s paid. Your agent brings the context and relevant actions to
            Slack, with a clear owner for each task.
          </p>
        </div>
        <PaymentLifecycle />
        <div className="mt-9 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, copy }) => (
            <article key={title} className="flex items-start gap-3.5">
              <span className="landing-icon shrink-0">
                <Icon aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-[13px] font-semibold">{title}</h3>
                <p className="mt-2 text-xs leading-[1.9] text-[#61718a]">
                  {copy}
                </p>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-9 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[#d8e2f2] bg-[#fafcff] px-5 py-4 text-[11px] leading-relaxed text-[#61718a]">
          <p>
            <strong className="font-semibold text-navy">
              Supplier bill management is part of the core product.
            </strong>{" "}
            Batch payouts to multiple recipients are a separate future
            capability.
          </p>
          <span className="rounded-full bg-[#edf2fa] px-2.5 py-1 text-[10px] text-[#536782]">
            Batch payouts · Subject to PayPal access
          </span>
        </div>
        <p className="mt-5 text-[11px] leading-relaxed text-[#6b7b92]">
          Planned PayPal integration · Live availability will depend on merchant
          eligibility and supported features. AssentPay is not affiliated with
          or endorsed by PayPal.
        </p>
      </div>
    </section>
  );
}
