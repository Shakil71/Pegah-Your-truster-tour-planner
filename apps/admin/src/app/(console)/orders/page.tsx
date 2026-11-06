import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/no-access";
import { OrderPill } from "@/components/order-pill";
import { PageHeader } from "@/components/page-header";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { dhakaDateTime, money } from "@/lib/format";

export const metadata: Metadata = { title: "Orders" };

const STATUSES = ["PENDING_PAYMENT", "PAID", "CANCELLED", "EXPIRED"] as const;
const KINDS = ["OFFER", "GIFT_CARD"] as const;
type Status = (typeof STATUSES)[number];
type Kind = (typeof KINDS)[number];
type Search = { status?: string; kind?: string; cursor?: string };

function href(s: { status?: string; kind?: string }) {
  const q = new URLSearchParams();
  if (s.status) q.set("status", s.status);
  if (s.kind) q.set("kind", s.kind);
  const qs = q.toString();
  return qs ? `/orders?${qs}` : "/orders";
}

const chip = (on: boolean) =>
  on
    ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-[0.78rem] font-semibold text-on-primary"
    : "rounded-full border border-rule px-3 py-1.5 text-[0.78rem] font-semibold text-ink-2 hover:border-ink hover:text-ink";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await requireStaff();
  if (!session.user.permissions.includes("payment:read")) {
    return <NoAccess what="orders" permission="payment:read" />;
  }
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as Status) ? (sp.status as Status) : undefined;
  const kind = KINDS.includes(sp.kind as Kind) ? (sp.kind as Kind) : undefined;
  const api = await serverApi();
  const page = ensure(
    await api.GET("/api/v1/admin/orders", {
      params: {
        query: { status, kind, cursor: sp.cursor?.slice(0, 200) || undefined, limit: 50 },
      },
    }),
  );

  return (
    <div className="mx-auto grid max-w-[1440px] gap-6">
      <PageHeader
        eyebrow="Growth"
        title="Orders"
        intro="Offer packages and gift cards bought on the website. Each new order and each payment is also emailed to the purchase-alert address in Settings. If a customer paid by bKash, Nagad or bank transfer, open the order and mark it as paid."
      />
      <section className="panel overflow-hidden" aria-label="Orders">
        <nav className="grid gap-2 border-b border-rule px-4 py-3 md:px-6" aria-label="Filter">
          <div className="flex flex-wrap gap-2">
            {[undefined, ...STATUSES].map((s) => (
              <Link
                key={s ?? "ALL"}
                href={href({ status: s, kind })}
                aria-current={status === s ? "page" : undefined}
                className={chip(status === s)}
              >
                {s ? s.replaceAll("_", " ").toLowerCase() : "All statuses"}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {[undefined, ...KINDS].map((k) => (
              <Link
                key={k ?? "ALL"}
                href={href({ status, kind: k })}
                aria-current={kind === k ? "page" : undefined}
                className={chip(kind === k)}
              >
                {k === "OFFER" ? "Offers" : k === "GIFT_CARD" ? "Gift cards" : "Everything"}
              </Link>
            ))}
          </div>
        </nav>
        {page.items.length === 0 ? (
          <p className="px-6 py-14 text-center text-ink-2">No orders match.</p>
        ) : (
          <div
            className="overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Table, scrolls sideways"
          >
            <table className="w-full min-w-[900px] text-left text-[0.84rem]">
              <caption className="sr-only">Orders, newest first</caption>
              <thead>
                <tr className="text-[0.7rem] uppercase tracking-[0.08em] text-ink-3">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Placed (Dhaka)
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Order
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    What
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Buyer
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((o) => (
                  <tr key={o.id} className="border-t border-rule align-top">
                    <td className="tabular whitespace-nowrap px-4 py-3">
                      {dhakaDateTime(o.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/orders/${o.id}`}
                        className="tabular font-semibold hover:underline"
                      >
                        {o.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {o.title}
                      {o.kind === "OFFER" && o.quantity > 1 && (
                        <span className="text-ink-3"> × {o.quantity}</span>
                      )}
                      <p className="text-[0.74rem] text-ink-3">
                        {o.kind === "GIFT_CARD" ? "Gift card" : "Offer"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {o.buyer.name}
                      <p className="text-[0.74rem] text-ink-3">{o.buyer.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <OrderPill status={o.status} />
                    </td>
                    <td className="tabular px-4 py-3 text-right font-semibold">{money(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {page.nextCursor && (
          <div className="border-t border-rule px-4 py-3 text-right md:px-6">
            <Link
              href={`${href({ status, kind })}${status || kind ? "&" : "?"}cursor=${encodeURIComponent(page.nextCursor)}`}
              className="text-[0.84rem] font-semibold text-primary-ink hover:underline"
            >
              Older orders →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
