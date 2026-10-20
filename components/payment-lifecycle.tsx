"use client";

import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  FileText,
  Link2,
  Maximize2,
  MoreHorizontal,
  UserRound,
} from "lucide-react";
import { Brand, SlackMark } from "@/components/brand";

import { InvoiceDocument } from "@/components/invoice-document";
import { InvoiceSummary } from "@/components/invoice-summary";
import {
  clientInvoice,
  supplierInvoice,
  invoiceSubtotal,
  formatDemoMoney,
} from "@/lib/landing-demo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import styles from "./payment-artifacts.module.css";

type Direction = "incoming" | "outgoing";

const flows = {
  incoming: {
    party: "Acme Studio",
    relationship: "Client · Money coming in",
    reference: "#1042",
    item: "Brand refresh deposit",
    total: "$1,000",
    due: "On acceptance",
    stages: [
      {
        label: "Draft",
        status: "Ready for approval",
        received: "$0",
        balance: "$1,000",
        title: "Prepare the invoice from the agreement.",
        detail:
          "The agreed 40% deposit becomes a $1,000 invoice draft, with the client, calculation, and source terms attached.",
        action: "Sarah reviews the draft in Slack before it’s sent.",
      },
      {
        label: "Sent",
        status: "Awaiting client payment",
        received: "$0",
        balance: "$1,000",
        title: "Send after the owner approves.",
        detail:
          "The client receives an invoice with a PayPal payment page. Your workspace keeps the invoice and outstanding amount connected.",
        action: "Track the due amount and prepare a follow-up when needed.",
      },
      {
        label: "Partially paid",
        status: "Partial payment received",
        received: "$400",
        balance: "$600",
        title: "Follow up on what’s still owed.",
        detail:
          "A partial payment reduces the open balance. The proposed reminder uses the remaining amount and the latest conversation.",
        action: "Review a reminder for the remaining $600.",
      },
      {
        label: "Paid",
        status: "Payment confirmed",
        received: "$1,000",
        balance: "$0",
        title: "Connect the payment to the deal.",
        detail:
          "Match the payment confirmation to the invoice, retain the receipt, and update the client’s transaction history.",
        action: "Reconcile the payment and notify the team in Slack.",
      },
    ],
  },
  outgoing: {
    party: "BrightWorks",
    relationship: "Supplier · Money going out",
    reference: "#2048",
    item: "Brand asset package",
    total: "$480",
    due: "Oct 24, 2026",
    stages: [
      {
        label: "Received",
        status: "Bill needs review",
        received: "$0",
        balance: "$480",
        title: "Catch the bill before it gets buried.",
        detail:
          "An invoice or payment reminder arrives by email. Your agent identifies the supplier, amount, due date, and whether the bill already exists.",
        action: "Review invoice #2048 and the linked reminder.",
      },
      {
        label: "Assigned",
        status: "Assigned to Sarah",
        received: "$0",
        balance: "$480",
        title: "Give the task a clear owner.",
        detail:
          "A Slack briefing brings together the $480 amount, Oct 24 due date, original invoice, and suggested next actions.",
        action: "Sarah reviews the bill, sets a reminder, or flags a question.",
      },
      {
        label: "Ready to pay",
        status: "Provider confirmation needed",
        received: "$0",
        balance: "$480",
        title: "Review first. Confirm with the provider.",
        detail:
          "After checking the bill, continue to the original provider’s payment page to review and confirm the payment yourself.",
        action: "Open the provider invoice and confirm the payment there.",
      },
      {
        label: "Paid",
        status: "Bill settled · Sample",
        received: "$480",
        balance: "$0",
        title: "Match the receipt and close the bill.",
        detail:
          "Connect the receipt and available provider payment status to the bill, then update the supplier history and notify the team.",
        action: "Reconcile the outgoing payment and retain the evidence.",
      },
    ],
  },
};

export function PaymentLifecycle() {
  const [direction, setDirection] = useState<Direction>("incoming");
  const [selected, setSelected] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const flow = flows[direction];
  const stage = flow.stages[selected];
  const outgoing = direction === "outgoing";
  const invoice = outgoing ? supplierInvoice : clientInvoice;
  const paid =
    selected === 3
      ? invoiceSubtotal(invoice)
      : !outgoing && selected === 2
        ? 400
        : 0;
  const invoiceStatus =
    selected === 3
      ? "Paid"
      : outgoing
        ? "Unpaid"
        : selected === 2
          ? "Partially paid"
          : selected === 1
            ? "Sent"
            : "Draft";

  function selectDirection(next: Direction) {
    setDirection(next);
    setSelected(0);
  }

  return (
    <div className="payment-lifecycle">
      <div
        className="payment-direction-picker"
        role="group"
        aria-label="Explore incoming or outgoing payments"
      >
        <button
          type="button"
          aria-pressed={!outgoing}
          onClick={() => selectDirection("incoming")}
        >
          <ArrowDownLeft aria-hidden="true" />
          <span>
            <strong>Get paid by clients</strong>
            <small>Invoices you send · Money coming in</small>
          </span>
        </button>
        <button
          type="button"
          aria-pressed={outgoing}
          onClick={() => selectDirection("outgoing")}
        >
          <ArrowUpRight aria-hidden="true" />
          <span>
            <strong>Manage bills you owe</strong>
            <small>Invoices you receive · Money going out</small>
          </span>
        </button>
      </div>
      <div
        className="lifecycle-steps"
        role="group"
        aria-label={`${outgoing ? "Supplier bill" : "Client invoice"} example stages`}
      >
        {flow.stages.map((item, index) => (
          <button
            type="button"
            key={item.label}
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
            className={selected === index ? "is-current" : ""}
          >
            <span aria-hidden="true">
              {index < selected ? <Check className="size-3" /> : index + 1}
            </span>
            {item.label}
          </button>
        ))}
      </div>
      <div className={styles.flowCopy} aria-live="polite">
        <span>
          {outgoing ? "Payables" : "Receivables"} · Step {selected + 1} of 4
        </span>
        <h3>{stage.title}</h3>
        <p>{stage.detail}</p>
      </div>
      <div
        className={styles.flowLayout}
        data-payment-content
        aria-live="polite"
        aria-atomic="true"
      >
        <div className={styles.invoiceViewer}>
          <div className={styles.viewerToolbar}>
            <span>
              <FileText size={14} aria-hidden="true" />
              Invoice_{invoice.number}.pdf
            </span>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              aria-label="Expand invoice preview"
            >
              <Maximize2 size={13} aria-hidden="true" />
              <span>Expand</span>
            </button>
          </div>
          <div className={styles.paperMat}>
            <InvoiceSummary
              invoice={invoice}
              paid={paid}
              status={invoiceStatus}
            />
          </div>
        </div>
        <article
          className={styles.slackCard}
          aria-label="Slack payment notification preview"
        >
          <header className={styles.slackHeader}>
            <SlackMark className="size-6" />
            <strong># finance</strong>
            <MoreHorizontal size={17} aria-hidden="true" />
          </header>
          <div className={styles.slackBody}>
            <div className={styles.agent}>
              <Brand compact small />
              <div>
                <strong>
                  AssentPay <span>APP</span>
                </strong>
                <small>{selected === 3 ? "9:16 AM" : "10:24 AM"}</small>
              </div>
            </div>
            <div className={styles.slackMessage}>
              <span className={styles.taskTag}>
                {outgoing ? "MONEY GOING OUT" : "MONEY COMING IN"}
              </span>
              <h4>{stage.status}</h4>
              <p>{stage.action}</p>
              <dl className={styles.slackFacts}>
                <div>
                  <dt>{outgoing ? "Supplier" : "Client"}</dt>
                  <dd>{flow.party}</dd>
                </div>
                <div>
                  <dt>{selected === 3 ? "Payment matched" : "Amount due"}</dt>
                  <dd>
                    {formatDemoMoney(
                      selected === 3 ? paid : invoiceSubtotal(invoice) - paid,
                    )}{" "}
                    USD
                  </dd>
                </div>
                <div>
                  <dt>Invoice</dt>
                  <dd>#{invoice.number}</dd>
                </div>
                <div>
                  <dt>{selected === 3 ? "Status" : "Due date"}</dt>
                  <dd>{selected === 3 ? "Paid in full" : invoice.due}</dd>
                </div>
              </dl>
              <button
                type="button"
                className={styles.sourceLink}
                onClick={() => setExpanded(true)}
              >
                <Link2 size={12} aria-hidden="true" />
                Invoice_{invoice.number}.pdf{" "}
                <ArrowRight size={11} aria-hidden="true" />
              </button>
              <div className={styles.assignee}>
                <UserRound size={12} aria-hidden="true" />
                Assigned to Sarah Davis
              </div>
            </div>
            <div className={styles.slackActions}>
              <button type="button" onClick={() => setExpanded(true)}>
                {selected === 3
                  ? "View paid invoice"
                  : outgoing
                    ? "Review bill"
                    : selected === 0
                      ? "Review draft"
                      : "View invoice"}
              </button>
              <button type="button" disabled title="Illustrative action only">
                {selected === 3 ? "View activity" : "More actions"}
                <ArrowRight size={12} aria-hidden="true" />
              </button>
            </div>
          </div>
          <footer className={styles.slackFooter}>
            <span />
            <span>Example Slack notification · You stay in control</span>
          </footer>
        </article>
      </div>
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-200">
          <DialogHeader>
            <DialogTitle>
              Invoice #{invoice.number} — {invoice.merchant.business}
            </DialogTitle>
            <DialogDescription>
              Detailed illustration based on PayPal’s invoice template. This is
              sample data, not a live invoice.
            </DialogDescription>
          </DialogHeader>
          <InvoiceDocument
            invoice={invoice}
            paid={paid}
            status={invoiceStatus}
          />
        </DialogContent>
      </Dialog>
      <p className="mt-5 text-[10px] leading-relaxed text-[#6b7b92]">
        Interactive examples · No invoices are sent and no money is moved.
        Choosing a stage only changes the illustration.
      </p>
    </div>
  );
}
