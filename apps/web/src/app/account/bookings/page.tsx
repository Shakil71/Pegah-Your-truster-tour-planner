import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { Icon, buttonClass } from "@pegah/ui";
import { AccountTabs } from "@/components/shop/account-tabs";
import { VerifyEmailBanner } from "@/components/shop/verify-email-banner";
import { BookingStatusBadge } from "@/components/shop/booking-status";
import { PageShell } from "@/components/shop/page-shell";
import { SignOutButton } from "@/components/shop/sign-out-button";
import { ensure, requireCustomer, serverApi } from "@/lib/api-server";
import type { Locale } from "@/i18n/locales";
import { calendarDate, money } from "@/lib/format";
import { photoFor } from "@/lib/trip";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("account"))("myTrips"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

export default async function MyTripsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const session = await requireCustomer("/account/bookings");
  const t = await getTranslations("account");
  const locale = (await getLocale()) as Locale;
  const { cursor } = await searchParams;
  const api = await serverApi();
  const page = ensure(
    await api.GET("/api/v1/me/bookings", {
      params: { query: { limit: 20, cursor: cursor?.slice(0, 200) || undefined } },
    }),
  );

  return (
    <PageShell>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
              {session.user.email}
            </p>
            <h1 className="mt-1.5 font-display text-[clamp(2rem,3.6vw,3rem)] font-medium leading-tight">
              {t("myTrips")}
            </h1>
          </div>
          <SignOutButton csrfToken={session.csrfToken} />
        </div>
        <AccountTabs active="trips" />
        <VerifyEmailBanner />

        {page.items.length === 0 ? (
          <section className="panel px-6 py-16 text-center">
            <Icon name="ticket" className="mx-auto size-9 text-ink-3" />
            <h2 className="mt-3 font-display text-[1.6rem] font-medium">{t("noTrips")}</h2>
            <p className="mt-1 text-ink-2">{t("noTripsIntro")}</p>
            <div className="mt-5 flex justify-center gap-3">
              <Link href="/stays" className={buttonClass("primary", "md", "no-underline")}>
                {t("browseStays")}
              </Link>
              <Link href="/tours" className={buttonClass("outline", "md", "no-underline")}>
                {t("browseTours")}
              </Link>
            </div>
          </section>
        ) : (
          <ul className="grid gap-4">
            {page.items.map((b) => (
              <li key={b.id}>
                <article className="panel group relative grid overflow-hidden sm:grid-cols-[180px_minmax(0,1fr)_auto]">
                  <div className="relative aspect-[16/9] sm:aspect-auto">
                    <Image
                      src={photoFor(b.productName)}
                      alt=""
                      fill
                      sizes="180px"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-5">
                    <p className="tabular text-[0.78rem] text-ink-3">{b.reference}</p>
                    <h2 className="mt-0.5 text-[1.15rem] font-semibold">
                      <Link
                        href={`/account/bookings/${b.id}`}
                        className="no-underline after:absolute after:inset-0 hover:underline"
                      >
                        {b.productName}
                      </Link>
                    </h2>
                    <p className="mt-1 text-[0.88rem] text-ink-2">
                      {calendarDate(b.startDate, locale)}
                      {b.endDate ? ` – ${calendarDate(b.endDate, locale)}` : ""} ·{" "}
                      {t("guests", { count: b.guests })}
                    </p>
                  </div>
                  <div className="flex flex-col items-start justify-center gap-2 border-t border-rule p-5 sm:items-end sm:border-l sm:border-t-0">
                    <BookingStatusBadge status={b.status} />
                    <p className="tabular font-display text-[1.3rem] font-medium">
                      {money(b.total)}
                    </p>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
        {page.nextCursor && (
          <Link
            href={`/account/bookings?cursor=${encodeURIComponent(page.nextCursor)}`}
            className="justify-self-center font-semibold text-primary-ink"
          >
            {t("olderTrips")} →
          </Link>
        )}
      </div>
    </PageShell>
  );
}
