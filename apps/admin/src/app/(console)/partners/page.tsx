import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { PartnersManager } from "./partners-manager";

export const metadata: Metadata = { title: "Suppliers and agents" };

export default async function PartnersPage() {
  const session = await requireStaff();
  if (!session.user.permissions.includes("partner:manage")) {
    return <NoAccess what="partners" permission="partner:manage" />;
  }
  const api = await serverApi();
  const [partners, hotels, tours] = await Promise.all([
    api.GET("/api/v1/admin/partners").then(ensure),
    api.GET("/api/v1/admin/hotels").then(ensure),
    api.GET("/api/v1/admin/tours").then(ensure),
  ]);
  return (
    <div className="mx-auto grid max-w-[1440px] gap-6">
      <PageHeader
        eyebrow="Partners"
        title="Suppliers and agents"
        intro="Suppliers manage the hotels and tours you assign to them in the partner portal (/partner) and see their reservations. Travel agents book for clients there and earn commission. Partner users only ever see their own company's records."
      />
      <PartnersManager
        partners={partners.items}
        hotels={hotels.items.map((h) => ({ slug: h.slug, name: h.name }))}
        tours={tours.items.map((t) => ({ slug: t.slug, name: t.title }))}
        csrfToken={session.csrfToken}
      />
    </div>
  );
}
