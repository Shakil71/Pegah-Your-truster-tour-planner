import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { HomeEditor } from "./home-editor";

export const metadata: Metadata = { title: "Home page" };

export default async function HomePageEditor() {
  const session = await requireStaff();
  if (!session.user.permissions.includes("content:manage")) {
    return <NoAccess what="the home page editor" permission="content:manage" />;
  }
  const api = await serverApi();
  const [home, destinations, hotels, tours, media] = await Promise.all([
    api.GET("/api/v1/admin/home").then(ensure),
    api.GET("/api/v1/admin/destinations").then(ensure),
    api.GET("/api/v1/admin/hotels").then(ensure),
    api.GET("/api/v1/admin/tours").then(ensure),
    api.GET("/api/v1/admin/media", { params: { query: { limit: 100 } } }).then(ensure),
  ]);
  return (
    <div className="mx-auto grid max-w-[1200px] gap-6">
      <PageHeader
        eyebrow="Content"
        title="Home page"
        intro="Choose what the website's home page shows. Featured items come from your real catalog; only published ones appear. A section you leave empty keeps its built-in content."
      />
      <HomeEditor
        initial={home}
        csrfToken={session.csrfToken}
        mediaUrls={Object.fromEntries(media.items.map((m) => [m.key, m.url]))}
        destinations={destinations.items.map((d) => ({
          slug: d.slug,
          label: d.name,
          published: d.status === "PUBLISHED",
        }))}
        hotels={hotels.items.map((h) => ({
          slug: h.slug,
          label: `${h.name} · ${h.destination.name}`,
          published: h.status === "PUBLISHED",
        }))}
        tours={tours.items.map((t) => ({
          slug: t.slug,
          label: `${t.title} · ${t.destination.name}`,
          published: t.status === "PUBLISHED",
        }))}
      />
    </div>
  );
}
