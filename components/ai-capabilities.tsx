import {
  ArrowRight,
  BadgeCheck,
  CircleCheck,
  FileSearch,
  FileText,
  Filter,
  GitCompareArrows,
  Link2,
  Mail,
  MessageSquareText,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "@/components/icons";
import { GmailMark } from "@/components/brand";

const capabilities = [
  {
    icon: Filter,
    visual: "filter",
    label: "SIGNAL, NOT NOISE",
    title: "Finds the conversations that matter.",
    description:
      "Separates business conversations from newsletters and unrelated messages, so your attention goes where it’s needed.",
    tone: "blue",
  },
  {
    icon: MessageSquareText,
    visual: "intent",
    label: "INTENT RECOGNIZED",
    title: "Understands what your client means.",
    description:
      "Recognizes a go-ahead, a payment question, or a change of terms—and keeps the surrounding conversation in view.",
    tone: "green",
  },
  {
    icon: Link2,
    visual: "context",
    label: "CONTEXT CONNECTED",
    title: "Knows which deal you’re discussing.",
    description:
      "Connects a message to the right client, agreement, and payment history, even when the details live in different places.",
    tone: "violet",
  },
  {
    icon: FileSearch,
    visual: "terms",
    label: "TERMS EXTRACTED",
    title: "Picks up the financial details.",
    description:
      "Pulls out amounts, deposits, milestones, and due dates, with references to the messages and documents they came from.",
    tone: "blue",
  },
  {
    icon: GitCompareArrows,
    visual: "conflict",
    label: "NEEDS A SECOND LOOK",
    title: "Flags the details that don’t add up.",
    description:
      "Surfaces changed terms, conflicting amounts, and missing information for your review before an action moves forward.",
    tone: "amber",
  },
  {
    icon: Sparkles,
    visual: "action",
    label: "NEXT ACTION PREPARED",
    title: "Turns understanding into a next step.",
    description:
      "Recommends an invoice, reminder, or clarification, and gives you the supporting context to make the decision.",
    tone: "green",
  },
] as const;

function CapabilityVisual({
  kind,
}: {
  kind: (typeof capabilities)[number]["visual"];
}) {
  switch (kind) {
    case "filter":
      return (
        <div className="cap-visual cap-inbox">
          <div className="cap-mail-row">
            <span className="cap-mini-icon">
              <Mail aria-hidden="true" />
            </span>
            <span>
              <strong>Brand refresh · Acme Studio</strong>
              <small>Ready to move ahead with the project</small>
            </span>
            <i className="cap-signal-dot" />
          </div>
          <div className="cap-mail-row cap-muted-row">
            <span className="cap-mini-icon">
              <Mail aria-hidden="true" />
            </span>
            <span>
              <strong>Your weekly industry digest</strong>
              <small>Newsletter · Filtered out</small>
            </span>
            <CircleCheck
              className="size-3.5 shrink-0 text-[#8393ab]"
              aria-hidden="true"
            />
          </div>
        </div>
      );
    case "intent":
      return (
        <div className="cap-visual cap-intent">
          <div className="cap-message">
            <GmailMark className="size-4" />
            <p>
              “We’re <mark>happy to proceed</mark>.<br />
              Let’s pay the deposit upfront.”
            </p>
          </div>
          <span className="cap-result">
            <BadgeCheck aria-hidden="true" />
            Project acceptance identified
          </span>
        </div>
      );
    case "context":
      return (
        <div className="cap-visual cap-context">
          <div className="cap-client-node">
            <span>AS</span>
            <strong>Acme Studio</strong>
            <small>Brand refresh</small>
          </div>
          <div className="cap-node-branch" aria-hidden="true" />
          <div className="cap-connected-sources">
            <span>
              <FileText aria-hidden="true" />
              Agreement v2
            </span>
            <span>
              <ReceiptText aria-hidden="true" />
              Invoice #1042
            </span>
          </div>
        </div>
      );
    case "terms":
      return (
        <div className="cap-visual cap-terms">
          <div className="cap-deposit-ring">
            <span>
              40<small>%</small>
            </span>
          </div>
          <div>
            <small>DEPOSIT IDENTIFIED</small>
            <strong>
              $1,000<span> USD</span>
            </strong>
            <p>From a $2,500 agreement</p>
          </div>
        </div>
      );
    case "conflict":
      return (
        <div className="cap-visual cap-conflict">
          <div className="cap-conflict-values">
            <span>
              <small>Agreement</small>
              <strong>40%</strong>
            </span>
            <TriangleAlert
              className="size-4 text-[#ad781a]"
              aria-hidden="true"
            />
            <span>
              <small>Latest message</small>
              <strong>50%</strong>
            </span>
          </div>
          <span className="cap-result">
            <TriangleAlert aria-hidden="true" />
            Changed terms · Review needed
          </span>
        </div>
      );
    default:
      return (
        <div className="cap-visual cap-action">
          <div className="cap-invoice">
            <span className="cap-mini-icon">
              <FileText aria-hidden="true" />
            </span>
            <span>
              <small>DEPOSIT INVOICE</small>
              <strong>$1,000.00</strong>
            </span>
            <span className="cap-draft">Draft</span>
          </div>
          <span className="cap-result">
            <ShieldCheck aria-hidden="true" />
            Prepared for your approval
          </span>
        </div>
      );
  }
}

export function AiCapabilities() {
  return (
    <section
      id="capabilities"
      className="landing-section bg-white"
      aria-labelledby="capabilities-heading"
    >
      <div className="landing-shell">
        <div className="landing-heading-row">
          <div>
            <p className="landing-eyebrow">
              THE INTELLIGENCE BEHIND THE WORKFLOW
            </p>
            <h2 id="capabilities-heading" className="landing-heading">
              Your agent reads the details.
              <br />
              <span className="brand-gradient">You see what matters.</span>
            </h2>
          </div>
          <p className="landing-description max-w-91.25">
            Find financial intent, connect the right context, and surface the
            decisions that need your attention.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {capabilities.map(({ icon: Icon, ...capability }) => (
            <article
              key={capability.label}
              className="capability-card"
              data-tone={capability.tone}
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <span className="capability-tag">{capability.label}</span>
                <Icon
                  className="size-4.5 shrink-0 text-navy/45"
                  aria-hidden="true"
                />
              </div>
              <CapabilityVisual kind={capability.visual} />
              <h3 className="mt-6 text-[18px] leading-[1.4] font-semibold tracking-[-0.5px] text-navy">
                {capability.title}
              </h3>
              <p className="mt-3 text-[13px] leading-[1.9] text-[#61718a]">
                {capability.description}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 text-xs text-[#66768e]">
          <p>Planned capabilities · Illustrative examples</p>
          <a className="landing-text-link" href="#agent-memory">
            See how your agent keeps context{" "}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
