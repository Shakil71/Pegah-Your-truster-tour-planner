import type { Metadata } from "next";
import Link from "next/link";
import { PartnerBookingTable } from "@/components/partner/booking-table";
import { ensure, requirePartner, serverApi } from "@/lib/api-server";

export const metadata: Metadata = { title: "Reservations" };

/** Bookings at the supplier's own hotels and on its tours, newest first. */
export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  await requirePartner("SUPPLIER");
  const { cursor } = await searchParams;
  const api = await serverApi();
  const page = ensure(
    await api.GET("/api/v1/partner/reservations", {
      params: { query: { limit: 30, cursor: cursor?.slice(0, 200) || undefined } },
    }),
  );
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-[clamp(1.9rem,3vw,2.5rem)] font-medium leading-tight">
          Reservations
        </h1>
        <p className="mt-1 text-[0.9rem] text-ink-2">
          Guests booked at your properties and on your tours. Only confirmed bookings are
          guaranteed; held ones may still expire.
        </p>
      </div>
      <PartnerBookingTable items={page.items} showCommission={false} />
      {page.nextCursor && (
        <Link
          href={`/partner/reservations?cursor=${encodeURIComponent(page.nextCursor)}`}
          className="justify-self-start font-semibold text-primary-ink"
        >
          Older reservations →
        </Link>
      )}
    </div>
  );
}
