import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Icon, buttonClass, cx } from "@pegah/ui";
import { AccountTabs } from "@/components/shop/account-tabs";
import { PageShell } from "@/components/shop/page-shell";
import type { Locale } from "@/i18n/locales";
import { ensure, requireCustomer, serverApi } from "@/lib/api-server";
import { dhakaDateTime, money } from "@/lib/format";
import { ORDER_STATUS_TONE as STATUS_TONE } from "@/lib/order-status";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("orders"))("title"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

export default async function MyOrdersPage() {
  await requireCustomer("/account/orders");
  const t = await getTranslations("orders");
  const locale = (await getLocale()) as Locale;
  const api = await serverApi();
  const page = ensure(await api.GET("/api/v1/me/orders"));

  return (
    <PageShell>
      <div className="grid gap-6">
        <h1 className="font-display text-[clamp(2rem,3.6vw,3rem)] font-medium leading-tight">
          {t("heading")}
        </h1>
        <AccountTabs active="orders" />
        {page.items.length === 0 ? (
          <section className="panel px-6 py-14 text-center">
            <Icon name="tag" className="mx-auto size-9 text-ink-3" />
            <p className="mt-2 text-ink-2">{t("none")}</p>
            <div className="mt-5 flex justify-center gap-3">
              <Link href="/offers" className={buttonClass("primary", "md", "no-underline")}>
                {t("browseOffers")}
              </Link>
              <Link href="/gift-cards" className={buttonClass("outline", "md", "no-underline")}>
                {t("buyGiftCard")}
              </Link>
            </div>
          </section>
        ) : (
          <ul className="grid gap-3">
            {page.items.map((o) => (
              <li
                key={o.id}
                className="panel relative flex flex-wrap items-center justify-between gap-4 p-5"
              >
                <div>
                  <p className="tabular text-[0.78rem] text-ink-3">{o.reference}</p>
                  <h2 className="text-[1.1rem] font-semibold">
                    <Link
                      href={`/account/orders/${o.id}`}
                      className="no-underline after:absolute after:inset-0 hover:underline"
                    >
                      {locale === "bn" ? o.titleBn : o.title}
                    </Link>
                  </h2>
                  <p className="text-[0.84rem] text-ink-3">{dhakaDateTime(o.createdAt, locale)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cx(
                      "rounded-full px-3 py-1 text-[0.8rem] font-semibold",
                      STATUS_TONE[o.status],
                    )}
                  >
                    {t(`status.${o.status}`)}
                  </span>
                  <span className="tabular font-display text-[1.3rem] font-medium">
                    {money(o.total)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
