import { Fingerprint, History, SlidersHorizontal } from "@/components/icons";
import { ApprovalBriefing } from "@/components/approval-briefing";

const controls = [
  {
    icon: SlidersHorizontal,
    title: "The action fits the situation",
    copy: "Approve or modify an invoice to send. Review a supplier bill, set a reminder, or flag a question before payment.",
  },
  {
    icon: Fingerprint,
    title: "Someone owns the next step",
    copy: "See the assigned person, counterparty, amount, and due date together. Reassign the task when another teammate should handle it.",
  },
  {
    icon: History,
    title: "The source stays with the decision",
    copy: "Read the original email, invoice, or agreement. Keep the review outcome and payment confirmation as separate events.",
  },
];

export function ApprovalSection() {
  return (
    <section
      id="your-control"
      className="landing-section approval-section"
      aria-labelledby="approval-heading"
    >
      <div className="landing-shell grid items-center gap-12 lg:grid-cols-[1fr_0.95fr] lg:gap-20">
        <div>
          <p className="landing-eyebrow text-[#92b9ff]!">
            FROM PAYMENT EMAIL TO ASSIGNED ACTION
          </p>
          <h2 id="approval-heading" className="landing-heading text-white">
            The right task.
            <br />
            <span className="text-[#94bdff]">The right person. In Slack.</span>
          </h2>
          <p className="mt-5 max-w-105 text-sm leading-[1.9] text-[#b3c3dc]">
            A client is ready to pay. A supplier invoice is due. A reminder
            needs a response. Get a clear briefing with the source, owner, and
            relevant actions—without digging through your inbox.
          </p>
          <div className="mt-8 space-y-6">
            {controls.map(({ icon: Icon, title, copy }) => (
              <div className="flex gap-3.5" key={title}>
                <Icon
                  className="mt-0.5 size-4.5 shrink-0 text-[#94bdff]"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-[13px] font-medium text-white">
                    {title}
                  </h3>
                  <p className="mt-1.5 max-w-88.75 text-xs leading-[1.9] text-[#adbed8]">
                    {copy}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <ApprovalBriefing />
      </div>
      <p className="landing-shell mt-9 text-[10px] leading-relaxed text-[#9eafca]">
        Approval controls, permissions, and activity history shown here describe
        the planned product.
      </p>
    </section>
  );
}
