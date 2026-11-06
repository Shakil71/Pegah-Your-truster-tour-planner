import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Icon, buttonClass } from "@pegah/ui";
import sajek from "@/assets/images/sajek-sunrise.jpg";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCustomer, serverApi } from "@/lib/api-server";
import { GiftCardForm } from "./gift-card-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("giftCards");
  return { title: t("title"), description: t("intro") };
}
export const dynamic = "force-dynamic";

const gutter = "px-[max(16px,env(safe-area-inset-left,0px))]";

export default async function GiftCardsPage() {
  const t = await getTranslations("giftCards");
  const session = await getCustomer();
  const api = await serverApi();
  const availability = (await api.GET("/api/v1/gift-cards/availability")).data;

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
            {/* A card-like preview of what the recipient gets. */}
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
          </div>
        </section>

        <section className={`${gutter} py-16`}>
          <div className="mx-auto max-w-[760px]">
            {!availability?.available ? (
              <p className="panel px-6 py-10 text-center text-ink-2">{t("unavailable")}</p>
            ) : session ? (
              <GiftCardForm
                csrfToken={session.csrfToken}
                minTaka={availability.minTaka}
                maxTaka={availability.maxTaka}
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
                  href="/login?next=%2Fgift-cards"
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
