import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { OffersManager } from "./offers-manager";

export const metadata: Metadata = { title: "Offers" };

export default async function OffersPage() {
  const session = await requireStaff();
  if (!session.user.permissions.includes("promotion:manage")) {
    return <NoAccess what="offers" permission="promotion:manage" />;
  }
  const api = await serverApi();
  const offers = ensure(await api.GET("/api/v1/admin/offers"));
  return (
    <div className="mx-auto grid max-w-[1300px] gap-6">
      <PageHeader
        eyebrow="Growth"
        title="Offers"
        intro="Packages and deals customers can buy on the website (Offers page). Every order is emailed to the purchase-alert address and appears under Orders."
      />
      <OffersManager items={offers.items} csrfToken={session.csrfToken} />
    </div>
  );
}
