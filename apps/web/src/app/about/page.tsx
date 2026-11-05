import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Icon, buttonClass, type IconName } from "@pegah/ui";
import coxs from "@/assets/images/coxs-bazar-sunset.jpg";
import sajek from "@/assets/images/sajek-sunrise.jpg";
import srimangal from "@/assets/images/srimangal-tea.jpg";
import tanguar from "@/assets/images/tanguar-houseboat.jpg";
import saintMartin from "@/assets/images/saint-martin-boats.jpg";
import { SectionHead } from "@/components/section-head";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { serverApi } from "@/lib/api-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return { title: t("title"), description: t("heroIntro") };
}

const gutter = "px-[max(16px,env(safe-area-inset-left,0px))]";

const SERVICES: {
  key: "corporate" | "family" | "honeymoon" | "giftcards";
  photo: StaticImageData;
}[] = [
  { key: "corporate", photo: srimangal },
  { key: "family", photo: tanguar },
  { key: "honeymoon", photo: coxs },
  { key: "giftcards", photo: saintMartin },
];

const VALUES: { key: "honest" | "sincere" | "affordable" | "everyone"; icon: IconName }[] = [
  { key: "honest", icon: "taka" },
  { key: "sincere", icon: "heart" },
  { key: "affordable", icon: "wallet" },
  { key: "everyone", icon: "tag" },
];

const TIMELINE = ["y2022", "firsts", "today"] as const;

/** Pegah's story, services and values, with contact details from Settings. */
export default async function AboutPage() {
  const t = await getTranslations("about");
  const em = (chunks: React.ReactNode) => <em>{chunks}</em>;
  const api = await serverApi();
  const contact = (await api.GET("/api/v1/site")).data?.general;

  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative isolate min-h-[560px] overflow-hidden bg-night text-white md:min-h-[640px]">
          <Image
            src={sajek}
            alt=""
            fill
            priority
            placeholder="blur"
            sizes="100vw"
            className="-z-10 object-cover"
          />
          <div className="scrim-hero absolute inset-0 -z-10" />
          <div
            className={`${gutter} mx-auto flex min-h-[560px] max-w-[1280px] flex-col justify-end pb-16 pt-32 md:min-h-[640px]`}
          >
            <p className="inline-flex self-start rounded-full bg-night/70 px-3 py-1 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary backdrop-blur-sm">
              {t("eyebrow")}
            </p>
            <h1 className="mt-3 max-w-[16ch] font-display text-[clamp(2.6rem,6vw,5rem)] font-medium leading-[1] [&_em]:text-primary">
              {t.rich("heroTitle", { em })}
            </h1>
            <p className="mt-5 max-w-[56ch] text-[1.08rem] text-white/90">{t("heroIntro")}</p>
          </div>
        </section>

        <section className={`${gutter} pt-24`} aria-labelledby="story-h">
          <div className="mx-auto grid max-w-[1280px] gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-start">
            <div>
              <SectionHead
                id="story-h"
                eyebrow={t("storyEyebrow")}
                title={t.rich("storyTitle", { em })}
              />
              <p className="max-w-[60ch] text-[1.02rem] leading-relaxed text-ink-2">
                {t("storyBody")}
              </p>
            </div>
            <ol className="relative grid gap-6 border-l-2 border-dashed border-primary/60 pl-8">
              {TIMELINE.map((k) => (
                <li key={k} className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[41px] top-1 grid size-5 place-items-center rounded-full bg-primary ring-4 ring-paper"
                  />
                  <p className="font-display text-[1.6rem] font-medium leading-none text-primary-ink">
                    {t(`timelineLabels.${k}`)}
                  </p>
                  <p className="mt-2 text-ink-2">{t(`timeline.${k}`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={`${gutter} pt-24`} aria-labelledby="services-h">
          <div className="mx-auto max-w-[1280px]">
            <SectionHead
              id="services-h"
              eyebrow={t("servicesEyebrow")}
              title={t.rich("servicesTitle", { em })}
            />
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {SERVICES.map((s) => (
                <li key={s.key} className="group grid content-start gap-3">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-card">
                    <Image
                      src={s.photo}
                      alt=""
                      fill
                      placeholder="blur"
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-700 ease-pegah group-hover:scale-105"
                    />
                    <span className="scrim-bottom absolute inset-0" />
                    <h3 className="absolute inset-x-5 bottom-5 font-display text-[1.6rem] font-medium leading-tight text-white">
                      {t(`services.${s.key}.title`)}
                    </h3>
                  </div>
                  <p className="text-[0.92rem] text-ink-2">{t(`services.${s.key}.body`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={`${gutter} pt-24`} aria-labelledby="values-h">
          <div className="mx-auto max-w-[1280px]">
            <SectionHead
              id="values-h"
              eyebrow={t("valuesEyebrow")}
              title={t.rich("valuesTitle", { em })}
            />
            <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {VALUES.map((v) => (
                <li
                  key={v.key}
                  className="grid content-start gap-3 rounded-card border border-rule bg-card p-7"
                >
                  <Icon name={v.icon} className="size-[30px] text-primary-ink" />
                  <h3 className="font-display text-[1.4rem] font-medium leading-tight">
                    {t(`values.${v.key}.title`)}
                  </h3>
                  <p className="text-ink-2">{t(`values.${v.key}.body`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={`${gutter} py-24`}>
          <div className="mx-auto grid max-w-[1280px] gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="relative overflow-hidden rounded-card bg-night p-8 text-white md:p-12">
              <div
                aria-hidden="true"
                className="absolute -right-24 -top-24 size-[320px] rounded-full bg-[radial-gradient(circle,rgb(255_133_47/0.35),transparent_65%)]"
              />
              <h2 className="relative max-w-[18ch] font-display text-[clamp(1.9rem,3.4vw,2.8rem)] font-medium leading-tight">
                {t("ctaTitle")}
              </h2>
              <p className="relative mt-3 max-w-[46ch] text-white/85">{t("ctaBody")}</p>
              <div className="relative mt-6 flex flex-wrap gap-3">
                <Link href="/stays" className={buttonClass("primary", "md", "no-underline")}>
                  {t("ctaStays")}
                </Link>
                <Link
                  href="/tours"
                  className="inline-flex h-11 items-center rounded-control border-[1.5px] border-white/70 px-5 font-semibold text-white no-underline hover:bg-white hover:text-night"
                >
                  {t("ctaTours")}
                </Link>
              </div>
            </div>
            {contact && (
              <address className="panel grid content-start gap-4 p-7 not-italic">
                <h2 className="font-display text-[1.6rem] font-medium">{t("contactTitle")}</h2>
                {contact.officeAddress && (
                  <p className="flex gap-3">
                    <Icon name="pin" className="mt-0.5 size-5 shrink-0 text-primary-ink" />
                    <span>
                      <span className="block text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-ink-3">
                        {t("address")}
                      </span>
                      {contact.officeAddress}
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.officeAddress)}`}
                        className="mt-1 block text-[0.88rem] font-semibold text-primary-ink"
                      >
                        {t("directions")} →
                      </a>
                    </span>
                  </p>
                )}
                {contact.supportPhone && (
                  <p className="flex gap-3">
                    <Icon name="chat" className="mt-0.5 size-5 shrink-0 text-primary-ink" />
                    <span>
                      <span className="block text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-ink-3">
                        {t("phone")}
                      </span>
                      <a href={`tel:${contact.supportPhone}`} className="tabular font-semibold">
                        {contact.supportPhone}
                      </a>
                    </span>
                  </p>
                )}
                {contact.supportEmail && (
                  <p className="flex gap-3">
                    <Icon name="doc" className="mt-0.5 size-5 shrink-0 text-primary-ink" />
                    <span>
                      <span className="block text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-ink-3">
                        {t("email")}
                      </span>
                      <a href={`mailto:${contact.supportEmail}`} className="font-semibold">
                        {contact.supportEmail}
                      </a>
                    </span>
                  </p>
                )}
                <p className="text-[0.76rem] text-ink-3">{t("photoNote")}</p>
              </address>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
