export const sections = [
  {
    id: "overview",
    label: "Overview",
    group: "workspace",
    description: "Your finances, at a glance.",
  },
  {
    id: "inbox",
    label: "Conversations",
    group: "workspace",
    description: "Read financial emails, follow threads, and find the evidence behind a proposal.",
  },
  {
    id: "deals",
    label: "Deals & agreements",
    group: "workspace",
    description: "Review agreements, quotations, and the billing requests they support.",
  },
  {
    id: "approvals",
    label: "Approvals",
    group: "workspace",
    description: "Review evidence and authorize exact sandbox actions for your workspace.",
  },
  {
    id: "invoices",
    label: "Invoices & payments",
    group: "workspace",
    description: "Track sandbox drafts, sent invoices, payouts, and verified payment statuses.",
  },
  {
    id: "clients",
    label: "Clients & contacts",
    group: "workspace",
    description: "Find contacts discovered in your workspace’s financial conversations.",
  },
  {
    id: "documents",
    label: "Documents",
    group: "workspace",
    description: "Find, import, and download attachments from your financial emails.",
  },
  {
    id: "activity",
    label: "Agent activity",
    group: "intelligence",
    description: "Follow recent events, background jobs, and notification deliveries.",
  },
  {
    id: "memory",
    label: "Agent memory",
    group: "intelligence",
    description: "Review, correct, pause, or forget context the agent has retained.",
  },
  {
    id: "analytics",
    label: "Analytics Studio",
    group: "intelligence",
    description: "Explore invoice and payout data with filters, charts, and the Studio Agent.",
  },
  {
    id: "integrations",
    label: "Integrations",
    group: "manage",
    description: "Set up email forwarding, Slack review, and PayPal sandbox. Check connection health here.",
  },
  {
    id: "agent",
    label: "Business rules",
    group: "manage",
    description: "Manage workspace preferences and review the agent’s financial analysis.",
  },
  {
    id: "team",
    label: "Team",
    group: "manage",
    description: "Invite teammates, review their roles, and manage workspace access.",
  },
  {
    id: "notifications",
    label: "Notifications",
    group: "manage",
    description: "Review financial alerts, processing updates, and connection warnings.",
  },
  {
    id: "settings",
    label: "Workspace settings",
    group: "manage",
    description: "Manage your business profile, organization name, and workspace data.",
  },
] as const;
export type DashboardSectionId = (typeof sections)[number]["id"];
export const sectionHref = (id: DashboardSectionId) =>
  id === "overview" ? "/dashboard" : `/dashboard/${id}`;
export function dashboardSection(id: string) {
  return sections.find((s) => s.id === id);
}
