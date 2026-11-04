import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import type { Schemas } from "@pegah/api-client";
import { cx } from "@pegah/ui";
import houseboat from "@/assets/images/tanguar-houseboat.jpg";
import sundarbans from "@/assets/images/hero-sundarbans-sunrise.jpg";
import nafakhum from "@/assets/images/nafakhum-falls.jpg";
import ratargul from "@/assets/images/ratargul-boatman.jpg";
import sajek from "@/assets/images/sajek-sunrise.jpg";
import { dhakaDateTime } from "@/lib/format";

type Departure = Schemas["DashboardSummaryDto_Output"]["departures"][number];

/** Licensed stock photos (IMAGE_CREDITS.md) matched to a tour by keyword. */
const PHOTOS: Array<[RegExp, StaticImageData]> = [
  [/sundarban|mangrove|cruise/, sundarbans],
  [/bandarban|nafakhum|trek|thanchi/, nafakhum],
  [/sajek|hill/, sajek],
  [/ratargul|swamp/, ratargul],
  [/haor|tanguar|houseboat/, houseboat],
];
const photoFor = (slug: string) => PHOTOS.find(([re]) => re.test(slug))?.[1] ?? houseboat;

export function Departures({ items }: { items: Departure[] }) {
  return (
    <section
      className="panel animate-rise p-5 md:p-6"
      aria-labelledby="dep-h"
      style={{ animationDelay: "420ms" }}
    >
      <h2 id="dep-h" className="text-[0.95rem] font-semibold">
        Upcoming departures
      </h2>
      <p className="mt-1 text-[0.78rem] text-ink-3">Seats sold or held of capacity</p>
      {items.length === 0 ? (
        <p className="mt-4 text-[0.86rem] text-ink-2">No scheduled departures.</p>
      ) : (
        <ul className="mt-4 grid gap-4">
          {items.map((d) => {
            const taken = d.sold + d.held;
            const pct = Math.round((taken / Math.max(1, d.capacity)) * 100);
            const full = taken >= d.capacity;
            return (
              <li key={d.id} className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3">
                <span className="relative size-[52px] overflow-hidden rounded-[12px]">
                  <Image
                    src={photoFor(d.tourSlug)}
                    alt=""
                    fill
                    sizes="52px"
                    className="object-cover"
                  />
                </span>
                <div className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <Link
                      href="/bookings?productType=TOUR"
                      className="truncate text-[0.86rem] font-semibold hover:underline"
                    >
                      {d.tourTitle}
                    </Link>
                    <p className="tabular shrink-0 text-[0.78rem] font-bold">
                      {taken}/{d.capacity}
                    </p>
                  </div>
                  <p className="text-[0.74rem] text-ink-3">
                    {dhakaDateTime(d.departsAt)}
                    {d.held > 0 && ` · ${d.held} held`}
                    {full && " · full"}
                  </p>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-paper-2">
                    <span
                      className={cx("block h-full rounded-full", full ? "bg-ink" : "bg-primary")}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
