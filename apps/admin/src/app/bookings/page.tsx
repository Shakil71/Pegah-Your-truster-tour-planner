import type { Metadata } from "next";
import { bookings } from "@/data/sample";
import { BookingsExplorer } from "./bookings-explorer";

export const metadata: Metadata = { title: "Bookings" };

export default function BookingsPage() {
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
          Every stay and tour booking, newest first. Sample data until the admin API is connected.
        </p>
      </div>
      <BookingsExplorer rows={bookings} />
    </div>
  );
}
