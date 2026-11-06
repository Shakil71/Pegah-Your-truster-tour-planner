import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/no-access";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { dhakaDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Old website data" };

/** Friendly names for the tables staff look at most; others show their table name. */
const LABELS: Record<string, string> = {
  hotel_reservations: "Hotel bookings",
  hotel_reservation_rooms: "Hotel booking rooms",
  hotel_reservation_guests: "Hotel booking guests",
  tour_reservations: "Tour bookings",
  flight_reservations: "Flight bookings",
  flight_reservation_guests: "Flight booking guests",
  user_messages: "Contact messages",
  subscribers: "Newsletter subscribers",
  users: "Customers",
  hotels: "Hotels",
  hotel_rooms: "Rooms",
  tours: "Tours",
  packages: "Packages",
  gift_cards: "Gift card designs",
  gift_card_orders: "Gift card orders",
  merchant_payments: "Manual payments",
  hotel_booking_transactions: "Online payments",
  coupons: "Coupons",
  contacts: "Contact details",
};
const FIRST = Object.keys(LABELS);
const label = (t: string) => LABELS[t] ?? t.replaceAll("_", " ");
const TARGETS: Record<string, string> = {
  hotel: "Hotel",
  hotel_room: "Room",
  tour: "Tour",
  offer: "Offer",
  user: "Customer",
  destination: "Destination",
  amenity: "Amenity",
  promotion: "Promotion",
  content_page: "Page",
};
const cell = (v: string | null) => {
  if (v === null || v === "") return "—";
  const plain = v
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 140 ? `${plain.slice(0, 139)}…` : plain;
};

type Search = { table?: string; q?: string; cursor?: string };

export default async function OldWebsitePage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await requireStaff();
  if (!session.user.permissions.includes("legacy:read")) {
    return <NoAccess what="the old website data" permission="legacy:read" />;
  }
  const sp = await searchParams;
  const api = await serverApi();
  const { tables, total } = ensure(await api.GET("/api/v1/admin/legacy/tables"));
  const sorted = [...tables].sort((a, b) => {
    const ia = FIRST.indexOf(a.table);
    const ib = FIRST.indexOf(b.table);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.table.localeCompare(b.table);
  });
  const table = tables.some((t) => t.table === sp.table) ? sp.table! : sorted[0]?.table;
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const page = table
    ? ensure(
        await api.GET("/api/v1/admin/legacy/records", {
          params: { query: { table, q, cursor: sp.cursor?.slice(0, 200) || undefined, limit: 50 } },
        }),
      )
    : null;
  const columns = page?.items[0] ? Object.keys(page.items[0].payload) : [];
  const qs = (extra: Record<string, string>) =>
    `/old-website?${new URLSearchParams({ ...(table ? { table } : {}), ...(q ? { q } : {}), ...extra })}`;

  return (
    <div className="mx-auto grid max-w-[1440px] gap-6">
      <div className="animate-rise">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
          System
        </p>
        <h1 className="mt-1.5 font-display text-[clamp(1.9rem,3vw,2.5rem)] font-medium leading-tight">
          Old website data
        </h1>
        <p className="mt-1 max-w-[75ch] text-ink-2">
          Every record imported from the previous Pegah website ({total.toLocaleString("en-US")}{" "}
          rows), exactly as it was. Hotels, rooms, tours, packages and customers were also created
          here as drafts; this page is the read-only original. Passwords, login sessions and
          one-time codes were not imported.
        </p>
      </div>

      {tables.length === 0 ? (
        <p className="panel px-6 py-14 text-center text-ink-2">
          Nothing has been imported from the old website yet.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <nav className="panel h-fit p-3" aria-label="Old website tables">
            <ul className="grid max-h-[70vh] gap-0.5 overflow-y-auto text-[0.84rem]">
              {sorted.map((t) => (
                <li key={t.table}>
                  <Link
                    href={`/old-website?table=${t.table}`}
                    aria-current={t.table === table ? "page" : undefined}
                    className={
                      t.table === table
                        ? "flex justify-between gap-2 rounded-md bg-primary px-3 py-2 font-semibold text-on-primary"
                        : "flex justify-between gap-2 rounded-md px-3 py-2 text-ink-2 hover:bg-paper hover:text-ink"
                    }
                  >
                    <span className="truncate capitalize">{label(t.table)}</span>
                    <span className="tabular">{t.rows}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <section className="panel min-w-0 overflow-hidden" aria-label={label(table ?? "")}>
            <form
              className="flex flex-wrap items-end gap-3 border-b border-rule px-4 py-3 md:px-6"
              action="/admin/old-website"
            >
              <input type="hidden" name="table" value={table} />
              <label className="grid gap-1 text-[0.78rem] font-semibold text-ink-2">
                Search in {label(table ?? "").toLowerCase()}
                <input
                  name="q"
                  defaultValue={q}
                  maxLength={80}
                  className="h-10 w-72 max-w-full rounded-md border border-rule bg-card px-3 text-[0.9rem] text-ink"
                  placeholder="Name, phone, reference…"
                />
              </label>
              <button className="h-10 rounded-md border border-rule px-4 text-[0.86rem] font-semibold hover:border-ink">
                Search
              </button>
              {q && (
                <Link
                  href={`/old-website?table=${table}`}
                  className="h-10 content-center text-[0.84rem] font-semibold text-primary-ink"
                >
                  Clear
                </Link>
              )}
            </form>
            {!page || page.items.length === 0 ? (
              <p className="px-6 py-14 text-center text-ink-2">No rows match.</p>
            ) : (
              <div
                className="overflow-x-auto"
                tabIndex={0}
                role="region"
                aria-label="Table, scrolls sideways"
              >
                <table className="w-full text-left text-[0.8rem]">
                  <caption className="sr-only">{label(table ?? "")}, newest first</caption>
                  <thead>
                    <tr className="text-[0.68rem] uppercase tracking-[0.08em] text-ink-3">
                      <th scope="col" className="whitespace-nowrap px-3 py-3 font-semibold">
                        Now in Pegah
                      </th>
                      {columns.map((c) => (
                        <th
                          key={c}
                          scope="col"
                          className="whitespace-nowrap px-3 py-3 font-semibold"
                        >
                          {c.replaceAll("_", " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {page.items.map((r) => (
                      <tr key={r.id} className="border-t border-rule align-top">
                        <td className="whitespace-nowrap px-3 py-2.5 text-ink-2">
                          {r.targetType
                            ? `${TARGETS[r.targetType] ?? r.targetType} #${r.targetId}`
                            : "Archive only"}
                        </td>
                        {columns.map((c) => (
                          <td
                            key={c}
                            className="min-w-[90px] max-w-[320px] px-3 py-2.5"
                            title={r.payload[c] ?? ""}
                          >
                            {cell(r.payload[c] ?? null)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-rule px-4 py-3 text-[0.8rem] text-ink-3 md:px-6">
              <span>Imported {page?.items[0] ? dhakaDateTime(page.items[0].importedAt) : "—"}</span>
              {page?.nextCursor && (
                <Link
                  href={qs({ cursor: page.nextCursor })}
                  className="font-semibold text-primary-ink"
                >
                  Older rows →
                </Link>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
