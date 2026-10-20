import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Coins,
  CreditCard,
  ExternalLink,
  FileText,
  Inbox,
  LayoutGrid,
  MessageSquare,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { CashFlowPreview } from "@/components/cash-flow-preview";

const metrics = [
  {
    label: "Collected this month",
    value: "$18,450",
    note: "+12.8% vs. last month",
    icon: Coins,
    tone: "blue",
    trend: true,
    bars: [24, 44, 37, 65, 51, 82, 68, 100],
  },
  {
    label: "Invoices prepared",
    value: "42",
    note: "+6 this week",
    icon: FileText,
    tone: "blue",
    trend: true,
    bars: [48, 35, 19, 68, 32, 49, 61, 37],
  },
  {
    label: "Awaiting approval",
    value: "6",
    note: "$24,800 total value",
    icon: Clock3,
    tone: "amber",
    bars: [28, 49, 66, 37, 23, 79, 58, 100],
  },
  {
    label: "Outstanding balance",
    value: "$28,320",
    note: "12 open invoices",
    icon: BriefcaseBusiness,
    tone: "violet",
    bars: [12, 38, 62, 47, 91, 59, 42, 80],
  },
];
const sidebarItems = [
  { icon: LayoutGrid, label: "Overview" },
  { icon: Inbox, label: "Conversations", unread: true },
  { icon: ShieldCheck, label: "Approvals", count: "6" },
  { icon: FileText, label: "Invoices" },
  { icon: CreditCard, label: "Payments" },
  { icon: Users, label: "Relationships" },
  { icon: ChartNoAxesCombined, label: "Analytics" },
  { icon: SlidersHorizontal, label: "Integrations" },
];
const activities = [
  {
    icon: ShieldCheck,
    title: "Deposit ready for approval",
    detail: "Acme Studio · $1,000.00 · Invoice #INV-1042",
    time: "10m ago",
    tone: "blue",
  },
  {
    icon: ArrowDownLeft,
    title: "Payment received",
    detail: "Northstar Co. · $2,400.00 · Invoice #INV-1036",
    time: "2h ago",
    tone: "green",
  },
  {
    icon: Sparkles,
    title: "Agreement added to memory",
    detail: "Brand refresh · Milestone terms extracted",
    time: "5h ago",
    tone: "violet",
  },
  {
    icon: MessageSquare,
    title: "Client requested a revised milestone split",
    detail: "Lumen Labs · “Can we adjust milestone 2 to 40%?”",
    time: "1d ago",
    tone: "blue",
  },
];
const reviewItems = [
  {
    icon: ShieldCheck,
    item: "Deposit payment",
    client: "Acme Studio",
    amount: "$1,000.00",
    status: "Ready",
  },
  {
    icon: FileText,
    item: "Invoice #INV-1040",
    client: "BrightPath Co.",
    amount: "$4,800.00",
    status: "Review",
  },
  {
    icon: ShieldCheck,
    item: "Milestone payment",
    client: "Lumen Labs",
    amount: "$3,200.00",
    status: "Review",
  },
  {
    icon: FileText,
    item: "New agreement",
    client: "Northstar Co.",
    amount: "$6,000.00",
    status: "Review",
  },
  {
    icon: ClipboardCheck,
    item: "Revised terms",
    client: "Pixel Foundry",
    amount: "—",
    status: "Action",
  },
];
const conversations = [
  {
    initials: "JL",
    name: "James Lee",
    company: "Acme Studio",
    subject: "Re: Invoice #INV-1042",
    preview: "Looks good on our end. Please go ahead with…",
    time: "2h ago",
    tone: "blue",
  },
  {
    initials: "MK",
    name: "Maria Khan",
    company: "Lumen Labs",
    subject: "Re: Milestone payment",
    preview: "Can we adjust milestone 2 to 40%? The scope…",
    time: "4h ago",
    tone: "violet",
  },
  {
    initials: "DC",
    name: "Daniel Cho",
    company: "Northstar Co.",
    subject: "Agreement terms",
    preview: "Thanks! The terms look good. We’ll proceed…",
    time: "1d ago",
    tone: "green",
  },
];

function DashboardSidebar() {
  return (
    <aside className="dash-sidebar" aria-label="Dashboard sidebar preview">
      <div className="dash-sidebar-brand">
        <Brand small />
      </div>
      <div className="dash-workspace">
        <span className="dash-avatar">SD</span>
        <div>
          <strong>Studio workspace</strong>
          <span>Acme Studio</span>
        </div>
        <ChevronDown className="ml-auto size-3 text-primary" />
      </div>
      <div className="dash-nav" aria-label="Sample workspace navigation">
        {sidebarItems.map(({ icon: Icon, label, count, unread }, index) => (
          <div
            key={label}
            className={`dash-nav-item ${index === 0 ? "is-active" : ""}`}
          >
            <Icon className="size-4" />
            <span>{label}</span>
            {count && <span className="dash-count">{count}</span>}
            {unread && <span className="dash-unread" />}
          </div>
        ))}
      </div>
      <div className="dash-sidebar-bottom">
        <div className="dash-nav-item">
          <Settings2 className="size-4" />
          <span>Settings</span>
        </div>
        <div className="dash-nav-item">
          <CircleHelp className="size-4" />
          <span>Help & support</span>
        </div>
      </div>
      <div className="dash-agent">
        <span className="dash-icon tone-blue">
          <Bot className="size-5" />
        </span>
        <div>
          <strong>Your AI agent</strong>
          <span className="dash-agent-status">
            <i /> Active
          </span>
          <p>Monitoring emails, agreements, and payments.</p>
        </div>
        <ChevronRight className="size-3 text-primary" />
      </div>
    </aside>
  );
}

function DashboardToolbar() {
  return (
    <div className="dash-toolbar">
      <div className="dash-search">
        <Search className="size-3.5" />
        <span>Search invoices, clients, conversations…</span>
      </div>
      <div className="dash-toolbar-account">
        <span className="dash-business">
          <Building2 className="size-3.5" /> Acme Studio{" "}
          <ChevronDown className="size-3" />
        </span>
        <span className="dash-notification" aria-label="Sample notification">
          <Bell className="size-4" />
          <i />
        </span>
        <div className="dash-profile">
          <span className="dash-avatar">SD</span>
          <span>
            <strong>Sarah Davis</strong>
            <small>Owner</small>
          </span>
          <ChevronDown className="size-3" />
        </div>
      </div>
    </div>
  );
}

function MetricCards() {
  return (
    <div className="dash-metrics">
      {metrics.map(
        ({ label, value, note, icon: Icon, tone, trend, bars }, index) => (
          <div key={label} className="dash-metric">
            <span className={`dash-icon tone-${tone}`}>
              <Icon className="size-4.5" />
            </span>
            <div className="dash-metric-body">
              <p>{label}</p>
              <strong>{value}</strong>
              <span>
                {trend && (
                  <ArrowUpRight className="size-2.5 text-emerald-600" />
                )}
                {note}
              </span>
            </div>
            <span
              className={`metric-spark-bars spark-${index}`}
              aria-hidden="true"
            >
              {bars.map((height, i) => (
                <i key={i} style={{ height: `${height}%` }} />
              ))}
            </span>
          </div>
        ),
      )}
    </div>
  );
}

function ActivityPanel() {
  return (
    <section
      className="dash-panel dash-activity"
      aria-labelledby="activity-heading"
    >
      <div className="dash-panel-heading">
        <h4 id="activity-heading">Your agent’s activity</h4>
        <span className="dash-meta">Latest updates</span>
      </div>
      <div className="dash-activity-list">
        {activities.map(({ icon: Icon, title, detail, time, tone }) => (
          <div key={title} className="dash-activity-row">
            <span className={`dash-icon tone-${tone}`}>
              <Icon className="size-4.5" />
            </span>
            <div>
              <strong>{title}</strong>
              <p>{detail}</p>
            </div>
            <time>{time}</time>
            <ChevronRight className="size-3 shrink-0 text-[#8C9CBA]" />
          </div>
        ))}
      </div>
      <div className="dash-insight">
        <Sparkles className="size-5 shrink-0 text-primary" />
        <div>
          <strong>Every action has a paper trail.</strong>
          <p>
            Your agent connects emails, agreements, and payments, so you’re
            always in the loop.
          </p>
        </div>
      </div>
    </section>
  );
}

function ReviewPanel() {
  return (
    <section
      className="dash-panel dash-review"
      aria-labelledby="review-heading"
    >
      <div className="dash-panel-heading">
        <h4 id="review-heading">
          Needs your review <span className="review-count">6</span>
        </h4>
        <span className="dash-meta">5 latest items</span>
      </div>
      <div
        className="dash-table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Pending financial actions table"
      >
        <table>
          <caption className="sr-only">
            Sample financial actions awaiting owner review
          </caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Client</th>
              <th scope="col" className="amount-column">
                Amount
              </th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {reviewItems.map(({ icon: Icon, item, client, amount, status }) => (
              <tr key={item}>
                <td>
                  <span className="review-item-label">
                    <Icon className="size-3.5 shrink-0" />
                    {item}
                  </span>
                </td>
                <td>{client}</td>
                <td className="amount-column">{amount}</td>
                <td>
                  <span
                    className={`review-status status-${status.toLowerCase()}`}
                  >
                    {status}
                  </span>
                </td>
                <td>
                  <ChevronRight className="size-3 text-[#8C9CBA]" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ConversationsPanel() {
  return (
    <section
      className="dash-panel dash-conversations"
      aria-labelledby="conversations-heading"
    >
      <div className="dash-panel-heading">
        <h4 id="conversations-heading">Recent conversations</h4>
        <span className="dash-meta">3 threads</span>
      </div>
      <div className="dash-conversation-list">
        {conversations.map(
          ({ initials, name, company, subject, preview, time, tone }) => (
            <div key={name} className="dash-conversation">
              <span className={`conversation-avatar tone-${tone}`}>
                {initials}
              </span>
              <div>
                <p>
                  <strong>{name}</strong>
                  <span> — {company}</span>
                </p>
                <strong className="conversation-subject">{subject}</strong>
                <p className="conversation-excerpt">{preview}</p>
              </div>
              <time>
                {time}
                <i />
              </time>
            </div>
          ),
        )}
      </div>
    </section>
  );
}

function MemoryPanel() {
  return (
    <section
      className="dash-panel dash-memory"
      aria-labelledby="memory-heading"
    >
      <div className="dash-panel-heading">
        <h4 id="memory-heading">Deal memory highlights</h4>
        <span className="dash-meta">1 agreement</span>
      </div>
      <div className="memory-agreement">
        <div className="memory-agreement-heading">
          <Building2 className="size-3.5 text-[#637DA8]" />
          <strong>
            Acme Studio <span>— Brand refresh</span>
          </strong>
          <ChevronRight className="ml-auto size-3" />
        </div>
        <dl>
          <div>
            <dt>Deposit</dt>
            <dd>40% ($1,000)</dd>
            <dd className="memory-paid">
              <Check className="size-3" /> Paid
            </dd>
          </div>
          <div>
            <dt>Final payment</dt>
            <dd>60% ($1,500)</dd>
            <dd>
              <CalendarDays className="size-2.5" /> Dec 20, 2026
            </dd>
          </div>
          <div>
            <dt>Quoted amount</dt>
            <dd>$2,500.00</dd>
          </div>
          <div>
            <dt>Agreement</dt>
            <dd className="memory-reference">
              #AGR-2026-118 <ExternalLink className="size-2.5" />
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export function ProductPreview() {
  return (
    <section
      id="product-preview"
      className="product-preview scroll-mt-5 overflow-hidden"
      aria-labelledby="preview-heading"
    >
      <div className="page-shell relative z-10 py-14 sm:py-18">
        <div className="product-preview-intro">
          <div>
            <p className="product-preview-eyebrow">THE ASSENTPAY WORKSPACE</p>
            <h2 id="preview-heading">
              See what’s paid.
              <br />
              <span className="brand-gradient">Know what’s next.</span>
            </h2>
          </div>
          <div className="product-preview-summary">
            <p>
              Track payments, review approvals, and pick up every client
              conversation with the full picture in front of you.
            </p>
            <span className="product-preview-label">
              <span /> Interactive preview · Sample data
            </span>
          </div>
        </div>
        <div className="dashboard-frame">
          <div className="dashboard-app">
            <DashboardSidebar />
            <div className="dash-main">
              <DashboardToolbar />
              <div className="dash-content">
                <div className="dash-page-heading">
                  <div>
                    <p className="dash-eyebrow">YOUR FINANCIAL OVERVIEW</p>
                    <h3>Your finances, at a glance.</h3>
                    <p>
                      Payments to track. Decisions to make. Every detail
                      connected.
                    </p>
                  </div>
                  <div className="dash-date">
                    <CalendarDays className="size-3.5" />
                    <span>Oct 1, 2026 – Oct 31, 2026</span>
                    <ChevronDown className="size-3" />
                  </div>
                </div>
                <MetricCards />
                <div className="dash-primary-grid">
                  <CashFlowPreview />
                  <ActivityPanel />
                </div>
                <div className="dash-secondary-grid">
                  <ReviewPanel />
                  <ConversationsPanel />
                  <MemoryPanel />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
