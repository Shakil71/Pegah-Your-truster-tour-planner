import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { Schemas } from "@pegah/api-client";
import { BookingStatusBadge } from "@/components/shop/booking-status";
import type { Locale } from "@/i18n/locales";
import { calendarDate, money } from "@/lib/format";

type Row = Schemas["PartnerBookingListDto_Output"]["items"][number];

/** Bookings table shared by supplier reservations and agent client bookings. */
export function PartnerBookingTable({
  items,
  showCommission,
  linkTo,
}: {
  items: Row[];
  showCommission: boolean;
  linkTo?: (id: string) => string;
}) {
  const t = useTranslations("partner");
  const locale = useLocale() as Locale;
  if (items.length === 0) {
    return <p className="panel p-8 text-center text-ink-2">{t("table.empty")}</p>;
  }
  return (
    <div
      className="panel overflow-x-auto"
      tabIndex={0}
      role="region"
      aria-label={t(showCommission ? "nav.clientBookings" : "nav.reservations")}
    >
      <table className="w-full min-w-[760px] text-left text-[0.88rem]">
        <thead className="border-b border-rule text-[0.72rem] uppercase tracking-[0.08em] text-ink-3">
          <tr>
            <th className="px-4 py-3 font-semibold">{t("table.reference")}</th>
            <th className="px-4 py-3 font-semibold">{t("table.guest")}</th>
            <th className="px-4 py-3 font-semibold">{t("table.what")}</th>
            <th className="px-4 py-3 font-semibold">{t("table.dates")}</th>
            <th className="px-4 py-3 font-semibold">{t("table.status")}</th>
            <th className="px-4 py-3 text-right font-semibold">{t("table.total")}</th>
            {showCommission && (
              <th className="px-4 py-3 text-right font-semibold">{t("table.commission")}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((b) => (
            <tr key={b.id} className="border-b border-rule last:border-0">
              <td className="tabular px-4 py-3">
                {linkTo ? (
                  <Link href={linkTo(b.id)} className="font-semibold text-primary-ink">
                    {b.reference}
                  </Link>
                ) : (
                  b.reference
                )}
              </td>
              <td className="px-4 py-3">
                {b.contactName}
                <span className="block text-[0.76rem] text-ink-3">
                  {t("table.guests", { count: b.guests })}
                </span>
              </td>
              <td className="px-4 py-3">{b.productName}</td>
              <td className="tabular px-4 py-3">
                {calendarDate(b.startDate, locale)}
                {b.endDate ? ` – ${calendarDate(b.endDate, locale)}` : ""}
              </td>
              <td className="px-4 py-3">
                <BookingStatusBadge status={b.status} />
              </td>
              <td className="tabular px-4 py-3 text-right">{money(b.total)}</td>
              {showCommission && (
                <td className="tabular px-4 py-3 text-right">{money(b.commission)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
