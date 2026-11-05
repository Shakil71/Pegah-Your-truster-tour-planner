import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@pegah/ui";
import { HoldPanel } from "@/app/account/bookings/[id]/hold-panel";
import { BookingStatusBadge } from "@/components/shop/booking-status";
import { requirePartner, serverApi } from "@/lib/api-server";
import { calendarDate, dhakaDateTime, money } from "@/lib/format";

export const metadata: Metadata = { title: "Client booking" };

/** One booking the agent made for a client: hold, payment and commission. */
export default async function AgentBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string; payment?: string }>;
}) {
  const { id } = await params;
  const session = await requirePartner("AGENT");
  const api = await serverApi();
  const { data: b, response } = await api.GET("/api/v1/partner/bookings/{id}", {
    params: { path: { id } },
  });
  if (response.status === 404 || !b) notFound();
  const sp = await searchParams;
  const confirmed = b.status === "CONFIRMED" || b.status === "COMPLETED";
  // The banner follows the booking's real status, never just the query string.
  const paymentNote =
    sp.payment === undefined
      ? null
      : confirmed
        ? { tone: "bg-good-soft text-good", text: "Payment received. The booking is confirmed." }
        : sp.payment === "failed" || sp.payment === "cancelled"
          ? {
              tone: "bg-warn-soft text-warn",
              text: "The payment did not complete. You can try again while the hold lasts.",
            }
          : {
              tone: "bg-warn-soft text-warn",
              text: "Waiting for the payment provider to confirm. Refresh in a minute.",
            };

  return (
    <div className="mx-auto grid max-w-[980px] gap-6">
      <Link
        href="/partner/bookings"
        className="inline-flex items-center gap-1 text-[0.86rem] font-semibold text-ink-2 no-underline hover:text-ink"
      >
        <Icon name="arrowLeft" className="size-4" /> Client bookings
      </Link>

      {sp.new === "1" && b.status === "PENDING_PAYMENT" && (
        <p role="status" className="rounded-[14px] bg-good-soft px-4 py-3 text-[0.95rem] text-good">
          <b>Held for your client.</b> It is not confirmed until payment is completed.
        </p>
      )}
      {paymentNote && (
        <p role="status" className={`rounded-[14px] px-4 py-3 text-[0.95rem] ${paymentNote.tone}`}>
          {paymentNote.text}
        </p>
      )}

      <div>
        <p className="tabular text-[0.84rem] text-ink-3">Reference {b.reference}</p>
        <h1 className="mt-1 font-display text-[clamp(1.9rem,3vw,2.5rem)] font-medium leading-tight">
          {b.productName}
        </h1>
        <div className="mt-3">
          <BookingStatusBadge status={b.status} />
        </div>
      </div>

      {b.status === "PENDING_PAYMENT" && b.holdExpiresAt && (
        <HoldPanel
          bookingId={b.id}
          holdExpiresAt={b.holdExpiresAt}
          csrfToken={session.csrfToken}
          canPay={b.canPay}
          agent
        />
      )}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="panel p-5 md:p-6">
          <h2 className="text-[1rem] font-semibold">Trip</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-[0.92rem]">
            <div>
              <dt className="text-[0.76rem] uppercase tracking-[0.08em] text-ink-3">
                {b.productType === "HOTEL" ? "Check-in" : "Departs"}
              </dt>
              <dd className="tabular mt-1 font-semibold">{calendarDate(b.startDate)}</dd>
            </div>
            {b.endDate && (
              <div>
                <dt className="text-[0.76rem] uppercase tracking-[0.08em] text-ink-3">
                  {b.productType === "HOTEL" ? "Check-out" : "Returns"}
                </dt>
                <dd className="tabular mt-1 font-semibold">{calendarDate(b.endDate)}</dd>
              </div>
            )}
          </dl>
          <ul className="mt-5 grid gap-2 border-t border-rule pt-4 text-[0.92rem]">
            {b.items.map((i) => (
              <li key={i.description}>{i.description}</li>
            ))}
          </ul>
          <h3 className="mt-5 text-[0.9rem] font-semibold">Client and travellers</h3>
          <p className="mt-2 text-[0.92rem]">
            {b.contactName} · {b.contactEmail} · {b.contactPhone}
          </p>
          <ul className="mt-2 grid gap-1 text-[0.92rem] text-ink-2">
            {b.travellers.map((t, i) => (
              <li key={`${t.fullName}-${i}`}>
                {t.fullName} {t.isLead ? "(lead)" : ""} ·{" "}
                {t.ageGroup === "ADULT" ? "adult" : "child"}
              </li>
            ))}
          </ul>
        </section>

        <aside className="grid content-start gap-4">
          <section className="panel p-5 md:p-6">
            <h2 className="text-[1rem] font-semibold">Price</h2>
            <dl className="tabular mt-3 grid gap-2 text-[0.9rem]">
              <div className="flex justify-between">
                <dt className="text-ink-2">Base</dt>
                <dd>{money(b.price.base)}</dd>
              </div>
              {b.price.discount.amountMinor > 0 && (
                <div className="flex justify-between text-good">
                  <dt>Discount</dt>
                  <dd>− {money(b.price.discount)}</dd>
                </div>
              )}
              {b.price.serviceCharge.amountMinor > 0 && (
                <div className="flex justify-between">
                  <dt className="text-ink-2">Service charge</dt>
                  <dd>{money(b.price.serviceCharge)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-2">VAT</dt>
                <dd>{money(b.price.vat)}</dd>
              </div>
              <div className="flex justify-between border-t border-rule pt-2 font-bold">
                <dt>Total</dt>
                <dd>{money(b.total)}</dd>
              </div>
            </dl>
          </section>
          {b.agent && (
            <section className="panel p-5 md:p-6">
              <h2 className="text-[1rem] font-semibold">Your commission</h2>
              <p className="tabular mt-2 font-display text-[1.6rem] font-medium">
                {money(b.agent.commission)}
              </p>
              <p className="text-[0.82rem] text-ink-2">
                {confirmed
                  ? "Earned. It appears on your monthly statement."
                  : "Earned once confirmed."}
              </p>
            </section>
          )}
          <section className="panel p-5 md:p-6">
            <h2 className="text-[1rem] font-semibold">History</h2>
            <ol className="mt-2 grid gap-1.5 text-[0.84rem]">
              {b.history.map((h, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>{h.to.replaceAll("_", " ").toLowerCase()}</span>
                  <span className="tabular text-ink-3">{dhakaDateTime(h.at)}</span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
