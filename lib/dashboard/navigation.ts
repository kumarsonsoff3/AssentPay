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
    description: "Useful financial conversations, with the full picture.",
  },
  {
    id: "deals",
    label: "Deals & agreements",
    group: "workspace",
    description: "From the first conversation to the final milestone.",
  },
  {
    id: "approvals",
    label: "Approvals",
    group: "workspace",
    description: "The next move is yours.",
  },
  {
    id: "invoices",
    label: "Invoices & payments",
    group: "workspace",
    description: "See what’s paid. Know what’s next.",
  },
  {
    id: "clients",
    label: "Clients & contacts",
    group: "workspace",
    description: "Good business starts with good relationships.",
  },
  {
    id: "documents",
    label: "Documents",
    group: "workspace",
    description: "The details behind every agreement.",
  },
  {
    id: "activity",
    label: "Agent activity",
    group: "intelligence",
    description: "A clear view of every step your agent takes.",
  },
  {
    id: "memory",
    label: "Agent memory",
    group: "intelligence",
    description: "Context that stays with the conversation.",
  },
  {
    id: "analytics",
    label: "Analytics Studio",
    group: "intelligence",
    description: "Turn your financial picture into a clearer next step.",
  },
  {
    id: "integrations",
    label: "Integrations",
    group: "manage",
    description: "Familiar tools. A smarter connection.",
  },
  {
    id: "agent",
    label: "Business rules",
    group: "manage",
    description: "Your business. Your boundaries.",
  },
  {
    id: "team",
    label: "Team",
    group: "manage",
    description: "Better work happens together.",
  },
  {
    id: "notifications",
    label: "Notifications",
    group: "manage",
    description: "The updates that deserve your attention.",
  },
  {
    id: "settings",
    label: "Workspace settings",
    group: "manage",
    description: "Make this workspace work for you.",
  },
] as const;
export type DashboardSectionId = (typeof sections)[number]["id"];
export const sectionHref = (id: DashboardSectionId) =>
  id === "overview" ? "/dashboard" : `/dashboard/${id}`;
export function dashboardSection(id: string) {
  return sections.find((s) => s.id === id);
}
