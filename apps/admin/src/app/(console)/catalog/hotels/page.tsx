import type { Metadata } from "next";
import Link from "next/link";
import { Icon, buttonClass } from "@pegah/ui";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { PublishPill } from "@/components/publish-pill";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Hotels and rooms" };

export default async function HotelsPage() {
  const session = await requireStaff();
  if (!session.user.permissions.includes("catalog:read")) {
    return <NoAccess what="the catalog" permission="catalog:read" />;
  }
  const api = await serverApi();
  const { items } = ensure(await api.GET("/api/v1/admin/hotels"));
  const canManage = session.user.permissions.includes("catalog:manage");

  return (
    <div className="mx-auto grid max-w-[1440px] gap-6">
      <PageHeader
        eyebrow="Catalog"
        title="Hotels and rooms"
        intro="Properties, their room types, and what is on sale each night. Changes reach the website within five minutes."
        actions={
          canManage && (
            <Link href="/catalog/hotels/new" className={buttonClass("primary", "md")}>
              <Icon name="plus" className="size-[18px]" /> New hotel
            </Link>
          )
        }
      />
      <section className="panel overflow-hidden" aria-label="Hotels">
        {items.length === 0 ? (
          <p className="px-6 py-14 text-center text-ink-2">No hotels yet.</p>
        ) : (
          <div
            className="overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Table, scrolls sideways"
          >
            <table className="w-full min-w-[820px] text-left text-[0.86rem]">
              <thead>
                <tr className="text-[0.7rem] uppercase tracking-[0.08em] text-ink-3">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Hotel
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Destination
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Room types
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
                {items.map((h) => (
                  <tr key={h.id} className="border-t border-rule hover:bg-paper">
                    <td className="px-4 py-3">
                      <Link
                        href={`/catalog/hotels/${h.slug}`}
                        className="font-semibold hover:underline"
                      >
                        {h.name}
                      </Link>
                      <p className="text-[0.76rem] text-ink-3">
                        {h.starRating ? `${"★".repeat(h.starRating)} · ` : ""}/{h.slug}
                      </p>
                    </td>
                    <td className="px-4 py-3">{h.destination.name}</td>
                    <td className="px-4 py-3">
                      <PublishPill status={h.status} />
                    </td>
                    <td className="px-4 py-3">{h.roomCount}</td>
                    <td className="px-4 py-3">
                      {h.activeBookings > 0 ? (
                        <Link
                          href={`/bookings?hotel=${h.slug}`}
                          className="font-semibold text-primary-ink hover:underline"
                        >
                          {h.activeBookings}
                        </Link>
                      ) : (
                        0
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-3">{timeAgo(h.updatedAt)}</td>
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
