import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { PromotionsManager } from "./promotions-manager";

export const metadata: Metadata = { title: "Promotions" };

export default async function PromotionsPage() {
  const session = await requireStaff();
  if (!session.user.permissions.includes("promotion:manage")) {
    return <NoAccess what="promotions" permission="promotion:manage" />;
  }
  const api = await serverApi();
  const { items } = ensure(await api.GET("/api/v1/admin/promotions"));
  return (
    <div className="mx-auto grid max-w-[1440px] gap-6">
      <PageHeader
        eyebrow="Growth"
        title="Promotions"
        intro="Coupon codes customers enter at checkout. The discount comes off the base price; service charge and VAT are calculated after it. Expired and unpaid bookings give their redemption back."
      />
      <PromotionsManager items={items} csrfToken={session.csrfToken} />
    </div>
  );
}
