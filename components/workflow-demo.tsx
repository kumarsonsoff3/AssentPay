"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import {
  ArrowDown,
  Bot,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  FileText,
  LockKeyhole,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { GmailMark, PayPalMark, SlackMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeToMotion(callback: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
function getMotionPreference() {
  return window.matchMedia(motionQuery).matches;
}
const formatAmount = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
const stageMessages = [
  "A client conversation starts the workflow.",
  "Your agent connects the conversation with your agreement.",
  "Your call. Approve, modify, or reject the invoice draft.",
  "Invoice sent. Waiting for the simulated client payment.",
  "Payment confirmed. Your dashboard is up to date.",
];

export function WorkflowDemo() {
  const [stage, setStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [amount, setAmount] = useState(1000);
  const [draftAmount, setDraftAmount] = useState("1000");
  const [editing, setEditing] = useState(false);
  const inputId = useId();
  const reducedMotion = useSyncExternalStore(
    subscribeToMotion,
    getMotionPreference,
    () => true,
  );
  const isPaused = paused || reducedMotion || editing;

  useEffect(() => {
    if (isPaused || stage === 2 || stage === 4) return;
    const timer = window.setTimeout(
      () => setStage((current) => current + 1),
      stage === 3 ? 2200 : 1600,
    );
    return () => window.clearTimeout(timer);
  }, [stage, isPaused]);

  function replay() {
    setStage(0);
    setRejected(false);
    setAmount(1000);
    setDraftAmount("1000");
  }

  return (
    <div
      id="workflow"
      className="workflow-demo scroll-mt-8"
      data-paused={isPaused}
      aria-label="Interactive financial workflow preview"
    >
      <div className="workflow-canvas">
        <svg
          className="workflow-backdrop"
          viewBox="0 0 720 480"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id="ribbon"
              x1="0"
              y1="320"
              x2="720"
              y2="140"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#C4D5FF" stopOpacity="0" />
              <stop offset=".5" stopColor="#D1E0FF" stopOpacity=".7" />
              <stop offset="1" stopColor="#8CC7FF" stopOpacity=".1" />
            </linearGradient>
          </defs>
          <path
            d="M-60 280C80 130 85 440 255 275S550 90 780 230"
            stroke="url(#ribbon)"
            strokeWidth="65"
          />
          <path
            d="M-30 265C85 185 105 370 255 265S560 110 770 210"
            stroke="#A8BEFF"
            strokeWidth="2.5"
            strokeOpacity=".65"
          />
          <path
            d="M-30 275C90 175 105 390 255 285S560 130 770 230"
            stroke="#6F9AFF"
            strokeWidth="2"
            strokeOpacity=".45"
          />
        </svg>
        <svg
          className="workflow-connectors"
          viewBox="0 0 720 480"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <marker
              id="flow-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path
                d="M2 1L8 5L2 9"
                stroke="#3769ED"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </marker>
          </defs>
          <path
            className={cn("flow-path", stage >= 1 && "is-traveled")}
            d="M194 119C235 119 212 164 245 164"
            markerEnd="url(#flow-arrow)"
          />
          <path
            className={cn("flow-path", stage >= 2 && "is-traveled")}
            d="M410 164C440 164 426 135 454 135"
            markerEnd="url(#flow-arrow)"
          />
          <path
            className={cn(
              "flow-path flow-path-solid",
              stage >= 3 && "is-traveled",
            )}
            d="M590 273C590 326 405 270 405 310"
            markerEnd="url(#flow-arrow)"
          />
          <path
            className={cn("flow-path", stage >= 4 && "is-traveled")}
            d="M501 396C520 396 513 412 529 412"
            markerEnd="url(#flow-arrow)"
          />
        </svg>

        <article
          className={cn(
            "workflow-card email-card",
            stage === 0 && "card-active",
          )}
        >
          <div className="flex items-center justify-between">
            <GmailMark className="size-8" />
            <FileText className="size-5 rounded bg-secondary p-0.5 text-[#B8C3D8]" />
          </div>
          <div className="mt-4 flex items-center justify-between gap-1">
            <h2 className="text-[12px] font-semibold">New client email</h2>
            <span className="text-[8px] text-muted-foreground">10:24 AM</span>
          </div>
          <p className="mt-2 text-[12px] leading-[1.8] text-navy/70">
            “We’re happy to proceed with the{" "}
            <span className="font-medium text-navy">$2,500 project.</span> Let’s
            pay <span className="font-medium text-primary">40% upfront.</span>”
          </p>
          <div className="mt-3 space-y-1.5" aria-hidden="true">
            <div className="h-1.5 w-4/5 rounded-full bg-[#E5EAF5]" />
            <div className="h-1.5 w-3/5 rounded-full bg-[#E5EAF5]" />
          </div>
          <p className="mt-3 flex items-center gap-1 text-[9px] text-muted-foreground">
            <FileText className="size-2.5" /> Agreement attached
          </p>
        </article>

        <div className="mobile-flow-arrow" aria-hidden="true">
          <ArrowDown className="size-4" />
        </div>
        <article
          className={cn(
            "workflow-card agent-card",
            stage === 1 && "card-active",
          )}
        >
          <div className="agent-orb mx-auto flex size-11 items-center justify-center rounded-2xl text-white">
            <Bot className="size-7" strokeWidth={1.7} />
          </div>
          <h2 className="mt-3 text-center text-[12px] font-semibold">
            AI agent analyzes
          </h2>
          <div className="mt-4 space-y-2.5">
            {[
              "Extracts deal details",
              "Checks agreement",
              "Prepares invoice draft",
              "Sends to your Slack",
            ].map((label) => (
              <div
                key={label}
                className="flex items-center gap-1.5 text-[10px] text-navy/75"
              >
                <span
                  className={cn(
                    "flex size-3.5 shrink-0 items-center justify-center rounded-full",
                    stage >= 2
                      ? "bg-[#25B992] text-white"
                      : "bg-blue-50 text-primary",
                  )}
                >
                  <Check className="size-2.5" />
                </span>
                {label}
              </div>
            ))}
          </div>
        </article>

        <div className="mobile-flow-arrow" aria-hidden="true">
          <ArrowDown className="size-4" />
        </div>
        <article
          className={cn(
            "workflow-card approval-card",
            stage === 2 && !rejected && "card-active",
            rejected && "card-rejected",
          )}
        >
          <div className="flex items-center gap-2.5">
            <SlackMark className="size-8" />
            <h2 className="text-[11px] font-medium">Approval on Slack</h2>
            <span className="ml-auto text-[8px] text-muted-foreground">
              now
            </span>
          </div>
          <div className="approval-summary mt-3 rounded-lg bg-[#F4F6FC] p-3">
            <h3 className="text-[12px] font-semibold">
              New payment opportunity
            </h3>
            <dl className="mt-2 space-y-1 text-[10px] leading-relaxed text-navy/70">
              <div className="flex gap-1">
                <dt>Client:</dt>
                <dd>Acme Studio</dd>
              </div>
              <div className="flex flex-wrap gap-1">
                <dt>Amount:</dt>
                <dd>
                  <span className="font-semibold text-navy">
                    {formatAmount(amount)}
                  </span>{" "}
                  (upfront)
                </dd>
              </div>
              <div className="flex gap-1">
                <dt>Project total:</dt>
                <dd>$2,500.00</dd>
              </div>
            </dl>
          </div>
          {rejected ? (
            <div className="mt-3">
              <p className="mb-2 text-[10px] text-rose-700">
                Draft rejected. Nothing sent.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-[10px]"
                onClick={() => setRejected(false)}
              >
                Review again
              </Button>
            </div>
          ) : stage >= 3 ? (
            <div className="mt-3 flex min-h-11 items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 text-[10px] font-medium text-emerald-700">
              <ShieldCheck className="size-3.5" /> Approved by you{" "}
              <CheckCheck className="ml-auto size-3.5" />
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-[1.15fr_1fr_1fr] gap-1.5">
              <Button
                disabled={stage !== 2}
                onClick={() => setStage(3)}
                className="bg-[#008E67] px-1 text-[10px] hover:bg-[#007957]"
              >
                Approve
              </Button>
              <Button
                variant="secondary"
                disabled={stage !== 2}
                onClick={() => {
                  setDraftAmount(String(amount));
                  setEditing(true);
                }}
                className="px-1 text-[10px]"
              >
                Modify
              </Button>
              <Button
                variant="outline"
                disabled={stage !== 2}
                onClick={() => setRejected(true)}
                className="border-rose-200 px-1 text-[10px] text-rose-600 hover:bg-rose-50"
              >
                Reject
              </Button>
            </div>
          )}
          <p className="mt-2.5 flex items-center gap-1 text-[9px] text-muted-foreground">
            <LockKeyhole className="size-2.5" /> Nothing moves without your
            approval.
          </p>
        </article>

        <div className="mobile-flow-arrow" aria-hidden="true">
          <ArrowDown className="size-4" />
        </div>
        <article
          className={cn(
            "workflow-card paypal-card",
            stage >= 3 && "card-active",
          )}
        >
          <div className="flex items-center gap-2">
            <PayPalMark className="size-8" />
            <h2 className="text-[12px] font-semibold">PayPal executes</h2>
          </div>
          <div className="mt-3.5 space-y-2">
            {[
              "Invoice sent to client",
              "Client completes payment",
              "Confirmation email sent",
              "Dashboard updated",
            ].map((label, index) => (
              <div
                key={label}
                className="flex items-center gap-1.5 text-[10px] text-navy/70"
              >
                <span
                  className={cn(
                    "flex size-3.5 shrink-0 items-center justify-center rounded-full",
                    (index === 0 ? stage >= 3 : stage === 4)
                      ? "bg-[#25B992] text-white"
                      : "bg-secondary text-[#96A6C4]",
                  )}
                >
                  <Check className="size-2.5" />
                </span>
                {label}
              </div>
            ))}
          </div>
        </article>

        <div className="mobile-flow-arrow" aria-hidden="true">
          <ArrowDown className="size-4" />
        </div>
        <article
          className={cn(
            "workflow-card payment-card",
            stage === 4 && "payment-complete",
          )}
        >
          <div className="flex items-start gap-2.5">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full",
                stage === 4
                  ? "payment-check text-white"
                  : "bg-blue-50 text-primary",
              )}
            >
              {stage === 4 ? (
                <Check className="size-5" />
              ) : (
                <Clock3 className="size-4" />
              )}
            </span>
            <div>
              <h2 className="pt-1 text-[11px] font-semibold">
                {stage === 4 ? "Payment completed" : "Payment tracking"}
              </h2>
              <p className="mt-3 font-mono text-[17px] font-semibold tracking-tight">
                {formatAmount(amount)}
              </p>
              <p className="mt-1 text-[9px] text-muted-foreground">
                {stage === 4
                  ? "Invoice #1042 · Received"
                  : stage === 3
                    ? "Invoice #1042 · Sent"
                    : "Ready when you are"}
              </p>
            </div>
          </div>
        </article>
      </div>

      <div className="workflow-caption">
        <div className="flex min-w-0 items-start gap-2 text-[10px] text-navy/65">
          <span
            className={cn(
              "mt-1 size-1.5 shrink-0 rounded-full",
              stage === 4 ? "bg-emerald-500" : "bg-primary",
            )}
          />
          <p aria-live="polite" aria-atomic="true">
            {rejected
              ? "Draft rejected. No invoice was sent."
              : stageMessages[stage]}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isPaused && (stage < 2 || stage === 3) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px]"
              onClick={() => setStage(stage + 1)}
            >
              {stage === 3 ? "Simulate payment" : "Next step"}
              <ChevronRight className="size-3" />
            </Button>
          )}
          {!reducedMotion && (
            <Button
              variant="ghost"
              size="icon"
              className="size-11 rounded-full text-navy/50"
              aria-label={paused ? "Resume animation" : "Pause animation"}
              onClick={() => setPaused(!paused)}
            >
              {paused ? (
                <Play className="size-3" />
              ) : (
                <Pause className="size-3" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-11 rounded-full text-navy/50"
            aria-label="Replay demo"
            onClick={replay}
          >
            <RotateCcw className="size-3" />
          </Button>
        </div>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modify the demo invoice</DialogTitle>
            <DialogDescription>
              Update the deposit for Acme Studio. This changes sample data only.
            </DialogDescription>
          </DialogHeader>
          <form
            className="mt-2 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              setAmount(Number(draftAmount));
              setEditing(false);
            }}
          >
            <div>
              <label
                htmlFor={inputId}
                className="mb-2 block text-sm font-medium"
              >
                Deposit amount (USD)
              </label>
              <input
                id={inputId}
                type="number"
                min="1"
                max="2500"
                step="0.01"
                required
                value={draftAmount}
                onChange={(event) => setDraftAmount(event.target.value)}
                className="h-12 w-full rounded-lg border border-input bg-white px-3 font-mono text-base"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Between $1 and the $2,500 project total.
              </p>
            </div>
            <Button type="submit" className="w-full">
              Save draft <Check className="size-4" />
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
