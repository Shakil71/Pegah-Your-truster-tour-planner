import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@pegah/ui";
import { PageShell, PaymentNotice } from "@/components/shop/page-shell";
import { requireCustomer, requirePartner, serverApi } from "@/lib/api-server";
import { calendarDate, money } from "@/lib/format";
import { parseStayParams } from "@/lib/trip";
import { CheckoutForm } from "./checkout-form";
import { PromoField } from "./promo-field";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

type Search = Record<string, string | undefined>;

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const count = (v: string | undefined, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const returnTo = `/checkout?${new URLSearchParams(
    Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"),
  )}`;
  /** Agents book for a client through the partner API; the client is the contact. */
  const agentMode = sp.as === "agent";
  const session = agentMode ? await requirePartner("AGENT") : await requireCustomer(returnTo);
  const api = await serverApi();

  let quote;
  let request:
    | {
        product: "HOTEL";
        roomId: string;
        checkIn: string;
        checkOut: string;
        rooms: number;
        adults: number;
        children: number;
      }
    | { product: "TOUR"; departureId: string; adults: number; children: number }
    | null = null;
  const promoCode =
    sp.promo && /^[A-Za-z0-9-]{3,40}$/.test(sp.promo) ? sp.promo.toUpperCase() : undefined;
  if (sp.product === "HOTEL" && sp.room && ULID.test(sp.room)) {
    const stay = parseStayParams(sp);
    request = { product: "HOTEL", roomId: sp.room, ...stay };
    quote = await api.GET("/api/v1/quotes/hotel", {
      params: { query: { roomId: sp.room, ...stay, ...(promoCode ? { promoCode } : {}) } },
    });
  } else if (sp.product === "TOUR" && sp.departure && ULID.test(sp.departure)) {
    const party = { adults: count(sp.adults, 1, 30, 2), children: count(sp.children, 0, 30, 0) };
    request = { product: "TOUR", departureId: sp.departure, ...party };
    quote = await api.GET("/api/v1/quotes/tour", {
      params: {
        query: { departureId: sp.departure, ...party, ...(promoCode ? { promoCode } : {}) },
      },
    });
  }

  const q = quote?.data;
  const saved = agentMode ? [] : ((await api.GET("/api/v1/me/travellers")).data?.items ?? []);
  const problem = quote?.error as { detail?: string } | undefined;

  return (
    <PageShell>
      <div className="grid gap-6">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
            {agentMode ? `Booking for a client · ${session.user.partner?.name ?? ""}` : "Checkout"}
          </p>
          <h1 className="mt-1.5 font-display text-[clamp(2rem,3.6vw,3rem)] font-medium leading-tight">
            Who is travelling?
          </h1>
        </div>

        {!request || !q ? (
          <section className="panel px-6 py-14 text-center">
            <h2 className="font-display text-[1.6rem] font-medium">
              This selection is no longer valid
            </h2>
            <p className="mt-1 text-ink-2">
              {problem?.detail ?? "Pick a room or departure again."}
            </p>
            <Link href="/stays" className="mt-4 inline-block font-semibold text-primary-ink">
              Back to stays
            </Link>
          </section>
        ) : !q.available || !q.price ? (
          <section className="panel px-6 py-14 text-center">
            <Icon name="alert" className="mx-auto size-8 text-warn" />
            <h2 className="mt-3 font-display text-[1.6rem] font-medium">No longer available</h2>
            <p className="mt-1 text-ink-2">
              {q.unavailableReason === "sold-out"
                ? "It just sold out for your selection."
                : "This option cannot be booked for your selection."}
            </p>
            <Link
              href={q.product === "HOTEL" ? `/stays/${q.productSlug}` : `/tours/${q.productSlug}`}
              className="mt-4 inline-block font-semibold text-primary-ink"
            >
              Choose another option
            </Link>
          </section>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <CheckoutForm
              request={request}
              expectedTotal={q.price.total}
              promoCode={q.promotion?.code}
              adultCount={q.adults}
              childCount={q.children}
              csrfToken={session.csrfToken}
              mode={agentMode ? "agent" : "customer"}
              savedTravellers={saved.map((t) => ({ fullName: t.fullName, ageGroup: t.ageGroup }))}
              customer={
                agentMode
                  ? { name: "", email: "", phone: "" }
                  : {
                      name: session.user.fullName,
                      email: session.user.email,
                      phone: session.user.phone ?? "",
                    }
              }
            />
            <aside className="grid content-start gap-4 lg:sticky lg:top-[96px]">
              <section className="panel p-5 md:p-6" aria-labelledby="sum-h">
                <h2 id="sum-h" className="text-[1rem] font-semibold">
                  Your selection
                </h2>
                <p className="mt-3 font-display text-[1.4rem] font-medium leading-tight">
                  {q.productName}
                </p>
                <p className="text-[0.9rem] text-ink-2">{q.optionName}</p>
                <dl className="mt-4 grid gap-2 text-[0.9rem]">
                  <div className="flex justify-between">
                    <dt className="text-ink-2">{q.product === "HOTEL" ? "Check-in" : "Departs"}</dt>
                    <dd className="tabular">{calendarDate(q.startDate)}</dd>
                  </div>
                  {q.endDate && (
                    <div className="flex justify-between">
                      <dt className="text-ink-2">
                        {q.product === "HOTEL" ? "Check-out" : "Returns"}
                      </dt>
                      <dd className="tabular">{calendarDate(q.endDate)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-ink-2">Guests</dt>
                    <dd>
                      {q.adults} adult{q.adults === 1 ? "" : "s"}
                      {q.children ? `, ${q.children} child${q.children === 1 ? "" : "ren"}` : ""}
                      {q.rooms ? ` · ${q.rooms} room${q.rooms === 1 ? "" : "s"}` : ""}
                    </dd>
                  </div>
                </dl>
                <dl className="tabular mt-4 grid gap-2 border-t border-rule pt-4 text-[0.9rem]">
                  <div className="flex justify-between">
                    <dt className="text-ink-2">
                      Base{q.nights ? ` (${q.nights} night${q.nights === 1 ? "" : "s"})` : ""}
                    </dt>
                    <dd>{money(q.price.base)}</dd>
                  </div>
                  {q.price.discount.amountMinor > 0 && (
                    <div className="flex justify-between text-good">
                      <dt>Discount{q.promotion ? ` (${q.promotion.code})` : ""}</dt>
                      <dd>− {money(q.price.discount)}</dd>
                    </div>
                  )}
                  {q.price.serviceCharge.amountMinor > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-ink-2">Service charge</dt>
                      <dd>{money(q.price.serviceCharge)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-ink-2">VAT</dt>
                    <dd>{money(q.price.vat)}</dd>
                  </div>
                  <div className="mt-1 flex justify-between border-t border-rule pt-3 text-[1.15rem] font-bold">
                    <dt>Total</dt>
                    <dd>{money(q.price.total)}</dd>
                  </div>
                </dl>
                <PromoField current={promoCode ?? ""} applied={q.promotion} error={q.promoError} />
                {q.cancellationPolicy && (
                  <p className="mt-4 text-[0.8rem] text-ink-3">{q.cancellationPolicy}</p>
                )}
              </section>
              <PaymentNotice />
            </aside>
          </div>
        )}
      </div>
    </PageShell>
  );
}
