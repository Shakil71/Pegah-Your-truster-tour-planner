import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@pegah/ui";
import { requireCustomer, serverApi } from "@/lib/api-server";
import type { Locale } from "@/i18n/locales";
import { calendarDate, dhakaDateTime, money } from "@/lib/format";
import { PrintButton } from "./print-button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("voucher"))("title"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * Booking voucher and tax invoice in one printable page. Only shown for
 * CONFIRMED or COMPLETED bookings: a hold or a pending payment never gets a
 * voucher, so nothing can be presented as confirmed before it is.
 */
export default async function VoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCustomer(`/account/bookings/${id}/voucher`);
  const t = await getTranslations("voucher");
  const ts = await getTranslations("status");
  const tp = await getTranslations("price");
  const locale = (await getLocale()) as Locale;
  const api = await serverApi();
  const { data: b, response } = await api.GET("/api/v1/me/bookings/{id}", {
    params: { path: { id } },
  });
  if (response.status === 404 || !b) notFound();
  const valid = b.status === "CONFIRMED" || b.status === "COMPLETED";
  const paid = b.payments.find((p) => p.status === "SUCCEEDED");

  if (!valid) {
    return (
      <main className="mx-auto max-w-[640px] px-4 py-20 text-center">
        <h1 className="font-display text-[2rem] font-medium">{t("noneYet")}</h1>
        <p className="mt-2 text-ink-2">{t("onlyWhenConfirmed", { status: ts(b.status) })}</p>
        <Link
          href={`/account/bookings/${b.id}`}
          className="mt-6 inline-block font-semibold text-primary-ink"
        >
          {t("back")}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[820px] bg-card px-6 py-10 text-ink print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <Link href={`/account/bookings/${b.id}`} className="text-[0.9rem] font-semibold text-ink-2">
          ← {t("back")}
        </Link>
        <PrintButton />
      </div>

      <header className="flex items-start justify-between gap-6 border-b border-rule pb-6">
        <div>
          <Logo className="text-[2.2rem]" />
          <p className="mt-1 text-[0.82rem] text-ink-2">{t("tagline")}</p>
        </div>
        <div className="text-right">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
            {t("heading")}
          </p>
          <p className="tabular mt-1 font-display text-[1.8rem] font-medium">{b.reference}</p>
          <p className="text-[0.82rem] text-good">{ts("CONFIRMED")}</p>
        </div>
      </header>

      <section className="grid gap-6 border-b border-rule py-6 sm:grid-cols-2">
        <div>
          <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-ink-3">
            {b.productType === "HOTEL" ? t("stay") : t("tour")}
          </h2>
          <p className="mt-1 text-[1.15rem] font-semibold">{b.productName}</p>
          {b.product.location && (
            <p className="text-[0.9rem] text-ink-2">
              {b.productType === "HOTEL" ? "" : `${t("meetingPoint")} `}
              {b.product.location}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-3 text-[0.9rem]">
          <div>
            <dt className="text-ink-3">
              {b.productType === "HOTEL" ? t("checkIn") : t("departs")}
            </dt>
            <dd className="tabular font-semibold">
              {calendarDate(b.startDate, locale)}
              {b.product.checkInTime ? `, ${t("fromTime", { time: b.product.checkInTime })}` : ""}
            </dd>
          </div>
          {b.endDate && (
            <div>
              <dt className="text-ink-3">
                {b.productType === "HOTEL" ? t("checkOut") : t("returns")}
              </dt>
              <dd className="tabular font-semibold">
                {calendarDate(b.endDate, locale)}
                {b.product.checkOutTime ? `, ${t("byTime", { time: b.product.checkOutTime })}` : ""}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section className="grid gap-6 border-b border-rule py-6 sm:grid-cols-2">
        <div>
          <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-ink-3">
            {t("travellers")}
          </h2>
          <ul className="mt-1 text-[0.92rem]">
            {b.travellers.map((g, i) => (
              <li key={`${g.fullName}-${i}`}>
                {g.fullName}
                <span className="text-ink-3">
                  {" "}
                  ({g.ageGroup === "CHILD" ? t("child") : t("adult")}
                  {g.isLead ? `, ${t("lead")}` : ""})
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-ink-3">
            {t("bookedBy")}
          </h2>
          <p className="mt-1 text-[0.92rem]">
            {b.contactName}
            <br />
            {b.contactEmail}
            <br />
            <span className="tabular">{b.contactPhone}</span>
          </p>
        </div>
      </section>

      <section className="py-6">
        <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-ink-3">
          {t("invoice")}
        </h2>
        <table className="mt-2 w-full text-[0.92rem]">
          <tbody className="tabular">
            {b.items.map((item) => (
              <tr key={item.description}>
                <td className="py-1">{item.description}</td>
                <td className="py-1 text-right" />
              </tr>
            ))}
            <tr className="border-t border-rule">
              <td className="py-1.5 text-ink-2">{tp("base", { nights: 0 })}</td>
              <td className="py-1.5 text-right">{money(b.price.base)}</td>
            </tr>
            {b.price.discount.amountMinor > 0 && (
              <tr>
                <td className="py-1 text-ink-2">
                  {b.promotionCode ? tp("discountCode", { code: b.promotionCode }) : tp("discount")}
                </td>
                <td className="py-1 text-right">− {money(b.price.discount)}</td>
              </tr>
            )}
            {b.price.serviceCharge.amountMinor > 0 && (
              <tr>
                <td className="py-1 text-ink-2">{tp("serviceCharge")}</td>
                <td className="py-1 text-right">{money(b.price.serviceCharge)}</td>
              </tr>
            )}
            <tr>
              <td className="py-1 text-ink-2">{tp("vat")}</td>
              <td className="py-1 text-right">{money(b.price.vat)}</td>
            </tr>
            <tr className="border-t border-ink font-bold">
              <td className="py-2">{paid ? t("totalPaid") : tp("total")}</td>
              <td className="py-2 text-right">{money(b.price.total)}</td>
            </tr>
          </tbody>
        </table>
        {paid && (
          <p className="mt-2 text-[0.82rem] text-ink-2">
            {t("paidVia", {
              date: paid.succeededAt ? dhakaDateTime(paid.succeededAt, locale) : "",
              provider: paid.provider,
            })}
            {paid.method ? ` (${paid.method})` : ""} · {t("paymentRef", { id: paid.id })}
          </p>
        )}
      </section>

      {b.product.cancellationPolicy && (
        <section className="border-t border-rule py-6 text-[0.84rem] text-ink-2">
          <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-ink-3">
            {t("cancellationPolicy")}
          </h2>
          <p className="mt-1">{b.product.cancellationPolicy}</p>
        </section>
      )}
      <footer className="border-t border-rule pt-4 text-[0.76rem] text-ink-3">
        {t("footer", { ref: b.reference })}
      </footer>
    </main>
  );
}
