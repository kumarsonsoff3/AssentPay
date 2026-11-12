import Image from "next/image";
import { Check } from "@/components/icons";
import {
  type DemoInvoice,
  formatDemoMoney,
  invoiceSubtotal,
} from "@/lib/landing-demo";
import styles from "./invoice-document.module.css";

export function InvoiceDocument({
  invoice,
  paid = 0,
  status = "Unpaid",
}: {
  invoice: DemoInvoice;
  paid?: number;
  status?: "Draft" | "Sent" | "Unpaid" | "Partially paid" | "Paid";
}) {
  const total = invoiceSubtotal(invoice);
  const amountDue = Math.max(0, total - paid);
  return (
    <article
      className={styles.invoice}
      aria-label={`Illustrative invoice ${invoice.number} from ${invoice.merchant.business}`}
    >
      <header className={styles.header}>
        <div className={styles.merchant}>
          <span className={styles.merchantLogo} aria-hidden="true">
            {invoice.merchant.initials}
          </span>
          <strong>{invoice.merchant.business}</strong>
          <span>{invoice.merchant.contact}</span>
          <span>{invoice.merchant.email}</span>
          <span>{invoice.merchant.location}</span>
        </div>
        <div className={styles.invoiceIdentity}>
          <h3>Invoice</h3>
          <span>#{invoice.number}</span>
          <span className={styles.status} data-paid={status === "Paid"}>
            {status === "Paid" && <Check size={10} aria-hidden="true" />}
            {status}
          </span>
        </div>
      </header>
      <div className={styles.parties}>
        <div className={styles.billTo}>
          <h4>Bill To</h4>
          <strong>{invoice.customer.business}</strong>
          <span>{invoice.customer.contact}</span>
          <span>{invoice.customer.email}</span>
          <span>{invoice.customer.location}</span>
        </div>
        <dl className={styles.dates}>
          <div>
            <dt>Invoice date</dt>
            <dd>{invoice.issued}</dd>
          </div>
          <div>
            <dt>Payment due</dt>
            <dd>{invoice.due}</dd>
          </div>
          <div>
            <dt>Reference</dt>
            <dd>{invoice.reference}</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>USD</dd>
          </div>
        </dl>
      </div>
      <table className={styles.items}>
        <caption className="sr-only">
          Invoice {invoice.number} itemized services in US dollars
        </caption>
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map(item => (
            <tr key={item.name}>
              <td>
                <strong>{item.name}</strong>
                <span>{item.description}</span>
              </td>
              <td data-label="Qty">{item.quantity}</td>
              <td data-label="Price">{formatDemoMoney(item.price)}</td>
              <td data-label="Amount">
                {formatDemoMoney(item.quantity * item.price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.bottom}>
        <div className={styles.notes}>
          <h4>Note to recipient</h4>
          <p>{invoice.note}</p>
        </div>
        <dl className={styles.totals}>
          <div>
            <dt>Subtotal</dt>
            <dd>{formatDemoMoney(total)}</dd>
          </div>
          <div>
            <dt>Tax</dt>
            <dd>$0.00</dd>
          </div>
          <div className={styles.total}>
            <dt>Total</dt>
            <dd>{formatDemoMoney(total)}</dd>
          </div>
          {paid > 0 && (
            <div>
              <dt>Amount paid</dt>
              <dd>−{formatDemoMoney(paid)}</dd>
            </div>
          )}
          <div className={styles.amountDue}>
            <dt>
              Amount due <span>(USD)</span>
            </dt>
            <dd>{formatDemoMoney(amountDue)}</dd>
          </div>
        </dl>
      </div>
      <div className={styles.terms}>
        <h4>Terms and conditions</h4>
        <p>{invoice.terms}</p>
      </div>
      <footer className={styles.footer}>
        <Image
          src="/integrations/paypal-wordmark.svg"
          alt="PayPal"
          width={135}
          height={48}
          loading="eager"
          className={styles.paypalLogo}
        />
        <span>Illustrative invoice · Sample data</span>
      </footer>
    </article>
  );
}
