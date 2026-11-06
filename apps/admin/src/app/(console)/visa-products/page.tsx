import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { VisaProductsManager } from "./visa-products-manager";

export const metadata: Metadata = { title: "Visa services" };

export default async function VisaProductsPage() {
  const session = await requireStaff();
  if (!session.user.permissions.includes("catalog:read")) {
    return <NoAccess what="visa services" permission="catalog:read" />;
  }
  const api = await serverApi();
  const { items } = ensure(await api.GET("/api/v1/admin/visa-products"));
  return (
    <div className="mx-auto grid max-w-[1280px] gap-6">
      <PageHeader
        eyebrow="Services"
        title="Visa services"
        intro="Visas customers can apply for on the website: country, type, processing time, starting price and the documents needed. The final price is always sent per request."
      />
      <VisaProductsManager
        items={items}
        csrfToken={session.csrfToken}
        canManage={session.user.permissions.includes("catalog:manage")}
      />
    </div>
  );
}
