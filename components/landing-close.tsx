import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  CirclePlay,
  Link2,
  ListChecks,
  SlidersHorizontal,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

const setupSteps = [
  {
    icon: Link2,
    title: "Connect your tools.",
    copy: "Link your business inbox, approval channel, and PayPal account in one workspace.",
  },
  {
    icon: SlidersHorizontal,
    title: "Set your rules.",
    copy: "Choose what your agent monitors, add your agreements, and define who can approve actions.",
  },
  {
    icon: ListChecks,
    title: "Review the first action.",
    copy: "Get a proposed next step with its source details. Approve it, adjust it, or send it back.",
  },
];

const questions = [
  {
    question: "Can AssentPay handle both client payments and bills I owe?",
    answer:
      "Yes—that is the planned product scope. For money coming in, it prepares client invoices and follow-ups. For money going out, it surfaces supplier invoices, due dates, and payment reminders, then brings the source details and relevant actions to an assigned person in Slack.",
  },
  {
    question: "Can I use AssentPay for real payments today?",
    answer:
      "This site is a product preview. The workflow and dashboard use fictional data, and no live invoices, messages, or payments are sent. Account creation and real integrations are part of the upcoming product.",
  },
  {
    question: "Does reviewing a Slack task send an invoice or pay a bill?",
    answer:
      "The action is shown explicitly. Approving a prepared client invoice authorizes sending that invoice in the planned workflow. Reviewing a supplier bill records the review; payment still requires the appropriate provider confirmation. Setting a reminder or flagging an issue does not confirm a payment.",
  },
  {
    question: "Do payment emails have to come from PayPal?",
    answer:
      "The planned inbox intelligence covers relevant payment emails and attachments from clients and suppliers, including invoices, due-date reminders, and receipts. PayPal is the initial financial integration. A bill from another provider can still be surfaced for review and tracking; available payment actions depend on the provider and integration.",
  },
  {
    question: "Which communication channels are planned?",
    answer:
      "Email and Slack are the initial focus, with WhatsApp, Discord, and Telegram planned for later. PayPal is the planned financial integration. The logos on this page show the intended integrations, rather than connections that are live today.",
  },
  {
    question: "What happens when the details are missing or conflicting?",
    answer:
      "The agent is being designed to flag missing information and conflicting terms for review. A changed deposit amount, for example, should lead to a clarification rather than an invoice based on an assumption.",
  },
  {
    question: "What will the agent remember?",
    answer:
      "The planned memory connects client and supplier relationships, conversations, agreements, bills, due dates, payment history, and business preferences within a workspace. Source references, change history, and controls to correct or delete remembered details are part of the roadmap.",
  },
  {
    question: "How do supplier bills differ from batch payouts?",
    answer:
      "Supplier bill review, payment reminders, and assigned Slack tasks are part of the core product scope. Batch payouts send funds to multiple recipients and are a separate future capability, subject to PayPal eligibility. Subscriptions remain optional future scope.",
  },
];

export function GettingStarted() {
  return (
    <section
      id="how-it-works"
      className="landing-section bg-white"
      aria-labelledby="setup-heading"
    >
      <div className="landing-shell">
        <div className="mx-auto max-w-157.5 text-center">
          <p className="landing-eyebrow">GETTING STARTED</p>
          <h2 id="setup-heading" className="landing-heading">
            A few connections.
            <br />
            <span className="brand-gradient">A clearer way to work.</span>
          </h2>
          <p className="landing-description mt-5">
            A look at the setup experience we’re building.
          </p>
        </div>
        <ol className="setup-steps">
          {setupSteps.map(({ icon: Icon, title, copy }, index) => (
            <li key={title}>
              <div className="mb-6 flex items-center gap-4">
                <span className="setup-number">0{index + 1}</span>
                <span className="h-px flex-1 bg-[#e4eaf4]" />
                <Icon className="size-4.5 text-[#6b84ae]" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold tracking-[-0.4px]">
                {title}
              </h3>
              <p className="mt-3 max-w-75 text-[13px] leading-[1.9] text-[#61718a]">
                {copy}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function LandingFaq() {
  return (
    <section
      id="faq"
      className="landing-section border-y border-[#e7edf7] bg-[#fafbfe]"
      aria-labelledby="faq-heading"
    >
      <div className="landing-shell grid items-start gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
        <div>
          <p className="landing-eyebrow">A FEW THINGS YOU MIGHT BE WONDERING</p>
          <h2 id="faq-heading" className="landing-heading">
            Good questions.
            <br />
            Clear answers.
          </h2>
          <p className="landing-description mt-5 max-w-75">
            What’s in the preview, what’s planned, and where you stay in
            control.
          </p>
        </div>
        <div>
          {questions.map(({ question, answer }) => (
            <details key={question} className="landing-faq">
              <summary>
                {question}
                <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="landing-section bg-white" aria-labelledby="cta-heading">
      <div className="landing-shell final-cta">
        <div>
          <p className="landing-eyebrow">LESS BUSYWORK. MORE FORWARD.</p>
          <h2 id="cta-heading" className="landing-heading">
            Give the details to your agent.
            <br />
            Keep the decisions with you.
          </h2>
          <p className="mt-5 max-w-113.75 text-[13px] leading-[1.9] text-[#61718a]">
            See a client conversation become a proposed invoice, an approval,
            and a simulated payment—all in one connected demo.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-3">
          <Button
            asChild
            size="lg"
            className="h-12 gap-4 rounded-lg px-6 text-xs"
          >
            <a href="#workflow">
              <CirclePlay className="size-4" aria-hidden="true" />
              Explore the demo
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </Button>
          <p className="text-[10px] text-[#697c98]">
            Fictional data. No account needed.
          </p>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[#e7edf7] bg-[#fafbfe]">
      <div className="landing-shell">
        <div className="grid gap-9 py-12 sm:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Brand />
            <p className="mt-4 max-w-67.5 text-xs leading-[1.9] text-[#61718a]">
              Connected conversations.
              <br />
              Clearer financial operations.
              <br />
              Your approval, every step forward.
            </p>
          </div>
          <nav aria-label="Footer product navigation" className="footer-links">
            <p>Explore</p>
            <a href="#capabilities">AI capabilities</a>
            <a href="#agent-memory">Documents &amp; memory</a>
            <a href="#payments">PayPal capabilities</a>
            <a href="#your-control">Your control</a>
          </nav>
          <nav aria-label="Footer information" className="footer-links">
            <p>Good to know</p>
            <a href="#how-it-works">Getting started</a>
            <a href="#faq">Questions &amp; answers</a>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-[#e4eaf4] py-6 text-[10px] leading-relaxed text-[#687a93]">
          <span>© 2026 AssentPay</span>
          <span>
            Product preview · Planned integrations · No live financial actions
          </span>
        </div>
      </div>
    </footer>
  );
}
