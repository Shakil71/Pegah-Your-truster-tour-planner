import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Icon, cx } from "@pegah/ui";
import { PageShell } from "@/components/shop/page-shell";
import type { Locale } from "@/i18n/locales";
import { requireCustomer, serverApi } from "@/lib/api-server";
import { dhakaDateTime, money } from "@/lib/format";
import { ORDER_STATUS_TONE as STATUS_TONE } from "@/lib/order-status";
import { PayOrderButton } from "./pay-order-button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("orders"))("title"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string; payment?: string }>;
}) {
  const { id } = await params;
  const session = await requireCustomer(`/account/orders/${id}`);
  const t = await getTranslations("orders");
  const locale = (await getLocale()) as Locale;
  const api = await serverApi();
  const { data: o, response } = await api.GET("/api/v1/me/orders/{id}", {
    params: { path: { id } },
  });
  if (response.status === 404 || !o) notFound();
  const sp = await searchParams;
  const note =
    sp.payment === undefined
      ? null
      : o.status === "PAID"
        ? { tone: "bg-good-soft text-good", text: t("paymentReceived") }
        : sp.payment === "failed" || sp.payment === "cancelled"
          ? { tone: "bg-warn-soft text-warn", text: t("paymentFailed") }
          : { tone: "bg-warn-soft text-warn", text: t("paymentWaiting") };

  return (
    <PageShell>
      <div className="mx-auto grid max-w-[860px] gap-6">
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-1 text-[0.86rem] font-semibold text-ink-2 no-underline hover:text-ink"
        >
          <Icon name="arrowLeft" className="size-4" /> {t("back")}
        </Link>
        {sp.new === "1" && (
          <p role="status" className="rounded-[14px] bg-good-soft px-4 py-3 text-good">
            {t.rich("justPlaced", { b: (c) => <b>{c}</b> })}
          </p>
        )}
        {note && (
          <p role="status" className={`rounded-[14px] px-4 py-3 ${note.tone}`}>
            {note.text}
          </p>
        )}
        <div>
          <p className="tabular text-[0.84rem] text-ink-3">
            {t("reference", { ref: o.reference })}
          </p>
          <h1 className="mt-1 font-display text-[clamp(1.9rem,3.4vw,2.6rem)] font-medium leading-tight">
            {locale === "bn" ? o.titleBn : o.title}
          </h1>
          <span
            className={cx(
              "mt-3 inline-block rounded-full px-3 py-1 text-[0.82rem] font-semibold",
              STATUS_TONE[o.status],
            )}
          >
            {t(`status.${o.status}`)}
          </span>
        </div>

        {o.status === "PENDING_PAYMENT" && (
          <section className="relative overflow-hidden rounded-card bg-night p-6 text-white md:p-8">
            <p className="max-w-[56ch] text-white/85">
              {o.canPay
                ? t("onlineNote")
                : t("offlineNote", { date: dhakaDateTime(o.expiresAt, locale) })}
            </p>
            {o.canPay && <PayOrderButton orderId={o.id} csrfToken={session.csrfToken} />}
          </section>
        )}
        {o.status === "PAID" && (
          <section className="panel p-5 md:p-6">
            <p className="font-semibold text-good">
              {t("paidNote", { date: o.paidAt ? dhakaDateTime(o.paidAt, locale) : "" })}
            </p>
            {o.paidOffline && <p className="text-[0.86rem] text-ink-2">{t("paidOffline")}</p>}
            {o.giftCard && o.recipient && (
              <>
                <p className="mt-2 text-ink-2">{t("giftSent", { email: o.recipient.email })}</p>
                <p className="tabular mt-1 text-[0.9rem]">
                  {t("giftCard", { last4: o.giftCard.last4, balance: money(o.giftCard.balance) })}
                </p>
              </>
            )}
          </section>
        )}

        <section className="panel p-5 md:p-6">
          <dl className="grid gap-3 text-[0.92rem] sm:grid-cols-2">
            <div>
              <dt className="text-[0.76rem] uppercase tracking-[0.08em] text-ink-3">
                {t("total")}
              </dt>
              <dd className="tabular mt-1 text-[1.2rem] font-bold">{money(o.total)}</dd>
            </div>
            {o.kind === "OFFER" && (
              <div>
                <dt className="text-[0.76rem] uppercase tracking-[0.08em] text-ink-3">
                  {t("quantity")}
                </dt>
                <dd className="mt-1 font-semibold">{o.quantity}</dd>
              </div>
            )}
            <div>
              <dt className="text-[0.76rem] uppercase tracking-[0.08em] text-ink-3">
                {t("buyer")}
              </dt>
              <dd className="mt-1">
                {o.buyer.name}
                <span className="block text-ink-2">
                  {o.buyer.email} · {o.buyer.phone}
                </span>
              </dd>
            </div>
            {o.recipient && (
              <div>
                <dt className="text-[0.76rem] uppercase tracking-[0.08em] text-ink-3">
                  {t("recipient")}
                </dt>
                <dd className="mt-1">
                  {o.recipient.name}
                  <span className="block text-ink-2">{o.recipient.email}</span>
                </dd>
              </div>
            )}
            {o.giftMessage && (
              <div className="sm:col-span-2">
                <dt className="text-[0.76rem] uppercase tracking-[0.08em] text-ink-3">
                  {t("message")}
                </dt>
                <dd className="mt-1 italic">“{o.giftMessage}”</dd>
              </div>
            )}
          </dl>
        </section>
      </div>
    </PageShell>
  );
}
