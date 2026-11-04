import type { Metadata } from "next";
import Link from "next/link";
import { Icon, buttonClass } from "@pegah/ui";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { PublishPill } from "@/components/publish-pill";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { TourForm } from "../tour-form";
import { DeparturesManager } from "./departures-manager";

export const metadata: Metadata = { title: "Tour" };

export default async function TourPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await requireStaff();
  if (!session.user.permissions.includes("catalog:read")) {
    return <NoAccess what="the catalog" permission="catalog:read" />;
  }
  const api = await serverApi();
  const [tour, destinations] = await Promise.all([
    api.GET("/api/v1/admin/tours/{slug}", { params: { path: { slug } } }).then(ensure),
    api.GET("/api/v1/admin/destinations").then(ensure),
  ]);
  const can = (p: string) => (session.user.permissions as string[]).includes(p);

  return (
    <div className="mx-auto grid max-w-[1200px] gap-6">
      <PageHeader
        eyebrow={`Catalog · ${tour.destination.name}`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {tour.title} <PublishPill status={tour.status} />
          </span>
        }
        back={{ href: "/catalog/tours", label: "All tours" }}
        actions={
          <>
            {can("booking:read") && (
              <Link href={`/bookings?tour=${tour.slug}`} className={buttonClass("outline", "md")}>
                <Icon name="ticket" className="size-[18px]" /> Bookings ({tour.activeBookings}{" "}
                active)
              </Link>
            )}
            {tour.status === "PUBLISHED" && (
              // The public site lives outside the /admin basePath.
              <a
                href={`/tours/${tour.slug}`}
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
      <DeparturesManager
        tourSlug={tour.slug}
        departures={tour.departures}
        groupSizeMax={tour.groupSizeMax}
        durationNights={tour.durationNights}
        canManage={can("inventory:manage")}
        csrfToken={session.csrfToken}
      />
      <section aria-labelledby="tour-h" className="grid gap-3">
        <h2 id="tour-h" className="font-display text-[1.5rem] font-medium">
          Tour details
        </h2>
        <TourForm
          tour={tour}
          destinations={destinations.items}
          csrfToken={session.csrfToken}
          readOnly={!can("catalog:manage")}
        />
      </section>
    </div>
  );
}
