/** Deliberately excludes provider addresses, phones, links, payment details and raw metadata. */
export function sendReviewView(
  row: Record<string, unknown> | null,
  workspaceId: string,
  owner: boolean,
) {
  if (
    !owner ||
    row?.workspaceId !== workspaceId ||
    !(Date.parse(String(row.expiresAt)) > Date.now())
  )
    return null;
  const s = JSON.parse(String(row.snapshotJson));
  const i = s.invoice;
  return {
    snapshotHash: String(row.snapshotHash),
    expiresAt: String(row.expiresAt),
    snapshot: {
      providerId: String(s.providerId),
      invoice: {
        amount: {
          currency_code: String(i.amount?.currency_code || ""),
          value: String(i.amount?.value || ""),
        },
        primary_recipients: [
          {
            billing_info: {
              email_address: String(
                i.primary_recipients?.[0]?.billing_info?.email_address || "",
              ),
            },
          },
        ],
        detail: {
          reference: String(i.detail?.reference || ""),
          invoice_date: String(i.detail?.invoice_date || ""),
        },
      },
    },
  };
}
