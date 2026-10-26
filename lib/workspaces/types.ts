export const PROVIDERS = ["gmail", "slack", "paypal"] as const;
export type Provider = (typeof PROVIDERS)[number];
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type BusinessProfile = {
  businessName: string;
  website: string;
  industry: string;
  country: string;
  currency: string;
  timezone: string;
  approvalThreshold: number;
  emailNotifications: boolean;
};
export type Workspace = BusinessProfile & {
  id: string;
  name: string;
  role: WorkspaceRole;
  profileSaved: boolean;
  onboardingComplete: boolean;
};
export type IntegrationSummary = {
  provider: Provider;
  label: string;
  status: "connected" | "needs_attention";
  environment: "sandbox" | "production";
  checkedAt: string;
  channel?: string;
};
export type Member = {
  id: string;
  userId: string;
  name: string;
  email: string;
  roles: string[];
  confirmed: boolean;
};
export const defaultProfile: BusinessProfile = {
  businessName: "",
  website: "",
  industry: "",
  country: "US",
  currency: "USD",
  timezone: "UTC",
  approvalThreshold: 1000,
  emailNotifications: true,
};
export const isProvider = (value: string): value is Provider =>
  PROVIDERS.includes(value as Provider);
export const canManage = (role: WorkspaceRole) =>
  role === "owner" || role === "admin";
