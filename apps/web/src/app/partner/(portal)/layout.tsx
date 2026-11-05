import type { Metadata } from "next";
import { requirePartner } from "@/lib/api-server";
import { PartnerShell } from "./partner-shell";

export const metadata: Metadata = {
  title: { default: "Partner portal", template: "%s · Pegah partners" },
  robots: { index: false },
};
export const dynamic = "force-dynamic";

/** Every partner page needs a partner session; the API scopes every call to that partner. */
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePartner();
  const partner = session.user.partner!;
  return (
    <PartnerShell
      partnerName={partner.name}
      kind={partner.kind}
      userName={session.user.fullName}
      csrfToken={session.csrfToken}
    >
      {children}
    </PartnerShell>
  );
}
