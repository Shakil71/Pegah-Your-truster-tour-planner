import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Icon, buttonClass, cx } from "@pegah/ui";
import type { Locale } from "@/i18n/locales";
import { ensure, requirePartner, serverApi } from "@/lib/api-server";
import { money } from "@/lib/format";
import { dhakaTodayIso } from "@/lib/trip";
import { CalendarEditor } from "./calendar-editor";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partner"))("room.metaTitle") };
}

const DAYS = 35;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const shift = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** Short weekday names, Sunday first, in the page language. */
const weekdayNames = (locale: Locale) =>
  Array.from({ length: 7 }, (_, i) =>
    // 2026-11-01 is a Sunday.
    new Date(Date.UTC(2026, 10, 1 + i)).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", {
      timeZone: "UTC",
      weekday: "short",
    }),
  );

/** Supplier view of one room type: rooms on sale and nightly rates. The API checks ownership. */
export default async function PartnerRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const session = await requirePartner("SUPPLIER");
  const t = await getTranslations("partner");
  const locale = (await getLocale()) as Locale;
  const today = dhakaTodayIso();
  const sp = await searchParams;
  const from = sp.from && ISO.test(sp.from) ? sp.from : today;
  const api = await serverApi();
  const cal = ensure(
    await api.GET("/api/v1/partner/rooms/{id}/calendar", {
      params: { path: { id }, query: { from, days: DAYS } },
    }),
  );
  const committed = cal.days.reduce((a, d) => a + d.held + d.sold, 0);
  const capacity = cal.days.reduce((a, d) => a + (d.total ?? 0), 0);

  return (
    <div className="grid gap-6">
      <Link
        href="/partner"
        className="inline-flex items-center gap-1 text-[0.86rem] font-semibold text-ink-2 no-underline hover:text-ink"
      >
        <Icon name="arrowLeft" className="size-4" /> {t("nav.overview")}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
            {cal.hotel.name}
          </p>
          <h1 className="mt-1 font-display text-[clamp(1.9rem,3vw,2.5rem)] font-medium leading-tight">
            {cal.room.name}
          </h1>
          <p className="mt-1 max-w-[70ch] text-[0.9rem] text-ink-2">{t("room.intro")}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/partner/rooms/${id}?from=${shift(from, -DAYS)}`}
            className={buttonClass("outline", "sm", "no-underline")}
          >
            <Icon name="arrowLeft" className="size-4" /> {t("room.earlier")}
          </Link>
          <Link
            href={`/partner/rooms/${id}`}
            className={buttonClass("ghost", "sm", "no-underline")}
          >
            {t("room.today")}
          </Link>
          <Link
            href={`/partner/rooms/${id}?from=${shift(from, DAYS)}`}
            className={buttonClass("outline", "sm", "no-underline")}
          >
            {t("room.later")} <Icon name="arrowRight" className="size-4" />
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="panel p-4">
          <p className="text-[0.78rem] font-semibold text-ink-2">{t("room.committed")}</p>
          <p className="tabular mt-1 font-display text-[1.7rem] font-medium">{committed}</p>
        </div>
        <div className="panel p-4">
          <p className="text-[0.78rem] font-semibold text-ink-2">{t("room.occupancy")}</p>
          <p className="tabular mt-1 font-display text-[1.7rem] font-medium">
            {capacity ? `${Math.round((committed / capacity) * 100)}%` : "—"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section className="panel p-3 md:p-5" aria-label={t("room.calendar")}>
          <div className="grid grid-cols-7 gap-1 text-center text-[0.66rem] font-bold uppercase tracking-[0.08em] text-ink-3 md:gap-1.5">
            {weekdayNames(locale).map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <ol className="mt-1.5 grid grid-cols-7 gap-1 md:gap-1.5">
            {Array.from({ length: new Date(`${from}T00:00:00Z`).getUTCDay() }, (_, i) => (
              <li key={`pad-${i}`} aria-hidden="true" />
            ))}
            {cal.days.map((d) => {
              const left = d.total === null ? null : d.total - d.held - d.sold;
              const date = new Date(`${d.date}T00:00:00Z`).toLocaleDateString(
                locale === "bn" ? "bn-BD" : "en-GB",
                { timeZone: "UTC", day: "numeric", month: "short" },
              );
              const state =
                d.total === null
                  ? t("room.dayNotOnSale", { date })
                  : t("room.dayFree", {
                      date,
                      left: left ?? 0,
                      total: d.total,
                      held: d.held,
                      sold: d.sold,
                    });
              return (
                <li
                  key={d.date}
                  className={cx(
                    "min-h-[80px] min-w-0 rounded-[10px] border p-1.5 text-left text-[0.66rem] md:p-2 md:text-[0.74rem]",
                    d.date < today && "opacity-45",
                    d.total === null || !d.rate
                      ? "border-dashed border-rule bg-paper"
                      : left === 0
                        ? "border-ink/30 bg-paper-2"
                        : "border-rule bg-card",
                  )}
                  aria-label={
                    d.rate
                      ? t("room.dayRate", { label: state, rate: money(d.rate) })
                      : t("room.dayNoRate", { label: state })
                  }
                >
                  <p className="font-bold">{date}</p>
                  {d.total === null ? (
                    <p className="mt-1 text-ink-3">{t("room.off")}</p>
                  ) : (
                    <p className="tabular mt-1">
                      <b>{left}</b>
                      <span className="text-ink-3">/{d.total}</span>
                    </p>
                  )}
                  <p
                    className={cx(
                      "tabular mt-1 truncate font-semibold",
                      d.rate ? "text-primary-ink" : "text-critical",
                    )}
                  >
                    {d.rate ? money(d.rate) : t("room.noRate")}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
        <CalendarEditor
          roomId={id}
          from={from < today ? today : from}
          today={today}
          csrfToken={session.csrfToken}
          weekdays={weekdayNames(locale)}
        />
      </div>
    </div>
  );
}
