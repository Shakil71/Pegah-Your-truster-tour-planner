import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { HotelForm } from "../hotel-form";

export const metadata: Metadata = { title: "New hotel" };

export default async function NewHotelPage() {
  const session = await requireStaff();
  if (!session.user.permissions.includes("catalog:manage")) {
    return <NoAccess what="catalog editing" permission="catalog:manage" />;
  }
  const api = await serverApi();
  const { items } = ensure(await api.GET("/api/v1/admin/destinations"));
  return (
    <div className="mx-auto grid max-w-[1100px] gap-6">
      <PageHeader
        eyebrow="Catalog"
        title="New hotel"
        intro="Start as a draft, add room types and put rooms on sale, then make it live."
        back={{ href: "/catalog/hotels", label: "All hotels" }}
      />
      <HotelForm destinations={items} csrfToken={session.csrfToken} />
    </div>
  );
}
