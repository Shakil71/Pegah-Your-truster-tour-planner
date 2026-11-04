import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@pegah/ui";
import { BookingStatusBadge } from "@/components/shop/booking-status";
import { PageShell } from "@/components/shop/page-shell";
import { requireCustomer, serverApi } from "@/lib/api-server";
import { calendarDate, dhakaDateTime, money } from "@/lib/format";
import { CancellationRequest } from "./cancellation-request";
import { HoldPanel } from "./hold-panel";

const PAYMENT_LABEL: Record<string, string> = {
  INITIATED: "started",
  PENDING: "waiting",
  SUCCEEDED: "paid",
  FAILED: "failed",
  CANCELLED: "cancelled",
  REFUND_REQUIRED: "being refunded",
};

export const metadata: Metadata = { title: "Trip details", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string; payment?: string }>;
}) {
  const { id } = await params;
  const session = await requireCustomer(`/account/bookings/${id}`);
  const api = await serverApi();
  const { data: b, response } = await api.GET("/api/v1/me/bookings/{id}", {
    params: { path: { id } },
  });
  if (response.status === 404 || !b) notFound();
  const sp = await searchParams;
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
  const justHeld = sp.new === "1" && b.status === "PENDING_PAYMENT";
  // The banner follows the booking's real status, not just the query string.
  const paymentNote =
    sp.payment === undefined
      ? null
      : b.status === "CONFIRMED"
        ? { tone: "good", text: "Payment received. Your booking is confirmed." }
        : sp.payment === "failed"
          ? {
              tone: "critical",
              text: "The payment did not go through. You can try again while the hold lasts.",
            }
          : sp.payment === "cancelled"
            ? {
                tone: "warn",
                text: "Payment cancelled. Your hold is still active until the timer ends.",
              }
            : sp.payment === "review" || b.status === "MANUAL_REVIEW"
              ? {
                  tone: "warn",
                  text: "We received a payment that needs a quick check by our team. We will contact you shortly.",
                }
              : {
                  tone: "warn",
                  text: "We are waiting for the payment provider to confirm. Refresh in a minute.",
                };

  return (
    <PageShell>
      <div className="mx-auto grid max-w-[980px] gap-6">
        <Link
          href="/account/bookings"
          className="inline-flex items-center gap-1 text-[0.86rem] font-semibold text-ink-2 no-underline hover:text-ink"
        >
          <Icon name="arrowLeft" className="size-4" /> My trips
        </Link>

        {justHeld && (
          <p
            role="status"
            className="rounded-[14px] bg-good-soft px-4 py-3 text-[0.95rem] text-good"
          >
            <b>Held.</b> We are keeping this for you. It is not confirmed yet.
          </p>
        )}

        <div>
          <p className="tabular text-[0.84rem] text-ink-3">Reference {b.reference}</p>
          <h1 className="mt-1 font-display text-[clamp(2rem,3.6vw,2.8rem)] font-medium leading-tight">
            {b.productName}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <BookingStatusBadge status={b.status} />
            {b.product.slug && (
              <Link
                href={`/${b.productType === "HOTEL" ? "stays" : "tours"}/${b.product.slug}`}
                className="text-[0.88rem] font-semibold text-primary-ink"
              >
                View the {b.productType === "HOTEL" ? "property" : "tour"} →
              </Link>
            )}
            {(b.status === "CONFIRMED" || b.status === "COMPLETED") && (
              <Link
                href={`/account/bookings/${b.id}/voucher`}
                className="rounded-full bg-primary px-4 py-1.5 text-[0.86rem] font-semibold text-on-primary"
              >
                Voucher and invoice
              </Link>
            )}
          </div>
        </div>

        {b.status === "CONFIRMED" && b.startDate > todayIso && (
          <CancellationRequest
            bookingId={b.id}
            policy={b.product.cancellationPolicy}
            csrfToken={session.csrfToken}
          />
        )}
        {b.status === "CANCELLATION_REQUESTED" && (
          <p
            role="status"
            className="rounded-[14px] bg-warn-soft px-4 py-3 text-[0.95rem] text-warn"
          >
            We received your cancellation request. Our team will email you the decision. Your
            booking stays valid until then.
          </p>
        )}
        {b.refunds.length > 0 && (
          <section className="panel p-5 md:p-6">
            <h2 className="text-[1rem] font-semibold">Refunds</h2>
            <ul className="mt-2 grid gap-1.5 text-[0.9rem]">
              {b.refunds.map((r) => (
                <li key={r.id} className="flex justify-between gap-3">
                  <span>
                    {r.status === "PAID"
                      ? `Sent ${r.paidAt ? dhakaDateTime(r.paidAt) : ""}`
                      : "Approved, being processed"}
                  </span>
                  <span className="tabular font-semibold">{money(r.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {paymentNote && (
          <p
            role="status"
            className={`rounded-[14px] px-4 py-3 text-[0.95rem] ${
              paymentNote.tone === "good"
                ? "bg-good-soft text-good"
                : paymentNote.tone === "critical"
                  ? "bg-critical-soft text-critical"
                  : "bg-warn-soft text-warn"
            }`}
          >
            {paymentNote.text}
          </p>
        )}

        {b.status === "PENDING_PAYMENT" && b.holdExpiresAt && (
          <HoldPanel
            bookingId={b.id}
            holdExpiresAt={b.holdExpiresAt}
            csrfToken={session.csrfToken}
            canPay={b.canPay}
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
            <h3 className="mt-5 text-[0.9rem] font-semibold">Travellers</h3>
            <ul className="mt-2 grid gap-1 text-[0.92rem]">
              {b.travellers.map((t, i) => (
                <li key={`${t.fullName}-${i}`}>
                  {t.fullName}
                  <span className="text-ink-3">
                    {" "}
                    · {t.ageGroup === "CHILD" ? "child" : "adult"}
                    {t.isLead ? " · lead guest" : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[0.86rem] text-ink-2">
              Updates go to {b.contactEmail} and {b.contactPhone}.
            </p>
          </section>

          <div className="grid content-start gap-6">
            <section className="panel p-5 md:p-6">
              <h2 className="text-[1rem] font-semibold">Price</h2>
              <dl className="tabular mt-4 grid gap-2 text-[0.92rem]">
                <div className="flex justify-between">
                  <dt className="text-ink-2">Base</dt>
                  <dd>{money(b.price.base)}</dd>
                </div>
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
                <div className="mt-1 flex justify-between border-t border-rule pt-3 text-[1.1rem] font-bold">
                  <dt>Total</dt>
                  <dd>{money(b.price.total)}</dd>
                </div>
              </dl>
            </section>
            {b.payments.length > 0 && (
              <section className="panel p-5 md:p-6">
                <h2 className="text-[1rem] font-semibold">Payments</h2>
                <ul className="mt-3 grid gap-2 text-[0.88rem]">
                  {b.payments.map((pay) => (
                    <li key={pay.id} className="flex justify-between gap-3">
                      <span>
                        {dhakaDateTime(pay.createdAt)}
                        {pay.method ? ` · ${pay.method}` : ""}
                      </span>
                      <span className="font-semibold">
                        {money(pay.amount)} · {PAYMENT_LABEL[pay.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="panel p-5 md:p-6">
              <h2 className="text-[1rem] font-semibold">History</h2>
              <ol className="mt-3 grid gap-3 text-[0.86rem]">
                {b.history.map((h, i) => (
                  <li key={`${h.at}-${i}`}>
                    <p className="font-semibold">
                      {h.reason ?? h.to.replaceAll("_", " ").toLowerCase()}
                    </p>
                    <p className="text-ink-3">{dhakaDateTime(h.at)}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
