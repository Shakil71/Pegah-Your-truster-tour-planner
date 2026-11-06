import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Icon, buttonClass } from "@pegah/ui";
import { PageShell } from "@/components/shop/page-shell";
import { getCustomer } from "@/lib/api-server";
import { FlightRequestForm } from "./flight-request-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("services");
  return { title: t("flightsTitle"), description: t("flightsIntro") };
}
export const dynamic = "force-dynamic";

export default async function FlightsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; date?: string }>;
}) {
  const t = await getTranslations("services");
  const session = await getCustomer();
  const sp = await searchParams;
  const clean = (s?: string) => (s ?? "").slice(0, 80);

  return (
    <PageShell>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
            {t("flightsEyebrow")}
          </p>
          <h1 className="mt-1.5 font-display text-[clamp(2.2rem,4vw,3.4rem)] font-medium leading-tight">
            {t("flightsHeading")}
          </h1>
          <p className="mt-2 max-w-[52ch] text-ink-2">{t("flightsIntro")}</p>
          <ul className="mt-6 grid gap-3 text-[0.92rem] text-ink-2">
            <li className="flex items-start gap-2">
              <Icon name="plane" className="mt-0.5 size-5 text-primary-ink" /> Biman · US-Bangla ·
              Novoair · Air Astra
            </li>
            <li className="flex items-start gap-2">
              <Icon name="shield" className="mt-0.5 size-5 text-primary-ink" /> {t("afterSubmit")}
            </li>
          </ul>
        </div>
        <section className="panel p-5 md:p-7" aria-label={t("flightsTitle")}>
          {session ? (
            <FlightRequestForm
              csrfToken={session.csrfToken}
              contact={{
                name: session.user.fullName,
                email: session.user.email,
                phone: session.user.phone ?? "",
              }}
              initial={{
                from: clean(sp.from),
                to: clean(sp.to),
                date: /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : "",
              }}
            />
          ) : (
            <div className="grid justify-items-start gap-3">
              <p className="text-ink-2">{t("flightsIntro")}</p>
              <Link
                href="/login?next=%2Fflights"
                className={buttonClass("primary", "md", "no-underline")}
              >
                {t("signInToRequest")}
              </Link>
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
