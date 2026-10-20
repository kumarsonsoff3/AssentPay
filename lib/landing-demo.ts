// Fictional, internally consistent fixtures for the landing-page document previews.
// Reserved .example domains prevent these examples from identifying real accounts.
export type DemoParty = {
  business: string;
  contact: string;
  email: string;
  location: string;
  initials: string;
};

export type DemoInvoice = {
  number: string;
  issued: string;
  due: string;
  merchant: DemoParty;
  customer: DemoParty;
  reference: string;
  items: { name: string; description: string; quantity: number; price: number }[];
  note: string;
  terms: string;
};

export const studio: DemoParty = {
  business: "Northline Creative",
  contact: "Sarah Davis",
  email: "billing@northline.example",
  location: "San Francisco, CA · United States",
  initials: "NC",
};
export const client: DemoParty = {
  business: "Acme Studio",
  contact: "James Lee",
  email: "james@acme.example",
  location: "Portland, OR · United States",
  initials: "AS",
};
export const supplier: DemoParty = {
  business: "BrightWorks",
  contact: "Nina Patel",
  email: "accounts@brightworks.example",
  location: "Austin, TX · United States",
  initials: "BW",
};

export const project = {
  name: "Acme Studio / Brand refresh",
  agreement: "AGR-2026-118",
  version: "2.0",
  issued: "Oct 16, 2026",
  delivery: "Nov 6, 2026",
  total: 2500,
  depositPercent: 40,
  deposit: 1000,
  balance: 1500,
  scope: [
    { name: "Discovery & brand direction", amount: 650 },
    { name: "Visual identity & logo suite", amount: 1250 },
    { name: "Brand guidelines & handoff", amount: 600 },
  ],
};

export const clientInvoice: DemoInvoice = {
  number: "1042",
  issued: "Oct 19, 2026",
  due: "Oct 21, 2026",
  merchant: studio,
  customer: client,
  reference: project.agreement,
  items: [{ name: "Brand refresh — project deposit", description: "40% deposit against the $2,500.00 statement of work. Balance due on final delivery.", quantity: 1, price: project.deposit }],
  note: "Thank you, James. This invoice covers the upfront deposit for your brand refresh project.",
  terms: "Deposit due before the Oct 21 kickoff. Remaining project balance: $1,500.00, due Nov 6, 2026.",
};

export const supplierInvoice: DemoInvoice = {
  number: "2048",
  issued: "Oct 17, 2026",
  due: "Oct 24, 2026",
  merchant: supplier,
  customer: studio,
  reference: "PO-2026-028",
  items: [
    { name: "Custom brand illustrations", description: "Three editorial illustrations for the Acme brand refresh.", quantity: 3, price: 120 },
    { name: "Production files & handoff", description: "Source files, SVG exports, and delivery package.", quantity: 1, price: 120 },
  ],
  note: "Thanks for working with BrightWorks. Please include invoice #2048 with your payment.",
  terms: "Net 7 from invoice date. Payment due Oct 24, 2026. Currency: USD.",
};

export const paymentRecord = {
  reference: "DEMO-PP-1042",
  date: "Oct 20, 2026 · 09:16 UTC",
  amount: project.deposit,
  invoice: clientInvoice.number,
  payer: client,
  recipient: studio,
  status: "Completed",
};

export const formatDemoMoney = (value: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", minimumFractionDigits: 2,
}).format(value);

export const invoiceSubtotal = (invoice: DemoInvoice) =>
  invoice.items.reduce((total, item) => total + item.quantity * item.price, 0);
