import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { TourForm } from "../tour-form";

export const metadata: Metadata = { title: "New tour" };

export default async function NewTourPage() {
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
        title="New tour"
        intro="Create the tour as a draft, add departures, then make it live."
        back={{ href: "/catalog/tours", label: "All tours" }}
      />
      <TourForm destinations={items} csrfToken={session.csrfToken} />
    </div>
  );
}
