import type { Metadata } from "next";
import Link from "next/link";
import { Icon, buttonClass } from "@pegah/ui";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { PublishPill } from "@/components/publish-pill";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { HotelForm } from "../hotel-form";
import { RoomsEditor } from "./rooms-editor";

export const metadata: Metadata = { title: "Hotel" };

export default async function HotelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await requireStaff();
  if (!session.user.permissions.includes("catalog:read")) {
    return <NoAccess what="the catalog" permission="catalog:read" />;
  }
  const api = await serverApi();
  const [hotel, destinations] = await Promise.all([
    api.GET("/api/v1/admin/hotels/{slug}", { params: { path: { slug } } }).then(ensure),
    api.GET("/api/v1/admin/destinations").then(ensure),
  ]);
  const can = (p: string) => (session.user.permissions as string[]).includes(p);

  return (
    <div className="mx-auto grid max-w-[1200px] gap-6">
      <PageHeader
        eyebrow={`Catalog · ${hotel.destination.name}`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {hotel.name} <PublishPill status={hotel.status} />
          </span>
        }
        back={{ href: "/catalog/hotels", label: "All hotels" }}
        actions={
          <>
            {can("booking:read") && (
              <Link href={`/bookings?hotel=${hotel.slug}`} className={buttonClass("outline", "md")}>
                <Icon name="ticket" className="size-[18px]" /> Bookings ({hotel.activeBookings}{" "}
                active)
              </Link>
            )}
            {hotel.status === "PUBLISHED" && (
              // The public site lives outside the /admin basePath.
              <a
                href={`/stays/${hotel.slug}`}
                target="_blank"
                rel="noreferrer"
                className={buttonClass("ink", "md")}
              >
                View on website <Icon name="arrowRight" className="size-[18px]" />
              </a>
            )}
          </>
        }
      />
      <RoomsEditor
        hotelSlug={hotel.slug}
        rooms={hotel.rooms}
        canManage={can("catalog:manage")}
        canInventory={can("inventory:manage") || can("catalog:read")}
        csrfToken={session.csrfToken}
      />
      <section aria-labelledby="details-h" className="grid gap-3">
        <h2 id="details-h" className="font-display text-[1.5rem] font-medium">
          Property details
        </h2>
        <HotelForm
          hotel={hotel}
          destinations={destinations.items}
          csrfToken={session.csrfToken}
          readOnly={!can("catalog:manage")}
        />
      </section>
    </div>
  );
}
