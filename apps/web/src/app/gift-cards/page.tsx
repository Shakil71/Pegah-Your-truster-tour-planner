import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Icon, buttonClass, cx } from "@pegah/ui";
import sajek from "@/assets/images/sajek-sunrise.jpg";
import { GiftCardFace } from "@/components/gift-card-face";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { GIFT_CARD_THEMES } from "@/data/gift-card-themes";
import type { Locale } from "@/i18n/locales";
import { getCustomer, serverApi } from "@/lib/api-server";
import { localName } from "@/lib/format";
import { GiftCardForm } from "./gift-card-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("giftCards");
  return { title: t("title"), description: t("intro") };
}
export const dynamic = "force-dynamic";

const gutter = "px-[max(16px,env(safe-area-inset-left,0px))]";

/** A card shown in the "this season" row: an owner design or a built-in one. */
type CardView = {
  id: string;
  name: string;
  label: string;
  line: string;
  message: string;
  amountTaka: number;
  image: string | StaticImageData;
  alt: string;
  focus: string;
  credit: string | null;
};

export default async function GiftCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ card?: string }>;
}) {
  const t = await getTranslations("giftCards");
  const session = await getCustomer();
  const api = await serverApi();
  const availability = (await api.GET("/api/v1/gift-cards/availability")).data;
  const locale = (await getLocale()) as Locale;
  // Designs made in the console replace the built-in seasonal cards.
  const designs = (await api.GET("/api/v1/gift-cards/designs")).data?.items ?? [];
  const cards: CardView[] =
    designs.length > 0
      ? designs.map((d) => ({
          id: d.id,
          name: localName(locale, d.nameEn, d.nameBn),
          label: localName(locale, d.labelEn, d.labelBn),
          line: localName(locale, d.lineEn, d.lineBn),
          message: localName(locale, d.messageEn, d.messageBn),
          amountTaka: d.amount.amountMinor / 100,
          image: d.image.url,
          alt: d.image.alt,
          focus: "50% 50%",
          credit: null,
        }))
      : GIFT_CARD_THEMES.map((g) => ({
          id: g.id,
          name: t(`themes.${g.id}.name`),
          label: t(`places.${g.place}`),
          line: t(`themes.${g.id}.line`),
          message: t(`themes.${g.id}.message`),
          amountTaka: g.amountTaka,
          image: g.image,
          alt: t(`places.${g.place}`),
          focus: g.focus,
          credit: g.credit,
        }));
  const chosen = (await searchParams).card;
  const theme = chosen ? cards.find((c) => c.id === chosen) : undefined;
  const own = designs.length > 0;
  const chooseHref = (id: string) => {
    const target = `/gift-cards?card=${id}#buy`;
    return session ? target : `/login?next=${encodeURIComponent(target)}`;
  };

  return (
    <>
      <SiteHeader />
      <main className="bg-paper">
        <section className="relative isolate overflow-hidden bg-night text-white">
          <Image
            src={sajek}
            alt=""
            fill
            priority
            placeholder="blur"
            sizes="100vw"
            className="-z-10 object-cover opacity-70"
          />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(9_12_34/0.9),rgb(9_12_34/0.35))]" />
          <div
            className={`${gutter} mx-auto grid max-w-[1280px] gap-10 pb-16 pt-32 lg:grid-cols-[1.1fr_1fr] lg:items-center`}
          >
            <div>
              <p className="inline-flex rounded-full bg-night/70 px-3 py-1 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary">
                {t("eyebrow")}
              </p>
              <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,4.2rem)] font-medium leading-[1.02] [&_em]:text-primary">
                {t.rich("heading", { em: (c) => <em>{c}</em> })}
              </h1>
              <p className="mt-4 max-w-[52ch] text-white/90">{t("intro")}</p>
              <ul className="mt-6 grid gap-2.5 text-[0.95rem]">
                {(["flexible", "valid", "instant"] as const).map((k) => (
                  <li key={k} className="flex items-start gap-2.5">
                    <Icon name="check" className="mt-0.5 size-5 shrink-0 text-primary" />
                    {t(`points.${k}`)}
                  </li>
                ))}
              </ul>
              <Link
                href="/gift-cards/balance"
                className="mt-6 inline-block font-semibold text-primary underline-offset-4 hover:underline"
              >
                {t("checkBalance")} →
              </Link>
            </div>
            {/* What the recipient gets: the chosen design, or the plain brand card. */}
            {theme ? (
              <div aria-hidden="true" className="mx-auto w-full max-w-[440px] rotate-[-4deg]">
                <GiftCardFace
                  image={theme.image}
                  focus={theme.focus}
                  amountTaka={theme.amountTaka}
                  label={theme.label}
                  cardLabel={t("cardLabel")}
                  sizes="440px"
                  priority
                />
              </div>
            ) : (
              <div
                aria-hidden="true"
                className="relative mx-auto aspect-[1.6/1] w-full max-w-[440px] rotate-[-4deg] rounded-[22px] bg-[linear-gradient(135deg,var(--pg-primary),var(--pg-primary-hover))] p-7 text-fixed-ink shadow-lift"
              >
                <span className="block text-[0.72rem] font-bold uppercase tracking-[0.18em] opacity-80">
                  Gift card
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element -- brand wordmark */}
                <img src="/brand/pegah-logo.webp" alt="" className="mt-4 h-14 w-auto" />
                <span className="absolute bottom-6 left-7 font-mono text-[1.05rem] tracking-[0.18em]">
                  XXXX-XXXX-XXXX-XXXX
                </span>
              </div>
            )}
          </div>
        </section>

        {availability?.available && (
          <section className={`${gutter} pt-16`} aria-labelledby="season-h">
            <div className="mx-auto max-w-[1280px]">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
                    {t(own ? "season.ownEyebrow" : "season.eyebrow")}
                  </p>
                  <h2
                    id="season-h"
                    className="mt-1.5 font-display text-[clamp(1.9rem,3.4vw,2.8rem)] font-medium leading-tight"
                  >
                    {t(own ? "season.ownTitle" : "season.title")}
                  </h2>
                  <p className="mt-1 max-w-[62ch] text-ink-2">
                    {t(own ? "season.ownIntro" : "season.intro")}
                  </p>
                </div>
              </div>
              <ul className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map((g) => {
                  const chosen = theme?.id === g.id;
                  return (
                    <li key={g.id}>
                      <article className="group relative flex h-full flex-col">
                        <GiftCardFace
                          image={g.image}
                          alt={g.alt}
                          focus={g.focus}
                          amountTaka={g.amountTaka}
                          label={g.label}
                          cardLabel={t("cardLabel")}
                          sizes="(min-width: 1280px) 300px, (min-width: 640px) 50vw, 100vw"
                          className={cx(
                            "transition duration-500 group-hover:-translate-y-1.5 group-hover:-rotate-2",
                            chosen && "ring-4 ring-primary",
                          )}
                        />
                        <div className="flex flex-1 flex-col px-1 pt-4">
                          <h3 className="font-display text-[1.3rem] font-medium leading-tight">
                            {g.name}
                          </h3>
                          <p className="mt-1 flex-1 text-[0.9rem] text-ink-2">{g.line}</p>
                          <Link
                            href={chooseHref(g.id)}
                            aria-label={`${t("season.choose")}: ${g.name}`}
                            className={buttonClass(
                              chosen ? "primary" : "outline",
                              "md",
                              "mt-4 no-underline after:absolute after:inset-0",
                            )}
                          >
                            {chosen ? t("season.chosen") : t("season.choose")}
                          </Link>
                          {g.credit && (
                            <p className="mt-2.5 text-[0.7rem] text-ink-3">{g.credit}</p>
                          )}
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-5 flex items-start gap-2 text-[0.86rem] text-ink-2">
                <Icon name="check" className="mt-0.5 size-4 shrink-0 text-good" />
                {t(own ? "season.anyTripOwn" : "season.anyTrip")}
              </p>
            </div>
          </section>
        )}

        <section id="buy" className={`${gutter} scroll-mt-24 py-16`}>
          <div className="mx-auto max-w-[760px]">
            {!availability?.available ? (
              <p className="panel px-6 py-10 text-center text-ink-2">{t("unavailable")}</p>
            ) : session ? (
              <GiftCardForm
                key={theme?.id ?? "custom"}
                csrfToken={session.csrfToken}
                minTaka={availability.minTaka}
                maxTaka={availability.maxTaka}
                theme={
                  theme
                    ? { name: theme.name, amountTaka: theme.amountTaka, message: theme.message }
                    : undefined
                }
                buyer={{
                  name: session.user.fullName,
                  email: session.user.email,
                  phone: session.user.phone ?? "",
                }}
              />
            ) : (
              <div className="panel grid justify-items-center gap-3 px-6 py-10 text-center">
                <h2 className="font-display text-[1.6rem] font-medium">{t("formTitle")}</h2>
                <Link
                  href={`/login?next=${encodeURIComponent(theme ? `/gift-cards?card=${theme.id}#buy` : "/gift-cards")}`}
                  className={buttonClass("primary", "md", "no-underline")}
                >
                  {t("signInFirst")}
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
