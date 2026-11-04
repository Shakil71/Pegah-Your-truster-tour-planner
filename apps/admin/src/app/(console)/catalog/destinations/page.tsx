import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { DestinationManager } from "./destination-manager";

export const metadata: Metadata = { title: "Destinations" };

export default async function DestinationsPage() {
  const session = await requireStaff();
  if (!session.user.permissions.includes("catalog:read")) {
    return <NoAccess what="the catalog" permission="catalog:read" />;
  }
  const api = await serverApi();
  const { items } = ensure(await api.GET("/api/v1/admin/destinations"));
  return (
    <div className="mx-auto grid max-w-[1440px] gap-6">
      <PageHeader
        eyebrow="Catalog"
        title="Destinations"
        intro="Places travellers search for. A destination must be live on site for its hotels and tours to appear."
      />
      <DestinationManager
        items={items}
        canManage={session.user.permissions.includes("catalog:manage")}
        csrfToken={session.csrfToken}
      />
    </div>
  );
}
