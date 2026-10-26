import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ShieldCheck,
  Sparkles,
} from "@/components/icons";
import { Brand } from "@/components/brand";

async function Copyright() {
  "use cache";
  return <span>© {new Date().getFullYear()} AssentPay</span>;
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-linear-to-br from-muted/70 via-background to-background">
      <a href="#auth-content" className="skip-link">
        Skip to form
      </a>
      <header className="flex items-center justify-between gap-4 px-6 py-5 sm:px-10 lg:px-12">
        <Link href="/" aria-label="AssentPay home">
          <span className="sm:hidden">
            <Brand />
          </span>
          <span className="hidden sm:inline-flex">
            <Brand />
          </span>
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span className="hidden min-[360px]:inline">Back to home</span>
          <span className="sr-only min-[360px]:hidden">Back to home</span>
        </Link>
      </header>
      <main
        id="auth-content"
        className="flex flex-1 px-5 py-6 sm:px-10 sm:py-10 lg:px-12"
      >
        {children}
      </main>
      <footer className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 border-t border-border bg-background/70 px-6 py-4 text-xs text-muted-foreground sm:justify-between sm:px-10 lg:px-12">
        <Copyright />
        <div className="flex items-center gap-5">
          <Link
            className="inline-flex min-h-11 items-center hover:text-primary"
            href="/privacy"
          >
            Privacy policy
          </Link>
          <Link
            className="inline-flex min-h-11 items-center hover:text-primary"
            href="/terms"
          >
            Terms of service
          </Link>
        </div>
      </footer>
    </div>
  );
}

const workflowSteps = [
  {
    title: "Conversations become clarity",
    description: "Bring the important details together.",
    icon: Check,
  },
  {
    title: "You give the go-ahead",
    description: "Review every step before it happens.",
    icon: ShieldCheck,
  },
  {
    title: "Move business forward",
    description: "Less admin. More time for what’s next.",
    icon: ArrowUpRight,
  },
];

export function AuthPanel({
  children,
  compact = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "mx-auto my-auto w-full max-w-lg"
          : "mx-auto my-auto grid w-full max-w-6xl items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] xl:gap-24"
      }
    >
      {!compact && (
        <aside
          className="hidden min-w-0 self-start py-10 lg:sticky lg:top-10 lg:block"
          aria-label="About AssentPay"
        >
          <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-primary">
            <Sparkles className="size-4" aria-hidden="true" />
            YOUR BUSINESS, IN GOOD HANDS
          </div>
          <h2 className="mt-6 text-5xl leading-[1.12] font-semibold tracking-[-2px] xl:text-[54px]">
            Less busywork.
            <br />
            More <span className="brand-gradient">possibility.</span>
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-7 text-muted-foreground">
            Bring your conversations and payments together. Your AI agent
            connects the dots. You stay in control.
          </p>
          <div
            className="mt-8 max-w-sm rounded-2xl border border-border bg-background/90 px-5 shadow-sm"
            aria-hidden="true"
          >
            {workflowSteps.map(({ title, description, icon: Icon }, index) => (
              <div
                key={title}
                className="flex items-start gap-3 py-5 not-first:border-t not-first:border-border"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 font-mono text-[10px] text-muted-foreground">
                  0{index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {description}
                  </p>
                </div>
                <Icon className="mt-1 ml-auto size-4 shrink-0 text-primary/70" />
              </div>
            ))}
          </div>
          <p className="mt-6 flex max-w-sm items-start gap-2 text-xs leading-5 text-muted-foreground">
            <ShieldCheck
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            Built around your approval, every step of the way.
          </p>
        </aside>
      )}
      <section className="mx-auto w-full min-w-0 max-w-lg rounded-2xl border border-border bg-background p-5 shadow-[0_12px_40px_-24px_#10234420] sm:p-8">
        {children}
      </section>
    </div>
  );
}
