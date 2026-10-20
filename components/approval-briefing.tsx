"use client";

import { useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheck,
  FileText,
  Link2,
  RotateCcw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Brand, GmailMark, SlackMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InvoiceDocument } from "@/components/invoice-document";
import { supplierInvoice } from "@/lib/landing-demo";

type Example = "bill" | "invoice";
type DialogView = "bill" | "reminder" | "modify" | null;
const owners = ["Sarah Davis", "Alex Morgan"];
const money = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    amount,
  );

export function ApprovalBriefing() {
  const [example, setExample] = useState<Example>("bill");
  const [owner, setOwner] = useState(owners[0]);
  const [result, setResult] = useState("");
  const [dialog, setDialog] = useState<DialogView>(null);
  const [reminderDate, setReminderDate] = useState("2026-10-23");
  const [amount, setAmount] = useState(1000);
  const [invoiceDecision, setInvoiceDecision] = useState<
    "pending" | "approved" | "rejected"
  >("pending");
  const isBill = example === "bill";
  const invoiceClosed = !isBill && invoiceDecision !== "pending";
  const hasRevisedAmount = !isBill && amount !== 1000;

  function reset(next: Example = example) {
    setExample(next);
    setOwner(owners[0]);
    setResult("");
    setDialog(null);
    setAmount(1000);
    setInvoiceDecision("pending");
    setReminderDate("2026-10-23");
  }

  return (
    <div className="approval-example detailed-briefing">
      <div
        className="briefing-scenario-picker"
        role="group"
        aria-label="Explore two Slack task examples"
      >
        <button
          type="button"
          aria-pressed={isBill}
          onClick={() => reset("bill")}
        >
          A bill to pay
        </button>
        <button
          type="button"
          aria-pressed={!isBill}
          onClick={() => reset("invoice")}
        >
          An invoice to send
        </button>
      </div>
      <div className="briefing-channel">
        <SlackMark className="size-8" />
        <div>
          <strong># finance</strong>
          <span>Example notification · Your workspace</span>
        </div>
        <span className="briefing-new">
          {invoiceClosed
            ? invoiceDecision === "approved"
              ? "Draft approved"
              : "Draft rejected"
            : "New task"}
        </span>
      </div>
      <div className="briefing-agent-heading">
        <Brand compact small />
        <div>
          <strong>
            AssentPay <span>APP</span>
          </strong>
          <small>
            10:24 AM ·{" "}
            {isBill ? "Supplier payment reminder" : "Client agreement accepted"}
          </small>
        </div>
      </div>
      <h3 className="briefing-title">
        {isBill
          ? "A supplier invoice needs your attention."
          : "The client is ready. Send the deposit invoice?"}
      </h3>
      <p className="briefing-description">
        {isBill
          ? "BrightWorks followed up on invoice #2048. The reminder is linked to the existing bill, so it stays one task."
          : "Acme Studio accepted the brand refresh agreement. A deposit invoice has been prepared from the agreed terms."}
      </p>
      <dl className="approval-facts">
        <div>
          <dt>{isBill ? "You owe" : "Proposed invoice"}</dt>
          <dd className="briefing-amount">
            {isBill ? "$480.00" : money(amount)} USD
          </dd>
        </div>
        <div>
          <dt>{isBill ? "Payee" : "Client"}</dt>
          <dd>{isBill ? "BrightWorks · Supplier" : "Acme Studio"}</dd>
        </div>
        <div>
          <dt>
            <CalendarDays className="size-3" aria-hidden="true" />
            {isBill ? "Due date" : "Payment terms"}
          </dt>
          <dd>{isBill ? "Oct 24, 2026" : "40% upfront · $2,500 project"}</dd>
        </div>
        <div>
          <dt>
            <FileText className="size-3" aria-hidden="true" />
            Source
          </dt>
          <dd>
            {isBill ? "Invoice #2048 + reminder" : "Agreement v2 · Page 2"}
          </dd>
        </div>
      </dl>
      <div className="briefing-assignee">
        <label htmlFor="briefing-owner">
          <UserRound className="size-3.5" aria-hidden="true" />
          Assigned owner
        </label>
        <select
          id="briefing-owner"
          value={owner}
          disabled={invoiceClosed}
          onChange={event => {
            setOwner(event.target.value);
            setResult(`Sample task assigned to ${event.target.value}.`);
          }}
        >
          {owners.map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <details className="briefing-source">
        <summary>
          <Link2 className="size-3.5" aria-hidden="true" />
          Read the supporting context
          <ChevronDown className="ml-auto size-3.5" aria-hidden="true" />
        </summary>
        <div>
          <GmailMark className="size-5" />
          <p>
            {isBill
              ? "“A quick reminder: invoice #2048 for the brand asset package is due Oct 24. The total is $480.”"
              : "“We’re happy to proceed with the $2,500 project. Let’s pay 40% upfront.”"}
          </p>
        </div>
        <p>
          {isBill
            ? "Matched to the sample supplier invoice. The bill is awaiting review; no payment is confirmed."
            : "The sample agreement specifies a $1,000 deposit. Any revised amount should be checked against updated terms."}
        </p>
      </details>
      <div className="briefing-suggestion">
        <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
        <p>
          {isBill
            ? "Suggested action: review the bill and payment details. Final payment is confirmed with the provider."
            : hasRevisedAmount
              ? "The amount differs from the agreed deposit. Review the revised terms before proceeding."
              : "Suggested action: review and approve the prepared deposit invoice."}
        </p>
      </div>
      <div className="briefing-actions">
        <Button
          disabled={invoiceClosed}
          onClick={() => {
            if (isBill) setDialog("bill");
            else {
              setInvoiceDecision("approved");
              setResult(
                `Sample invoice for ${money(amount)} approved by ${owner}. No invoice was sent.`,
              );
            }
          }}
        >
          {isBill ? "Review bill" : "Approve draft"}
        </Button>
        <Button
          disabled={invoiceClosed}
          variant="secondary"
          onClick={() => {
            if (isBill) setDialog("reminder");
            else setDialog("modify");
          }}
        >
          {isBill ? "Remind me" : "Modify"}
        </Button>
        <Button
          disabled={invoiceClosed}
          variant="outline"
          onClick={() => {
            if (isBill)
              setResult(
                `Sample bill flagged for clarification. Assigned to ${owner}; payment remains unconfirmed.`,
              );
            else {
              setInvoiceDecision("rejected");
              setResult("Sample invoice rejected. Nothing was sent.");
            }
          }}
        >
          {isBill ? "Flag issue" : "Reject"}
        </Button>
      </div>
      {result && (
        <div
          className="briefing-result"
          data-decision={isBill ? "bill" : invoiceDecision}
          role="status"
        >
          <CircleCheck
            className="mt-0.5 size-3.5 shrink-0"
            aria-hidden="true"
          />
          <p>{result}</p>
        </div>
      )}
      <div className="briefing-preview-note">
        <span>Interactive sample · No messages sent or money moved</span>
        <button
          type="button"
          aria-label="Reset Slack example"
          onClick={() => reset()}
        >
          <RotateCcw className="size-3" aria-hidden="true" />
        </button>
      </div>

      <Dialog
        open={dialog !== null}
        onOpenChange={open => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent
          className={
            dialog === "bill"
              ? "max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-190"
              : "max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
          }
        >
          <DialogHeader>
            <DialogTitle>
              {dialog === "bill"
                ? "Review the supplier bill"
                : dialog === "reminder"
                  ? "Set a sample bill reminder"
                  : "Modify the sample invoice"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "bill"
                ? "Compare the invoice details before continuing to payment."
                : dialog === "reminder"
                  ? "Choose a date in this fictional invoice timeline. No real reminder is sent."
                  : "Changes affect only this example. Check revised amounts against the agreed terms."}
            </DialogDescription>
          </DialogHeader>
          {dialog === "bill" ? (
            <>
              <InvoiceDocument invoice={supplierInvoice} />
              <p className="text-xs text-muted-foreground">
                Task owner: {owner} · Payment not confirmed
              </p>
              <p className="text-xs leading-[1.8] text-muted-foreground">
                In the live product, continue to the original provider invoice
                to confirm a payment. Marking this sample reviewed changes the
                task status only.
              </p>
              <Button
                className="h-11"
                onClick={() => {
                  setResult(
                    `Sample bill reviewed by ${owner}. Provider payment confirmation is still required.`,
                  );
                  setDialog(null);
                }}
              >
                Mark reviewed
                <Check className="size-4" aria-hidden="true" />
              </Button>
            </>
          ) : (
            <form
              className="mt-2 space-y-5"
              onSubmit={event => {
                event.preventDefault();
                const values = new FormData(event.currentTarget);
                if (dialog === "reminder") {
                  const selectedDate = String(values.get("reminderDate"));
                  setReminderDate(selectedDate);
                  const date = new Date(
                    `${selectedDate}T12:00:00Z`,
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  });
                  setResult(
                    `Sample reminder set for ${date}, assigned to ${owner}. No real notification is scheduled.`,
                  );
                } else {
                  const nextAmount = Number(values.get("proposedAmount"));
                  setAmount(nextAmount);
                  setResult(
                    `Sample draft changed to ${money(nextAmount)}. Review the agreed terms before approving.`,
                  );
                }
                setDialog(null);
              }}
            >
              {dialog === "reminder" ? (
                <div>
                  <label
                    htmlFor="bill-reminder-date"
                    className="mb-2 block text-sm font-medium"
                  >
                    Reminder date
                  </label>
                  <input
                    id="bill-reminder-date"
                    type="date"
                    required
                    min="2026-10-19"
                    max="2026-10-24"
                    name="reminderDate"
                    defaultValue={reminderDate}
                    className="h-12 w-full rounded-lg border border-input px-3 text-sm"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Example bill: $480 due Oct 24, 2026.
                  </p>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="briefing-amount"
                    className="mb-2 block text-sm font-medium"
                  >
                    Proposed deposit (USD)
                  </label>
                  <input
                    id="briefing-amount"
                    type="number"
                    required
                    min="1"
                    max="2500"
                    step="0.01"
                    name="proposedAmount"
                    defaultValue={amount}
                    className="h-12 w-full rounded-lg border border-input px-3 font-mono text-base"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Between $1 and the $2,500 project total.
                  </p>
                </div>
              )}
              <Button type="submit" className="h-11 w-full">
                {dialog === "reminder"
                  ? "Save sample reminder"
                  : "Save sample draft"}
                <Check className="size-4" aria-hidden="true" />
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
