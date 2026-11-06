import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { AdsManager } from "./ads-manager";

export const metadata: Metadata = { title: "Ads" };

export default async function AdsPage() {
  const session = await requireStaff();
  if (!session.user.permissions.includes("promotion:manage")) {
    return <NoAccess what="ads" permission="promotion:manage" />;
  }
  const api = await serverApi();
  const ads = ensure(await api.GET("/api/v1/admin/ads"));
  return (
    <div className="mx-auto grid max-w-[1300px] gap-6">
      <PageHeader
        eyebrow="Growth"
        title="Ads"
        intro="Photo banners on the home page and the Offers page. Schedule them with start and end dates; at most two show per spot, lowest order first."
      />
      <AdsManager items={ads.items} csrfToken={session.csrfToken} />
    </div>
  );
}
