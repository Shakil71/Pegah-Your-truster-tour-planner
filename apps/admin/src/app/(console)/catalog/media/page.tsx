import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { MediaLibrary } from "./media-library";

export const metadata: Metadata = { title: "Media library" };

export default async function MediaPage() {
  const session = await requireStaff();
  if (!session.user.permissions.includes("catalog:read")) {
    return <NoAccess what="the media library" permission="catalog:read" />;
  }
  const api = await serverApi();
  const page = ensure(await api.GET("/api/v1/admin/media", { params: { query: { limit: 100 } } }));
  return (
    <div className="mx-auto grid max-w-[1300px] gap-6">
      <PageHeader
        eyebrow="Catalog"
        title="Media library"
        intro="Photos for destinations, hotels and tours. Uploads are resized, stripped of camera and location data, and served fast from the website. Use only photos you own or are licensed to use, and credit the photographer."
      />
      <MediaLibrary
        items={page.items}
        canManage={session.user.permissions.includes("catalog:manage")}
        csrfToken={session.csrfToken}
      />
    </div>
  );
}
