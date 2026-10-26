export const forwardingProviders = [
  { id: "gmail", name: "Gmail", confirmation: "google" },
  { id: "google-workspace", name: "Google Workspace", confirmation: "google" },
  { id: "outlook", name: "Outlook", confirmation: "none" },
  { id: "microsoft-365", name: "Microsoft 365", confirmation: "none" },
  { id: "other", name: "Other email", confirmation: "provider" },
] as const;

export type ForwardingProvider = (typeof forwardingProviders)[number]["id"];
export function isForwardingProvider(value: unknown): value is ForwardingProvider {
  return forwardingProviders.some((provider) => provider.id === value);
}

export const forwardingGuides: Record<ForwardingProvider, {
  intro: string;
  steps: { title: string; detail: string }[];
  note: string;
  help?: string;
}> = {
  gmail: {
    intro: "For a personal Gmail inbox. Use Gmail on a computer to set up forwarding.",
    steps: [
      { title: "Open Gmail settings", detail: "In Gmail on a computer, open **Settings** (the gear) → **See all settings**." },
      { title: "Add the destination", detail: "Open **Forwarding and POP/IMAP** → **Add a forwarding address**. Paste your AssentPay workspace address, then select **Next** → **Proceed**." },
      { title: "Confirm the address", detail: "Google sends a confirmation to your workspace. Its **confirmation code** and **Confirm in Google** link appear privately in AssentPay’s email setup. Confirm the address, then return to Gmail." },
      { title: "Save forwarding", detail: "Back in **Forwarding and POP/IMAP**, choose **Forward a copy of incoming mail to** your workspace address, keep Gmail’s copy in the inbox, and select **Save Changes**." },
    ],
    note: "Only selected email? Leave account-wide forwarding off. Search for a sender, recipient or subject, then choose **Create filter** → **Forward it to** your workspace address. Only new matching messages are forwarded.",
    help: "https://support.google.com/mail/answer/10957",
  },
  "google-workspace": {
    intro: "For a business mailbox hosted by Google. Your administrator may need to allow external forwarding.",
    steps: [
      { title: "Check your organization’s forwarding policy", detail: "Ask your **Google Workspace administrator** to **allow forwarding** for this mailbox if the option is missing. For a group or shared address, ask them to configure the appropriate routing." },
      { title: "Add and confirm the destination in Gmail", detail: "Open **Settings** → **See all settings** → **Forwarding and POP/IMAP** → **Add a forwarding address**. Paste your AssentPay address. Google’s **confirmation code or link** appears in AssentPay’s email setup for mailbox-level setup." },
      { title: "Save a filter or forwarding setting", detail: "Create a filter and choose **Forward it to** for selected business email, or enable **Forward a copy of incoming mail to** for all new mail. Keep a copy in Gmail and **save your changes**." },
    ],
    note: "Admin-managed routing may skip Google’s mailbox confirmation. You can still proceed to the delivery check.",
    help: "https://support.google.com/a/answer/2685650",
  },
  outlook: {
    intro: "For Outlook.com or an Outlook mailbox. These steps use Outlook on the web or new Outlook.",
    steps: [
      { title: "Open your mailbox settings", detail: "Check that you are signed in to the mailbox you want to forward from. Open **Settings** → **Mail**." },
      { title: "Choose a rule or automatic forwarding", detail: "For selected email, open **Rules** → **Add new rule**, choose your conditions, and add **Forward to** with your AssentPay address. For all new mail, open **Forwarding** (or **Forwarding and IMAP**), select **Enable forwarding**, enter the address and keep a copy." },
      { title: "Save, then check delivery", detail: "**Save** your rule or forwarding setting. Complete any Microsoft account security prompts inside Outlook. You do not need to wait for a Gmail confirmation here." },
    ],
    note: "Have another person send a fresh message that matches your rule. A saved setting alone does not prove delivery.",
    help: "https://support.microsoft.com/en-us/outlook/mail/turn-automatic-forwarding-on-or-off-in-outlook",
  },
  "microsoft-365": {
    intro: "For work email hosted by Microsoft 365. External forwarding depends on your organization’s policy.",
    steps: [
      { title: "Check with your Microsoft 365 administrator", detail: "Ask your **Microsoft 365 administrator** to confirm that this mailbox is **allowed to forward** to your AssentPay address. External automatic forwarding can be blocked even when Outlook lets you save a rule." },
      { title: "Configure the mailbox in Outlook on the web", detail: "Open **Settings** → **Mail** → **Rules** to forward selected messages, or **Mail** → **Forwarding** to forward all new mail. Enter your AssentPay address, keep a mailbox copy where available, and select **Save**. Shared mailboxes may require administrator setup." },
      { title: "Run a delivery check", detail: "Microsoft’s forwarding setup does not use Gmail’s confirmation email. Complete any **Microsoft security prompts** in Outlook, then **send a new matching test message** through your mailbox." },
    ],
    note: "If the test does not arrive, ask your administrator to check outbound forwarding policies and any delivery failure notice.",
    help: "https://learn.microsoft.com/en-us/defender-office-365/outbound-spam-policies-external-email-forwarding",
  },
  other: {
    intro: "Use any mailbox that can forward email to an external address. Options vary by provider and plan.",
    steps: [
      { title: "Find your provider’s forwarding settings", detail: "Look for **Forwarding**, **Rules** or **Filters** in your email settings, or ask your email administrator to route selected business messages to your AssentPay address." },
      { title: "Complete your provider’s setup", detail: "Add the workspace address and **save your forwarding rule**. If your provider requires **destination verification**, follow its official instructions. AssentPay can show recognized confirmation codes privately, but does not support every provider’s confirmation format or link." },
      { title: "Check the route you will actually use", detail: "**Send a fresh message** through your source mailbox after creating an AssentPay **test code**. If automatic forwarding is unavailable, you can **manually forward** selected messages to the workspace address instead." },
    ],
    note: "For manual forwarding, forward the fresh test message with its code. This checks manual delivery, not an automatic rule.",
  },
};

export function safeGoogleConfirmationLink(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["mail.google.com", "mail-settings.google.com"].includes(url.hostname) && !url.username && !url.password && !url.port && url.pathname.startsWith("/mail/vf-") ? url.href : "";
  } catch { return ""; }
}
