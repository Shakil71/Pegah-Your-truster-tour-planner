import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@pegah/ui";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { REQUEST_STATUS, RequestPill } from "@/components/request-pill";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { dhakaDateTime, money } from "@/lib/format";

export const metadata: Metadata = { title: "Visa and flight requests" };

const STATUSES = Object.keys(REQUEST_STATUS) as Array<keyof typeof REQUEST_STATUS>;
const KINDS = ["VISA", "FLIGHT"] as const;
type Search = { status?: string; kind?: string; q?: string; cursor?: string };
type Status =
  | "SUBMITTED"
  | "NEEDS_INFO"
  | "QUOTED"
  | "PAID"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

function href(s: { status?: string; kind?: string; q?: string; cursor?: string }) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(s)) if (v) q.set(k, v);
  const qs = q.toString();
  return qs ? `/requests?${qs}` : "/requests";
}
const chip = (on: boolean) =>
  on
    ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-[0.78rem] font-semibold text-on-primary"
    : "rounded-full border border-rule px-3 py-1.5 text-[0.78rem] font-semibold text-ink-2 hover:border-ink hover:text-ink";

export default async function RequestsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await requireStaff();
  if (!session.user.permissions.includes("service:manage")) {
    return <NoAccess what="visa and flight requests" permission="service:manage" />;
  }
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as never) ? (sp.status as Status) : undefined;
  const kind = KINDS.includes(sp.kind as never) ? (sp.kind as "VISA" | "FLIGHT") : undefined;
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const api = await serverApi();
  const page = ensure(
    await api.GET("/api/v1/admin/requests", {
      params: {
        query: { status, kind, q, cursor: sp.cursor?.slice(0, 40) || undefined, limit: 50 },
      },
    }),
  );

  return (
    <div className="mx-auto grid max-w-[1440px] gap-6">
      <PageHeader
        eyebrow="Services"
        title="Visa and flight requests"
        intro="Requests from the website. Ask for what is missing, send a price, record the payment when it arrives, then complete. Customers see every step except internal notes, and get an email for each one."
      />
      <section className="panel overflow-hidden" aria-label="Requests">
        <nav className="grid gap-2 border-b border-rule px-4 py-3 md:px-6" aria-label="Filter">
          <div className="flex flex-wrap gap-2">
            {[undefined, ...KINDS].map((k) => (
              <Link
                key={k ?? "ALL"}
                href={href({ kind: k, status, q })}
                aria-current={kind === k ? "page" : undefined}
                className={chip(kind === k)}
              >
                {k === "VISA" ? "Visa" : k === "FLIGHT" ? "Flights" : "All kinds"}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {[undefined, ...STATUSES].map((s) => (
              <Link
                key={s ?? "ALL"}
                href={href({ status: s, kind, q })}
                aria-current={status === s ? "page" : undefined}
                className={chip(status === s)}
              >
                {s ? REQUEST_STATUS[s]!.label : "Any status"}
              </Link>
            ))}
          </div>
          <form action="/admin/requests" className="flex flex-wrap items-end gap-2">
            {kind && <input type="hidden" name="kind" value={kind} />}
            {status && <input type="hidden" name="status" value={status} />}
            <label className="grid gap-1 text-[0.76rem] font-semibold text-ink-2">
              Search reference, name, phone or email
              <input
                name="q"
                defaultValue={q}
                maxLength={80}
                className="h-9 w-72 max-w-full rounded-md border border-rule bg-card px-3 text-[0.86rem] text-ink"
              />
            </label>
            <button className="h-9 rounded-md border border-rule px-3 text-[0.84rem] font-semibold hover:border-ink">
              Search
            </button>
          </form>
        </nav>
        {page.items.length === 0 ? (
          <p className="px-6 py-14 text-center text-ink-2">No requests match.</p>
        ) : (
          <div
            className="overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Table, scrolls sideways"
          >
            <table className="w-full min-w-[820px] text-left text-[0.86rem]">
              <caption className="sr-only">Requests, newest first</caption>
              <thead>
                <tr className="text-[0.7rem] uppercase tracking-[0.08em] text-ink-3">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Request
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Customer
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Price
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Updated (Dhaka)
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((r) => (
                  <tr key={r.id} className="border-t border-rule align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/requests/${r.id}`}
                        className="inline-flex items-start gap-2 font-semibold text-primary-ink hover:underline"
                      >
                        <Icon
                          name={r.kind === "VISA" ? "doc" : "plane"}
                          className="mt-0.5 size-4 shrink-0"
                        />
                        <span>
                          {r.title}
                          <span className="tabular block text-[0.76rem] font-normal text-ink-3">
                            {r.reference} · {r.travellers} traveller{r.travellers === 1 ? "" : "s"}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {r.customerName}
                      <span className="tabular block text-[0.76rem] text-ink-3">
                        {r.contactPhone}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RequestPill status={r.status} />
                    </td>
                    <td className="tabular px-4 py-3 text-right">
                      {r.quote ? money(r.quote) : "—"}
                    </td>
                    <td className="tabular whitespace-nowrap px-4 py-3">
                      {dhakaDateTime(r.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {page.nextCursor && (
          <div className="border-t border-rule px-4 py-3 text-right md:px-6">
            <Link
              href={href({ status, kind, q, cursor: page.nextCursor })}
              className="text-[0.84rem] font-semibold text-primary-ink"
            >
              Older requests →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
