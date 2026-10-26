import { Check, FileSearch, History, Link2 } from "@/components/icons";
import { MemoryIntelligencePreview } from "@/components/memory-intelligence-preview";

const benefits = [
  {
    icon: FileSearch,
    title: "Understand what’s owed, either way",
    copy: "Extract client payment terms and supplier invoice amounts, due dates, and references.",
  },
  {
    icon: Link2,
    title: "Match the reminder to the bill",
    copy: "Connect a follow-up email to an existing invoice, keeping one record for the same obligation.",
  },
  {
    icon: History,
    title: "Keep context for the next decision",
    copy: "Keep sources, assigned owners, term changes, and payment records with the client or supplier.",
  },
];

export function AgentMemory() {
  return (
    <section
      id="agent-memory"
      className="landing-section border-y border-[#e7edf7] bg-[#f5f8fd]"
      aria-labelledby="agent-memory-heading"
    >
      <div className="landing-shell">
        <div className="landing-heading-row">
          <div>
            <p className="landing-eyebrow">
              DOCUMENT INTELLIGENCE + AGENT MEMORY
            </p>
            <h2 id="agent-memory-heading" className="landing-heading">
              What you’re owed. What you owe.
              <br />
              <span className="brand-gradient">The context behind both.</span>
            </h2>
          </div>
          <p className="landing-description max-w-91.25">
            A client agreement, a supplier invoice, or a payment reminder in
            your inbox. Your agent connects the amount, due date, and history so
            the right action reaches the right person.
          </p>
        </div>
        <MemoryIntelligencePreview />
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {benefits.map(({ icon: Icon, title, copy }) => (
            <div key={title} className="flex gap-3">
              <Icon
                className="mt-0.5 size-4.25 shrink-0 text-[#4b71bc]"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-[13px] font-semibold">{title}</h3>
                <p className="mt-2 text-xs leading-[1.85] text-[#61718a]">
                  {copy}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-7 flex items-center gap-2 text-[11px] text-[#6b7b92]">
          <Check className="size-3.5 shrink-0" aria-hidden="true" />
          Planned capabilities · Explore the example sources above
        </p>
      </div>
    </section>
  );
}
