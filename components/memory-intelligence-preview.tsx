"use client";

import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpenText,
  Check,
  ChevronRight,
  FileText,
  Link2,
  Mail,
  Maximize2,
  Paperclip,
  ReceiptText,
  Sparkles,
} from "lucide-react";
import { GmailMark, PayPalMark } from "@/components/brand";
import { InvoiceDocument } from "@/components/invoice-document";
import { InvoiceSummary } from "@/components/invoice-summary";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  client,
  clientInvoice,
  formatDemoMoney,
  invoiceSubtotal,
  paymentRecord,
  project,
  studio,
  supplier,
  supplierInvoice,
} from "@/lib/landing-demo";
import styles from "./memory-artifacts.module.css";

const sources = [
  {
    label: "Agreement",
    icon: FileText,
    filename: "Acme_Brand_Refresh_SOW_v2.pdf",
    kind: "PDF document",
    meta: "4 pages · 184 KB",
    status: "Terms extracted",
    title: "The payment terms, with their source.",
    note: "The deposit and final balance come from section 2 of the agreement. Client acceptance is a separate piece of evidence.",
    action: "Check acceptance before preparing the deposit invoice.",
    record: "AGR-2026-118",
    date: "Oct 16, 2026 · 14:08 UTC",
  },
  {
    label: "Client message",
    icon: Mail,
    filename: "Re: Brand refresh proposal — approved",
    kind: "Email thread",
    meta: "3 messages · 1 attachment",
    status: "Acceptance linked",
    title: "A go-ahead tied to the agreed terms.",
    note: "James’s reply accepts the $2,500 scope and $1,000 deposit. The reply, document version, and proposed invoice stay linked.",
    action: "Prepare invoice #1042 for Sarah to review.",
    record: "THREAD-0086",
    date: "Oct 19, 2026 · 10:24 UTC",
  },
  {
    label: "Payment record",
    icon: ReceiptText,
    filename: "Payment confirmation · Invoice #1042",
    kind: "Transaction record",
    meta: "PayPal confirmation · Matched",
    status: "Deposit reconciled",
    title: "Invoice settled. Project balance still tracked.",
    note: "The $1,000 deposit invoice is fully paid. The remaining $1,500 belongs to the project’s final milestone, not this invoice.",
    action: "Retain the receipt and keep the final milestone open.",
    record: "TXN-2026-1042",
    date: paymentRecord.date,
  },
  {
    label: "Supplier bill",
    icon: FileText,
    filename: "BrightWorks_Invoice_2048.pdf",
    kind: "Invoice + email",
    meta: "1 invoice · 1 linked reminder",
    status: "Review required",
    title: "One bill, even when a reminder follows.",
    note: "The reminder repeats invoice #2048, the $480 amount, and the Oct 24 due date. It is linked to the original bill instead of becoming a second obligation.",
    action: "Sarah reviews the supplier bill before payment.",
    record: "BILL-2026-2048",
    date: "Oct 19, 2026 · 10:26 UTC",
  },
];

type Fact = { field: string; value: string; evidence: string; source?: number };
function getFacts(index: number): Fact[] {
  if (index === 3)
    return [
      {
        field: "Invoice",
        value: "#2048 · PO-2026-028",
        evidence: "Invoice",
        source: 3,
      },
      {
        field: "Amount due",
        value: `${formatDemoMoney(invoiceSubtotal(supplierInvoice))} USD`,
        evidence: "Invoice",
        source: 3,
      },
      {
        field: "Due date",
        value: supplierInvoice.due,
        evidence: "Invoice",
        source: 3,
      },
      {
        field: "Reminder",
        value: "Matched · Oct 19, 10:24",
        evidence: "Email",
        source: 3,
      },
      {
        field: "Task owner",
        value: "Sarah Davis · Owner",
        evidence: "Workspace rule",
      },
    ];
  if (index === 2)
    return [
      {
        field: "Invoice",
        value: "#1042 · Deposit",
        evidence: "Receipt",
        source: 2,
      },
      {
        field: "Amount received",
        value: "$1,000.00 USD",
        evidence: "Receipt",
        source: 2,
      },
      {
        field: "Invoice balance",
        value: "$0.00 · Paid in full",
        evidence: "Receipt",
        source: 2,
      },
      {
        field: "Project balance",
        value: "$1,500.00 · Due Nov 6",
        evidence: "SOW §2",
        source: 0,
      },
      {
        field: "Transaction",
        value: paymentRecord.reference,
        evidence: "Receipt",
        source: 2,
      },
    ];
  return [
    {
      field: "Project value",
      value: "$2,500.00 USD",
      evidence: "SOW §2",
      source: 0,
    },
    {
      field: "Deposit",
      value: "40% · $1,000.00",
      evidence: "SOW §2",
      source: 0,
    },
    {
      field: "Deposit due",
      value: clientInvoice.due,
      evidence: index === 1 ? "Email" : "SOW §2",
      source: index,
    },
    {
      field: "Final milestone",
      value: "$1,500.00 · Nov 6",
      evidence: "SOW §2",
      source: 0,
    },
    index === 1
      ? {
          field: "Acceptance",
          value: "James Lee · Oct 19",
          evidence: "Reply",
          source: 1,
        }
      : {
          field: "Agreement",
          value: "AGR-2026-118 · v2.0",
          evidence: "Document",
          source: 0,
        },
  ];
}

function StatementOfWork() {
  return (
    <article
      className={styles.sow}
      aria-label="Sample statement of work for Acme Studio"
    >
      <div className={styles.sowLetterhead}>
        <span>NC</span>
        <strong>{studio.business}</strong>
        <small>PROJECT SERVICES</small>
      </div>
      <p className={styles.documentOverline}>
        STATEMENT OF WORK / {project.agreement}
      </p>
      <h3>
        Acme Studio
        <br />
        Brand refresh
      </h3>
      <p className={styles.sowSubtitle}>
        Version {project.version} · Issued {project.issued}
      </p>
      <div className={styles.sowParties}>
        <div>
          <small>PREPARED FOR</small>
          <strong>{client.business}</strong>
          <span>{client.contact} · Marketing lead</span>
          <span>{client.email}</span>
        </div>
        <div>
          <small>PREPARED BY</small>
          <strong>{studio.business}</strong>
          <span>{studio.contact} · Creative director</span>
          <span>{studio.email}</span>
        </div>
      </div>
      <section className={styles.sowSection}>
        <h4>01 / Scope &amp; deliverables</h4>
        <p>
          A refreshed visual identity for Acme Studio, including discovery, a
          primary logo suite, and practical brand guidelines for launch.
        </p>
        <div className={styles.scopeList}>
          {project.scope.map(item => (
            <div key={item.name}>
              <span>{item.name}</span>
              <strong>{formatDemoMoney(item.amount)}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className={styles.sowSection}>
        <h4>02 / Fees &amp; payment schedule</h4>
        <p>
          Total project fee: <mark>$2,500.00 USD</mark>. The deposit is payable
          before the Oct 21 kickoff. The final balance is due on delivery.
        </p>
        <table className={styles.schedule}>
          <caption className="sr-only">Project payment milestones</caption>
          <thead>
            <tr>
              <th>Milestone</th>
              <th>Amount</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <mark>Upfront deposit · 40%</mark>
              </td>
              <td>
                <mark>$1,000.00</mark>
              </td>
              <td>Oct 21, 2026</td>
            </tr>
            <tr>
              <td>Final delivery · 60%</td>
              <td>$1,500.00</td>
              <td>Nov 6, 2026</td>
            </tr>
          </tbody>
        </table>
      </section>
      <section className={styles.sowSection}>
        <h4>03 / Delivery &amp; acceptance</h4>
        <p>
          Final source files and the brand guide are scheduled for Nov 6, 2026.
          Client acceptance is recorded separately in the proposal email thread.
        </p>
      </section>
      <footer className={styles.documentFooter}>
        <span>
          {project.agreement} · v{project.version}
        </span>
        <span>Illustrative excerpt · Page 2 of 4</span>
      </footer>
    </article>
  );
}

function ClientEmail({ onOpenAgreement }: { onOpenAgreement: () => void }) {
  return (
    <article
      className={styles.email}
      aria-label="Sample client acceptance email"
    >
      <div className={styles.emailApp}>
        <GmailMark className="size-5" />
        <span>Client conversation</span>
        <span>3 messages</span>
      </div>
      <h3>
        Re: Brand refresh proposal — approved <span>Inbox</span>
      </h3>
      <div className={styles.emailSender}>
        <span className={styles.senderAvatar}>JL</span>
        <div>
          <strong>{client.contact}</strong>
          <span>&lt;{client.email}&gt;</span>
          <small>
            to {studio.contact} &lt;{studio.email}&gt;
          </small>
        </div>
      </div>
      <time className={styles.emailDate}>Oct 19, 2026, 10:24 UTC</time>
      <div className={styles.emailBody}>
        <p>Hi Sarah,</p>
        <p>
          I’ve reviewed the updated statement of work{" "}
          <strong>AGR-2026-118, version 2</strong>. We’re{" "}
          <mark>happy to proceed with the $2,500 brand refresh</mark>.
        </p>
        <p>
          The <mark>40% upfront deposit ($1,000)</mark> works for us. Please
          send the deposit invoice to me and we’ll arrange payment before the{" "}
          <mark>Oct 21 kickoff</mark>.
        </p>
        <p>
          We’ve also noted the remaining $1,500 is due on final delivery, Nov 6.
        </p>
        <p>
          Thanks,
          <br />
          <strong>James Lee</strong>
          <br />
          <span>Marketing Lead · Acme Studio</span>
        </p>
      </div>
      <button
        type="button"
        className={styles.emailAttachment}
        onClick={onOpenAgreement}
      >
        <span className={styles.pdfBadge}>PDF</span>
        <span>
          <strong>Acme_Brand_Refresh_SOW_v2.pdf</strong>
          <small>184 KB · 4 pages · Open document</small>
        </span>
        <ChevronRight size={14} aria-hidden="true" />
      </button>
      <details className={styles.quotedEmail}>
        <summary>Show quoted proposal</summary>
        <p>
          On Oct 16, 2026, Sarah Davis wrote:
          <br />
          “Attached is SOW v2. The project is $2,500 with a 40% deposit, and
          final delivery is scheduled for Nov 6.”
        </p>
      </details>
    </article>
  );
}

function PaymentReceipt() {
  return (
    <article
      className={styles.receipt}
      aria-label="Sample payment transaction record"
    >
      <div className={styles.receiptProvider}>
        <PayPalMark className="size-7" />
        <div>
          <strong>PayPal payment</strong>
          <span>Imported confirmation · AssentPay record</span>
        </div>
        <span className={styles.completed}>
          <Check size={10} aria-hidden="true" />
          Completed
        </span>
      </div>
      <p className={styles.documentOverline}>PAYMENT RECEIVED</p>
      <h3>
        {formatDemoMoney(paymentRecord.amount)} <span>USD</span>
      </h3>
      <p className={styles.receiptDate}>{paymentRecord.date}</p>
      <div className={styles.receiptParties}>
        <div>
          <small>PAID BY</small>
          <strong>{client.contact}</strong>
          <span>{client.business}</span>
          <span>{client.email}</span>
        </div>
        <ArrowRight size={17} aria-hidden="true" />
        <div>
          <small>RECEIVED BY</small>
          <strong>{studio.business}</strong>
          <span>{studio.contact}</span>
          <span>{studio.email}</span>
        </div>
      </div>
      <dl className={styles.transactionFacts}>
        <div>
          <dt>Transaction reference</dt>
          <dd>{paymentRecord.reference}</dd>
        </div>
        <div>
          <dt>Invoice</dt>
          <dd>#1042 · Brand refresh deposit</dd>
        </div>
        <div>
          <dt>Payment type</dt>
          <dd>Invoice payment</dd>
        </div>
        <div>
          <dt>Invoice total</dt>
          <dd>$1,000.00 USD</dd>
        </div>
        <div>
          <dt>Amount received</dt>
          <dd>$1,000.00 USD</dd>
        </div>
        <div>
          <dt>Invoice amount due</dt>
          <dd>$0.00 USD</dd>
        </div>
      </dl>
      <div className={styles.receiptMatch}>
        <Link2 size={15} aria-hidden="true" />
        <div>
          <strong>Matched to invoice #1042</strong>
          <p>
            Payer, invoice reference, currency, and amount agree with the sample
            invoice.
          </p>
        </div>
      </div>
      <footer className={styles.documentFooter}>
        <span>Transaction record · Fictional reference</span>
        <span>Project {project.agreement}</span>
      </footer>
    </article>
  );
}

function SupplierReminder() {
  return (
    <article
      className={styles.reminder}
      aria-label="Sample supplier invoice reminder email"
    >
      <GmailMark className="size-5" />
      <div>
        <strong>Re: Invoice #2048 · Payment reminder</strong>
        <span>
          {supplier.contact} &lt;{supplier.email}&gt; · Oct 19, 10:24 UTC
        </span>
        <p>
          Hi Sarah, a quick reminder that <mark>invoice #2048 for $480.00</mark>{" "}
          is due <mark>Oct 24</mark>. Please find the original invoice attached.
          Thank you, Nina.
        </p>
        <small>
          <Paperclip size={11} aria-hidden="true" />
          BrightWorks_Invoice_2048.pdf · 92 KB
        </small>
      </div>
    </article>
  );
}

function SourceArtifact({
  index,
  onOpenAgreement,
  showReminder = false,
}: {
  index: number;
  onOpenAgreement: () => void;
  showReminder?: boolean;
}) {
  if (index === 0) return <StatementOfWork />;
  if (index === 1) return <ClientEmail onOpenAgreement={onOpenAgreement} />;
  if (index === 2) return <PaymentReceipt />;
  return (
    <div className={styles.supplierArtifacts}>
      <InvoiceDocument invoice={supplierInvoice} />
      <details className={styles.reminderDrawer} open={showReminder}>
        <summary>
          <Mail size={13} aria-hidden="true" />
          <span>Linked reminder email · Oct 19, 10:24 UTC</span>
          <ChevronRight size={13} aria-hidden="true" />
        </summary>
        <SupplierReminder />
      </details>
    </div>
  );
}

function SourceSummary({
  index,
  onOpenAgreement,
  onExpand,
}: {
  index: number;
  onOpenAgreement: () => void;
  onExpand: () => void;
}) {
  if (index === 3)
    return (
      <div className={styles.compactSupplier}>
        <InvoiceSummary invoice={supplierInvoice} />
        <button
          type="button"
          className={styles.linkedReminder}
          onClick={onExpand}
        >
          <GmailMark className="size-4" />
          <span>Reminder matched to invoice #2048</span>
          <ChevronRight size={13} aria-hidden="true" />
        </button>
      </div>
    );
  if (index === 2)
    return (
      <article
        className={styles.sourceExcerpt}
        aria-label="Payment record excerpt"
      >
        <header>
          <PayPalMark className="size-6" />
          <strong>Payment matched</strong>
          <span className={styles.excerptBadge}>
            <Check size={10} aria-hidden="true" />
            Completed
          </span>
        </header>
        <p className={styles.excerptOverline}>RECEIVED FROM ACME STUDIO</p>
        <h3 className={styles.receivedAmount}>
          $1,000.00 <span>USD</span>
        </h3>
        <p className={styles.excerptMuted}>Oct 20, 2026 · 09:16 UTC</p>
        <dl className={styles.excerptFacts}>
          <div>
            <dt>Invoice</dt>
            <dd>#1042 · Brand refresh deposit</dd>
          </div>
          <div>
            <dt>Invoice balance</dt>
            <dd>$0.00 · Paid in full</dd>
          </div>
          <div>
            <dt>Project balance</dt>
            <dd>$1,500.00 · Due Nov 6</dd>
          </div>
        </dl>
        <footer>
          <Link2 size={12} aria-hidden="true" />
          {paymentRecord.reference} · AssentPay record
        </footer>
      </article>
    );
  if (index === 1)
    return (
      <article
        className={styles.sourceExcerpt}
        aria-label="Client email excerpt"
      >
        <header>
          <GmailMark className="size-5" />
          <strong>Re: Brand refresh proposal</strong>
          <span className={styles.excerptBadge}>Inbox</span>
        </header>
        <div className={styles.excerptSender}>
          <span>JL</span>
          <div>
            <strong>
              James Lee <small>· Acme Studio</small>
            </strong>
            <span>To Sarah Davis · Oct 19, 10:24 AM</span>
          </div>
        </div>
        <div className={styles.excerptBody}>
          <p>Hi Sarah,</p>
          <p>
            We’re <mark>happy to proceed with the $2,500 brand refresh.</mark>{" "}
            The <mark>40% deposit ($1,000)</mark> works for us.
          </p>
          <p>
            Please send the invoice. We’ll arrange payment before the{" "}
            <mark>Oct 21 kickoff.</mark>
          </p>
          <p>Thanks, James</p>
        </div>
        <button
          type="button"
          className={styles.compactAttachment}
          onClick={onOpenAgreement}
        >
          <FileText size={14} aria-hidden="true" />
          <span>
            SOW_v2.pdf <small>184 KB · 4 pages</small>
          </span>
          <ChevronRight size={12} aria-hidden="true" />
        </button>
        <footer>Excerpt · 3 messages in the full thread</footer>
      </article>
    );
  return (
    <article
      className={styles.sourceExcerpt}
      aria-label="Agreement payment terms excerpt"
    >
      <header>
        <span className={styles.excerptMonogram}>NC</span>
        <strong>Northline Creative</strong>
        <span className={styles.excerptBadge}>SOW v2</span>
      </header>
      <p className={styles.excerptOverline}>
        {project.agreement} · PAYMENT TERMS
      </p>
      <h3>Acme Studio / Brand refresh</h3>
      <div className={styles.clause}>
        <span>02 / Fees &amp; payment schedule</span>
        <p>
          Total project fee: <mark>$2,500.00 USD.</mark> A{" "}
          <mark>40% deposit</mark> is payable before kickoff. The balance is due
          on final delivery.
        </p>
      </div>
      <dl className={styles.excerptFacts}>
        <div>
          <dt>Deposit · Oct 21</dt>
          <dd>$1,000.00</dd>
        </div>
        <div>
          <dt>Final delivery · Nov 6</dt>
          <dd>$1,500.00</dd>
        </div>
      </dl>
      <footer>
        <FileText size={12} aria-hidden="true" />
        Payment terms excerpt · Page 2 of 4
      </footer>
    </article>
  );
}

export function MemoryIntelligencePreview() {
  const [selected, setSelected] = useState(3);
  const [expanded, setExpanded] = useState(false);
  const source = sources[selected];
  const isSupplier = selected === 3;
  const party = isSupplier ? supplier : client;
  const facts = getFacts(selected);
  function openEvidence(fact: Fact) {
    if (fact.source === undefined) return;
    if (fact.source === selected) setExpanded(true);
    else setSelected(fact.source);
  }
  return (
    <div className={styles.studio}>
      <div className={styles.toolbar}>
        <div
          className={styles.sourcePicker}
          role="group"
          aria-label="Explore how different sources update deal memory"
        >
          {sources.map(({ label, icon: Icon }, index) => (
            <button
              type="button"
              key={label}
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <span className={styles.exampleLabel}>ILLUSTRATIVE WORKSPACE</span>
      </div>
      <div className={styles.stage}>
        <div className={styles.input}>
          <p className={styles.columnLabel}>01 / ORIGINAL SOURCE</p>
          <div className={styles.sourceViewer}>
            <div className={styles.viewerToolbar}>
              <span>
                <FileText size={14} aria-hidden="true" />
                {source.kind}
              </span>
              <button
                type="button"
                aria-label="Expand source document"
                onClick={() => setExpanded(true)}
              >
                <Maximize2 size={13} aria-hidden="true" />
                <span>Expand</span>
              </button>
            </div>
            <div
              className={styles.artifactMat}
              aria-live="polite"
              aria-atomic="true"
            >
              <SourceSummary
                index={selected}
                onOpenAgreement={() => setSelected(0)}
                onExpand={() => setExpanded(true)}
              />
            </div>
          </div>
        </div>
        <div className={styles.connector} aria-hidden="true">
          <span />
          <i>
            <Sparkles size={15} />
          </i>
          <span />
          <ArrowRight size={10} />
        </div>
        <div className={styles.output}>
          <p className={styles.columnLabel}>
            02 / ASSENTPAY’S CONNECTED RECORD
          </p>
          <div className={styles.record} aria-live="polite" aria-atomic="true">
            <div className={styles.recordChrome}>
              <BookOpenText size={14} aria-hidden="true" />
              <span>RELATIONSHIP MEMORY</span>
              <span>{source.record}</span>
            </div>
            <div className={styles.recordProfile}>
              <span className={styles.avatar}>{party.initials}</span>
              <div>
                <strong>{party.business}</strong>
                <span>
                  {party.contact} · {isSupplier ? "Supplier" : "Client"}
                </span>
              </div>
            </div>
            <div className={styles.direction}>
              {isSupplier ? (
                <ArrowUpRight size={13} aria-hidden="true" />
              ) : (
                <ArrowDownLeft size={13} aria-hidden="true" />
              )}
              {isSupplier
                ? "PAYABLE · MONEY GOING OUT"
                : "RECEIVABLE · MONEY COMING IN"}
              <span>{source.status}</span>
            </div>
            <div className={styles.fieldHeader} aria-hidden="true">
              <span>EXTRACTED FIELD</span>
              <span>VALUE</span>
              <span>EVIDENCE</span>
            </div>
            <dl className={styles.fields}>
              {facts.map(fact => (
                <div key={fact.field}>
                  <dt>{fact.field}</dt>
                  <dd>{fact.value}</dd>
                  <dd>
                    {fact.source !== undefined ? (
                      <button
                        type="button"
                        onClick={() => openEvidence(fact)}
                        aria-label={`View source for ${fact.field}: ${fact.evidence}`}
                      >
                        <Link2 size={10} aria-hidden="true" />
                        {fact.evidence}
                      </button>
                    ) : (
                      <span className={styles.ruleLabel}>{fact.evidence}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <div className={styles.observation}>
              <span>
                <Sparkles size={12} aria-hidden="true" />
                {facts.length} fields connected
              </span>
              <h3>{source.title}</h3>
              <p>{source.note}</p>
            </div>
            <footer className={styles.recordFooter}>
              <span>
                <Check size={12} aria-hidden="true" />
                {source.action}
              </span>
            </footer>
          </div>
        </div>
      </div>
      <div className={styles.caption}>
        <span>Example timeline: Oct 16–24, 2026</span>
        <p>Fictional parties and records · No live financial data</p>
      </div>
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-200">
          <DialogHeader>
            <DialogTitle>{source.filename}</DialogTitle>
            <DialogDescription>
              Full sample source. Business details, messages, and payment
              records are fictional.
            </DialogDescription>
          </DialogHeader>
          <SourceArtifact
            index={selected}
            onOpenAgreement={() => setSelected(0)}
            showReminder
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
