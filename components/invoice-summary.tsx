import Image from "next/image";
import {
  type DemoInvoice,
  formatDemoMoney,
  invoiceSubtotal,
} from "@/lib/landing-demo";
import styles from "./invoice-summary.module.css";

/** A readable landing-page excerpt; the complete invoice lives in the expanded view. */
export function InvoiceSummary({
  invoice,
  paid = 0,
  status = "Unpaid",
}: {
  invoice: DemoInvoice;
  paid?: number;
  status?: string;
}) {
  const total = invoiceSubtotal(invoice);
  return (
    <article
      className={styles.card}
      aria-label={`Invoice ${invoice.number} summary`}
    >
      <header className={styles.header}>
        <div>
          <Image
            src="/integrations/paypal-wordmark.svg"
            alt="PayPal"
            width={135}
            height={48}
            loading="eager"
          />
          <span>Invoice #{invoice.number}</span>
        </div>
        <span className={styles.status} data-paid={paid >= total}>
          {status}
        </span>
      </header>
      <div className={styles.parties}>
        <div>
          <small>FROM</small>
          <strong>{invoice.merchant.business}</strong>
        </div>
        <div>
          <small>BILL TO</small>
          <strong>{invoice.customer.business}</strong>
        </div>
      </div>
      <div className={styles.dates}>
        <span>Issued {invoice.issued}</span>
        <span>Due {invoice.due}</span>
      </div>
      <table className={styles.items}>
        <caption className="sr-only">
          Invoice {invoice.number} item summary in USD
        </caption>
        <thead>
          <tr>
            <th>Description</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map(item => (
            <tr key={item.name}>
              <td>
                <strong>{item.name}</strong>
                <span>
                  {item.quantity} × {formatDemoMoney(item.price)}
                </span>
              </td>
              <td>{formatDemoMoney(item.quantity * item.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className={styles.totals}>
        <div>
          <dt>
            Invoice total <span>· USD</span>
          </dt>
          <dd>{formatDemoMoney(total)}</dd>
        </div>
        {paid > 0 && (
          <div>
            <dt>Paid</dt>
            <dd>{formatDemoMoney(paid)}</dd>
          </div>
        )}
        <div className={styles.balance}>
          <dt>Amount due</dt>
          <dd>{formatDemoMoney(Math.max(0, total - paid))}</dd>
        </div>
      </dl>
      <footer className={styles.footer}>
        <span>{invoice.reference}</span>
        <span>Sample invoice excerpt</span>
      </footer>
    </article>
  );
}
