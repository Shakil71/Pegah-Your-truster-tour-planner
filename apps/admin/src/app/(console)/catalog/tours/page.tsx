import type { Metadata } from "next";
import Link from "next/link";
import { Icon, buttonClass } from "@pegah/ui";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { PublishPill } from "@/components/publish-pill";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Tours and departures" };

export default async function ToursPage() {
  const session = await requireStaff();
  if (!session.user.permissions.includes("catalog:read")) {
    return <NoAccess what="the catalog" permission="catalog:read" />;
  }
  const api = await serverApi();
  const { items } = ensure(await api.GET("/api/v1/admin/tours"));
  return (
    <div className="mx-auto grid max-w-[1440px] gap-6">
      <PageHeader
        eyebrow="Catalog"
        title="Tours and departures"
        intro="Guided trips and their dated departures with seat counts."
        actions={
          session.user.permissions.includes("catalog:manage") && (
            <Link href="/catalog/tours/new" className={buttonClass("primary", "md")}>
              <Icon name="plus" className="size-[18px]" /> New tour
            </Link>
          )
        }
      />
      <section className="panel overflow-hidden" aria-label="Tours">
        {items.length === 0 ? (
          <p className="px-6 py-14 text-center text-ink-2">No tours yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[0.86rem]">
              <thead>
                <tr className="text-[0.7rem] uppercase tracking-[0.08em] text-ink-3">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Tour
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Destination
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Upcoming departures
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Active bookings
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id} className="border-t border-rule hover:bg-paper">
                    <td className="px-4 py-3">
                      <Link
                        href={`/catalog/tours/${t.slug}`}
                        className="font-semibold hover:underline"
                      >
                        {t.title}
                      </Link>
                      <p className="text-[0.76rem] text-ink-3">
                        {t.durationDays} days · /{t.slug}
                      </p>
                    </td>
                    <td className="px-4 py-3">{t.destination.name}</td>
                    <td className="px-4 py-3">
                      <PublishPill status={t.status} />
                    </td>
                    <td className="px-4 py-3">{t.upcomingDepartures}</td>
                    <td className="px-4 py-3">
                      {t.activeBookings > 0 ? (
                        <Link
                          href={`/bookings?tour=${t.slug}`}
                          className="font-semibold text-primary-ink hover:underline"
                        >
                          {t.activeBookings}
                        </Link>
                      ) : (
                        0
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-3">{timeAgo(t.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
