import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Icon, buttonClass, cx } from "@pegah/ui";
import { AccountTabs } from "@/components/shop/account-tabs";
import { PageShell } from "@/components/shop/page-shell";
import { VerifyEmailBanner } from "@/components/shop/verify-email-banner";
import type { Locale } from "@/i18n/locales";
import { ensure, requireCustomer, serverApi } from "@/lib/api-server";
import { dhakaDateTime, money } from "@/lib/format";
import { REQUEST_STATUS_TONE } from "@/lib/request-status";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: (await getTranslations("services"))("requestsHeading"),
    robots: { index: false },
  };
}
export const dynamic = "force-dynamic";

export default async function MyRequestsPage() {
  await requireCustomer("/account/requests");
  const t = await getTranslations("services");
  const locale = (await getLocale()) as Locale;
  const api = await serverApi();
  const page = ensure(await api.GET("/api/v1/me/requests"));

  return (
    <PageShell>
      <div className="grid gap-6">
        <h1 className="font-display text-[clamp(2rem,3.6vw,3rem)] font-medium leading-tight">
          {t("requestsHeading")}
        </h1>
        <AccountTabs active="requests" />
        <VerifyEmailBanner />
        {page.items.length === 0 ? (
          <section className="panel px-6 py-14 text-center">
            <Icon name="doc" className="mx-auto size-9 text-ink-3" />
            <p className="mt-2 text-ink-2">{t("noRequests")}</p>
            <div className="mt-5 flex justify-center gap-3">
              <Link href="/visa" className={buttonClass("primary", "md", "no-underline")}>
                {t("browseVisas")}
              </Link>
              <Link href="/flights" className={buttonClass("outline", "md", "no-underline")}>
                {t("requestFlight")}
              </Link>
            </div>
          </section>
        ) : (
          <ul className="grid gap-3">
            {page.items.map((r) => (
              <li
                key={r.id}
                className="panel relative flex flex-wrap items-center justify-between gap-4 p-5"
              >
                <div className="flex items-start gap-3">
                  <Icon
                    name={r.kind === "VISA" ? "doc" : "plane"}
                    className="mt-1 size-5 text-primary-ink"
                  />
                  <div>
                    <p className="tabular text-[0.78rem] text-ink-3">{r.reference}</p>
                    <h2 className="text-[1.05rem] font-semibold">
                      <Link
                        href={`/account/requests/${r.id}`}
                        className="no-underline after:absolute after:inset-0 hover:underline"
                      >
                        {r.title}
                      </Link>
                    </h2>
                    <p className="text-[0.84rem] text-ink-3">
                      {t("people", { count: r.travellers })} · {dhakaDateTime(r.createdAt, locale)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cx(
                      "rounded-full px-3 py-1 text-[0.8rem] font-semibold",
                      REQUEST_STATUS_TONE[r.status],
                    )}
                  >
                    {t(`status_${r.status}`)}
                  </span>
                  {r.quote && (
                    <span className="tabular font-display text-[1.3rem] font-medium">
                      {money(r.quote)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
