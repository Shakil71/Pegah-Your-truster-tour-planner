import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Icon, buttonClass } from "@pegah/ui";
import { PageShell } from "@/components/shop/page-shell";
import { TextBlocks } from "@/components/shop/text-blocks";
import type { Locale } from "@/i18n/locales";
import { ensure, getCustomer, serverApi } from "@/lib/api-server";
import { localName, money } from "@/lib/format";
import { photoFor } from "@/lib/trip";
import { VisaApplyForm } from "./visa-apply-form";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const api = await serverApi();
  const { data } = await api.GET("/api/v1/visas/{slug}", { params: { path: { slug } } });
  return {
    title: data
      ? `${data.country} · ${data.visaType}`
      : (await getTranslations("services"))("visaTitle"),
  };
}
export const dynamic = "force-dynamic";

export default async function VisaDetailPage({ params }: Props) {
  const { slug } = await params;
  const t = await getTranslations("services");
  const locale = (await getLocale()) as Locale;
  const api = await serverApi();
  const v = ensure(await api.GET("/api/v1/visas/{slug}", { params: { path: { slug } } }));
  const session = await getCustomer();

  return (
    <PageShell>
      <div className="grid gap-8">
        <Link
          href="/visa"
          className="inline-flex items-center gap-1 text-[0.86rem] font-semibold text-ink-2 no-underline hover:text-ink"
        >
          <Icon name="arrowLeft" className="size-4" /> {t("visaTitle")}
        </Link>
        <section className="relative overflow-hidden rounded-card bg-night text-white">
          <Image
            src={v.hero?.url ?? photoFor(v.slug)}
            alt={v.hero?.alt ?? ""}
            fill
            priority
            sizes="(min-width: 1280px) 1280px, 100vw"
            className="object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_25%,rgb(10_12_28/0.85))]" />
          <div className="relative flex min-h-[300px] flex-col justify-end p-6 md:min-h-[360px] md:p-10">
            <p className="text-[0.86rem] text-white/80">{v.visaType}</p>
            <h1 className="mt-1 font-display text-[clamp(2.2rem,4.4vw,3.4rem)] font-medium leading-[1.02]">
              {localName(locale, v.country, v.countryBn)}
            </h1>
            <p className="mt-2 max-w-[60ch] text-white/85">{v.summary}</p>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-5">
            <section className="panel grid gap-4 p-5 sm:grid-cols-3 md:p-6">
              <div>
                <p className="text-[0.78rem] text-ink-3">{t("processing")}</p>
                <p className="font-semibold">{v.processingTime}</p>
              </div>
              {v.validity && (
                <div>
                  <p className="text-[0.78rem] text-ink-3">{t("validity")}</p>
                  <p className="font-semibold">{v.validity}</p>
                </div>
              )}
              <div>
                <p className="text-[0.78rem] text-ink-3">{t("price")}</p>
                <p className="tabular font-semibold">{t("feeFrom", { amount: money(v.fee) })}</p>
              </div>
            </section>
            <section className="panel p-5 md:p-6" aria-labelledby="req-h">
              <h2 id="req-h" className="text-[1rem] font-semibold">
                {t("documentsNeeded")}
              </h2>
              <ul className="mt-3 grid gap-2 text-[0.92rem]">
                {v.requirements.map((r) => (
                  <li key={r} className="flex items-start gap-2">
                    <Icon name="doc" className="mt-0.5 size-4 shrink-0 text-primary-ink" /> {r}
                  </li>
                ))}
              </ul>
              {v.notes && (
                <TextBlocks text={v.notes} className="mt-4 grid gap-3 text-[0.9rem] text-ink-2" />
              )}
            </section>
            <p className="flex items-start gap-1.5 text-[0.82rem] text-ink-3">
              <Icon name="shield" className="mt-0.5 size-4 shrink-0" /> {t("secureNote")}
            </p>
          </div>
          <aside className="grid content-start gap-4 lg:sticky lg:top-[96px]">
            <section className="panel p-5 md:p-6" aria-labelledby="apply-h">
              <h2 id="apply-h" className="text-[1.1rem] font-semibold">
                {t("applyHeading")}
              </h2>
              {session ? (
                <VisaApplyForm
                  slug={v.slug}
                  csrfToken={session.csrfToken}
                  contact={{
                    name: session.user.fullName,
                    email: session.user.email,
                    phone: session.user.phone ?? "",
                  }}
                />
              ) : (
                <Link
                  href={`/login?next=${encodeURIComponent(`/visa/${v.slug}`)}`}
                  className={buttonClass("primary", "md", "mt-4 w-full no-underline")}
                >
                  {t("signInToApply")}
                </Link>
              )}
              <p className="mt-3 text-[0.8rem] text-ink-3">{t("afterSubmit")}</p>
            </section>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
