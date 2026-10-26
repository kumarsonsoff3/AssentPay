import {
  ArrowUpRight,
  Check,
  CirclePlay,
  ShieldCheck,
  Sparkles,
} from "@/components/icons";
import {
  DiscordMark,
  GmailMark,
  PayPalMark,
  SlackMark,
  TelegramMark,
  WhatsAppMark,
} from "@/components/brand";
import { ProductPreview } from "@/components/product-preview";
import { AiCapabilities } from "@/components/ai-capabilities";
import { AgentMemory } from "@/components/agent-memory";
import { PayPalCapabilities } from "@/components/paypal-capabilities";
import { ApprovalSection } from "@/components/approval-section";
import { FinalCta, GettingStarted, LandingFaq, SiteFooter } from "@/components/landing-close";
import { LandingHeader, LandingAction } from "@/components/landing-entry";
import { WorkflowDemo } from "@/components/workflow-demo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const integrations = [
  { name: "Email forwarding", icon: GmailMark },
  { name: "Slack", icon: SlackMark },
  { name: "PayPal", icon: PayPalMark },
  { name: "WhatsApp", icon: WhatsAppMark, soon: true },
  { name: "Discord", icon: DiscordMark, soon: true },
  { name: "Telegram", icon: TelegramMark, soon: true },
];

export default function Home() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <LandingHeader />
      <main id="main-content">
        <section
          className="hero-section relative isolate overflow-hidden"
          aria-labelledby="hero-heading"
        >
          <div className="hero-glow" aria-hidden="true" />
          <div className="page-shell hero-layout relative z-10">
            <div className="hero-copy">
              <Badge
                variant="outline"
                className="mb-7 gap-2 rounded-full border-blue-100 bg-blue-50/60 py-2 pr-3 pl-2 text-[10px] font-medium text-primary"
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-white">
                  <Sparkles className="size-2.5" />
                </span>{" "}
                A little intelligence. A lot less busywork.
                <ArrowUpRight className="ml-1 size-3" />
              </Badge>
              <h1 id="hero-heading" className="hero-heading">
                Turn client conversations
                <br className="hidden sm:block" /> into{" "}
                <span className="brand-gradient">real payments.</span>
              </h1>
              <p className="hero-description">
                Meet the AI agent that turns business conversations into
                invoices, payment requests, and follow-ups.
                <span className="mt-1.5 block font-medium text-navy/85">
                  It connects the dots. You give the go-ahead.
                </span>
              </p>
              <div className="hero-actions mt-8 flex flex-wrap gap-3">
                <LandingAction className="hero-primary inline-flex h-13 items-center justify-center gap-5 rounded-lg bg-primary px-6 text-[13px] font-medium text-white hover:bg-primary/90" />
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-13 gap-2.5 rounded-lg border-navy/13 bg-white/75 px-5 text-[13px] shadow-none hover:bg-white"
                >
                  <a href="#product-preview">
                    <CirclePlay className="size-4 text-primary" /> See the
                    product
                  </a>
                </Button>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2.5 text-[10px] text-navy/55">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-primary/75" /> Human
                  approval, built in
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-primary/75" /> Your tools,
                  working together
                </span>
              </div>
            </div>
            <WorkflowDemo />
          </div>
          <div className="page-shell relative z-10 pb-6">
            <div className="flex items-center gap-2 text-[9px] text-navy/40">
              <span className="h-px w-6 bg-navy/20" /> Built around the way
              business actually happens.
            </div>
          </div>
        </section>
        <section
          id="integrations"
          className="relative z-10 scroll-mt-4 border-y border-navy/7 bg-white"
          aria-label="Email forwarding and integrations"
        >
          <div className="page-shell integration-strip">
            <div className="shrink-0">
              <p className="text-[11px] font-medium text-navy/65">
                Familiar tools.
                <br className="hidden xl:block" /> A smarter connection.
              </p>
              <p className="mt-1 text-[9px] text-muted-foreground">
                Email forwarding · Connected tools · More coming
              </p>
            </div>
            <div className="integration-items">
              {integrations.map(({ name, icon: Icon, soon }) => (
                <div key={name} className="integration-brand">
                  <span className="flex size-8 shrink-0 items-center justify-center">
                    <Icon className="size-6" />
                  </span>
                  <span>{name}</span>
                  {soon && <span className="coming-soon">Soon</span>}
                </div>
              ))}
            </div>
          </div>
        </section>
        <ProductPreview />
        <AiCapabilities />
        <AgentMemory />
        <PayPalCapabilities />
        <ApprovalSection />
        <GettingStarted />
        <LandingFaq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
