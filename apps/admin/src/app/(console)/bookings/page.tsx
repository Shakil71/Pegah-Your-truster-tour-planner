import type { Metadata } from "next";
import { BOOKING_STATUSES, type BookingStatus } from "@pegah/contracts";
import { ensure, serverApi } from "@/lib/api-server";
import { BookingsExplorer } from "./bookings-explorer";

export const metadata: Metadata = { title: "Bookings" };

type Search = { status?: string; productType?: string; q?: string; cursor?: string };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const status = BOOKING_STATUSES.includes(sp.status as BookingStatus)
    ? (sp.status as BookingStatus)
    : undefined;
  const productType =
    sp.productType === "HOTEL" || sp.productType === "TOUR" ? sp.productType : undefined;
  const api = await serverApi();
  const page = ensure(
    await api.GET("/api/v1/admin/bookings", {
      params: {
        query: {
          status,
          productType,
          q: sp.q?.slice(0, 80) || undefined,
          cursor: sp.cursor?.slice(0, 200) || undefined,
          limit: 25,
        },
      },
    }),
  );

  return (
    <div className="mx-auto grid max-w-[1440px] gap-6">
      <div className="animate-rise">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
          Operations
        </p>
        <h1 className="mt-1.5 font-display text-[clamp(1.9rem,3vw,2.5rem)] font-medium leading-tight">
          Bookings
        </h1>
        <p className="mt-1 text-ink-2">
          Every stay and tour booking, newest first. Open one to see its travellers, price and
          status history.
        </p>
      </div>
      <BookingsExplorer page={page} />
    </div>
  );
}
