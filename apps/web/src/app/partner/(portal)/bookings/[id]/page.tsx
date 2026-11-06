import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@pegah/ui";
import { HoldPanel } from "@/app/account/bookings/[id]/hold-panel";
import { BookingStatusBadge } from "@/components/shop/booking-status";
import type { Locale } from "@/i18n/locales";
import { requirePartner, serverApi } from "@/lib/api-server";
import { calendarDate, dhakaDateTime, money } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partner"))("booking.metaTitle") };
}

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
  const t = await getTranslations("partner");
  const tStatus = await getTranslations("status");
  const locale = (await getLocale()) as Locale;
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
        ? { tone: "bg-good-soft text-good", text: t("booking.paid") }
        : sp.payment === "failed" || sp.payment === "cancelled"
          ? { tone: "bg-warn-soft text-warn", text: t("booking.failed") }
          : { tone: "bg-warn-soft text-warn", text: t("booking.waiting") };

  return (
    <div className="mx-auto grid max-w-[980px] gap-6">
      <Link
        href="/partner/bookings"
        className="inline-flex items-center gap-1 text-[0.86rem] font-semibold text-ink-2 no-underline hover:text-ink"
      >
        <Icon name="arrowLeft" className="size-4" /> {t("nav.clientBookings")}
      </Link>

      {sp.new === "1" && b.status === "PENDING_PAYMENT" && (
        <p role="status" className="rounded-[14px] bg-good-soft px-4 py-3 text-[0.95rem] text-good">
          {t.rich("booking.held", { b: (c) => <b>{c}</b> })}
        </p>
      )}
      {paymentNote && (
        <p role="status" className={`rounded-[14px] px-4 py-3 text-[0.95rem] ${paymentNote.tone}`}>
          {paymentNote.text}
        </p>
      )}

      <div>
        <p className="tabular text-[0.84rem] text-ink-3">
          {t("booking.reference", { ref: b.reference })}
        </p>
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
          <h2 className="text-[1rem] font-semibold">{t("booking.trip")}</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-[0.92rem]">
            <div>
              <dt className="text-[0.76rem] uppercase tracking-[0.08em] text-ink-3">
                {b.productType === "HOTEL" ? t("booking.checkIn") : t("booking.departs")}
              </dt>
              <dd className="tabular mt-1 font-semibold">{calendarDate(b.startDate, locale)}</dd>
            </div>
            {b.endDate && (
              <div>
                <dt className="text-[0.76rem] uppercase tracking-[0.08em] text-ink-3">
                  {b.productType === "HOTEL" ? t("booking.checkOut") : t("booking.returns")}
                </dt>
                <dd className="tabular mt-1 font-semibold">{calendarDate(b.endDate, locale)}</dd>
              </div>
            )}
          </dl>
          <ul className="mt-5 grid gap-2 border-t border-rule pt-4 text-[0.92rem]">
            {b.items.map((i) => (
              <li key={i.description}>{i.description}</li>
            ))}
          </ul>
          <h3 className="mt-5 text-[0.9rem] font-semibold">{t("booking.clientTravellers")}</h3>
          <p className="mt-2 text-[0.92rem]">
            {b.contactName} · {b.contactEmail} · {b.contactPhone}
          </p>
          <ul className="mt-2 grid gap-1 text-[0.92rem] text-ink-2">
            {b.travellers.map((tr, i) => (
              <li key={`${tr.fullName}-${i}`}>
                {tr.fullName} {tr.isLead ? t("booking.lead") : ""} ·{" "}
                {tr.ageGroup === "ADULT" ? t("booking.adult") : t("booking.child")}
              </li>
            ))}
          </ul>
        </section>

        <aside className="grid content-start gap-4">
          <section className="panel p-5 md:p-6">
            <h2 className="text-[1rem] font-semibold">{t("booking.price")}</h2>
            <dl className="tabular mt-3 grid gap-2 text-[0.9rem]">
              <div className="flex justify-between">
                <dt className="text-ink-2">{t("booking.base")}</dt>
                <dd>{money(b.price.base)}</dd>
              </div>
              {b.price.discount.amountMinor > 0 && (
                <div className="flex justify-between text-good">
                  <dt>{t("booking.discount")}</dt>
                  <dd>− {money(b.price.discount)}</dd>
                </div>
              )}
              {b.price.serviceCharge.amountMinor > 0 && (
                <div className="flex justify-between">
                  <dt className="text-ink-2">{t("booking.serviceCharge")}</dt>
                  <dd>{money(b.price.serviceCharge)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-2">{t("booking.vat")}</dt>
                <dd>{money(b.price.vat)}</dd>
              </div>
              <div className="flex justify-between border-t border-rule pt-2 font-bold">
                <dt>{t("booking.total")}</dt>
                <dd>{money(b.total)}</dd>
              </div>
            </dl>
          </section>
          {b.agent && (
            <section className="panel p-5 md:p-6">
              <h2 className="text-[1rem] font-semibold">{t("booking.commission")}</h2>
              <p className="tabular mt-2 font-display text-[1.6rem] font-medium">
                {money(b.agent.commission)}
              </p>
              <p className="text-[0.82rem] text-ink-2">
                {confirmed ? t("booking.earned") : t("booking.earnedOnce")}
              </p>
            </section>
          )}
          <section className="panel p-5 md:p-6">
            <h2 className="text-[1rem] font-semibold">{t("booking.history")}</h2>
            <ol className="mt-2 grid gap-1.5 text-[0.84rem]">
              {b.history.map((h, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>{tStatus(h.to)}</span>
                  <span className="tabular text-ink-3">{dhakaDateTime(h.at, locale)}</span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
