import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Icon } from "@pegah/ui";
import { PageShell, PaymentNotice } from "@/components/shop/page-shell";
import { requireCustomer, requirePartner, serverApi } from "@/lib/api-server";
import type { Locale } from "@/i18n/locales";
import { calendarDate, money } from "@/lib/format";
import { parseStayParams } from "@/lib/trip";
import { CheckoutForm } from "./checkout-form";
import { PromoField } from "./promo-field";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("checkout"))("title"), robots: { index: false } };
}
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
  const t = await getTranslations("checkout");
  const tp = await getTranslations("price");
  const locale = (await getLocale()) as Locale;
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
            {agentMode ? t("forClient", { partner: session.user.partner?.name ?? "" }) : t("title")}
          </p>
          <h1 className="mt-1.5 font-display text-[clamp(2rem,3.6vw,3rem)] font-medium leading-tight">
            {t("heading")}
          </h1>
        </div>

        {!request || !q ? (
          <section className="panel px-6 py-14 text-center">
            <h2 className="font-display text-[1.6rem] font-medium">{t("invalidSelection")}</h2>
            <p className="mt-1 text-ink-2">{problem?.detail ?? t("pickAgain")}</p>
            <Link href="/stays" className="mt-4 inline-block font-semibold text-primary-ink">
              {t("backToStays")}
            </Link>
          </section>
        ) : !q.available || !q.price ? (
          <section className="panel px-6 py-14 text-center">
            <Icon name="alert" className="mx-auto size-8 text-warn" />
            <h2 className="mt-3 font-display text-[1.6rem] font-medium">{t("unavailable")}</h2>
            <p className="mt-1 text-ink-2">
              {q.unavailableReason === "sold-out" ? t("soldOut") : t("cannotBook")}
            </p>
            <Link
              href={q.product === "HOTEL" ? `/stays/${q.productSlug}` : `/tours/${q.productSlug}`}
              className="mt-4 inline-block font-semibold text-primary-ink"
            >
              {t("chooseAnother")}
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
                  {t("yourSelection")}
                </h2>
                <p className="mt-3 font-display text-[1.4rem] font-medium leading-tight">
                  {q.productName}
                </p>
                <p className="text-[0.9rem] text-ink-2">{q.optionName}</p>
                <dl className="mt-4 grid gap-2 text-[0.9rem]">
                  <div className="flex justify-between">
                    <dt className="text-ink-2">
                      {q.product === "HOTEL" ? t("checkIn") : t("departs")}
                    </dt>
                    <dd className="tabular">{calendarDate(q.startDate, locale)}</dd>
                  </div>
                  {q.endDate && (
                    <div className="flex justify-between">
                      <dt className="text-ink-2">
                        {q.product === "HOTEL" ? t("checkOut") : t("returns")}
                      </dt>
                      <dd className="tabular">{calendarDate(q.endDate, locale)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-ink-2">{t("guests")}</dt>
                    <dd>
                      {t("party", { adults: q.adults, children: q.children, rooms: q.rooms ?? 0 })}
                    </dd>
                  </div>
                </dl>
                <dl className="tabular mt-4 grid gap-2 border-t border-rule pt-4 text-[0.9rem]">
                  <div className="flex justify-between">
                    <dt className="text-ink-2">{tp("base", { nights: q.nights ?? 0 })}</dt>
                    <dd>{money(q.price.base)}</dd>
                  </div>
                  {q.price.discount.amountMinor > 0 && (
                    <div className="flex justify-between text-good">
                      <dt>
                        {q.promotion
                          ? tp("discountCode", { code: q.promotion.code })
                          : tp("discount")}
                      </dt>
                      <dd>− {money(q.price.discount)}</dd>
                    </div>
                  )}
                  {q.price.serviceCharge.amountMinor > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-ink-2">{tp("serviceCharge")}</dt>
                      <dd>{money(q.price.serviceCharge)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-ink-2">{tp("vat")}</dt>
                    <dd>{money(q.price.vat)}</dd>
                  </div>
                  <div className="mt-1 flex justify-between border-t border-rule pt-3 text-[1.15rem] font-bold">
                    <dt>{tp("total")}</dt>
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
