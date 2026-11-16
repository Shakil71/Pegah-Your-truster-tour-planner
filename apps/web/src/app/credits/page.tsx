import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { photoCredits } from "@/data/home";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("credits");
  return { title: t("title"), description: t("intro") };
}

/**
 * Attribution for licensed destination photos (CC BY / CC BY-SA require it).
 * Linked from the footer; the full record is docs/design/IMAGE_CREDITS.md.
 */
export default async function CreditsPage() {
  const t = await getTranslations("credits");
  return (
    <>
      <SiteHeader />
      <main className="bg-paper px-[max(16px,env(safe-area-inset-left,0px))] pb-20 pt-32">
        <div className="mx-auto max-w-[760px]">
          <h1 className="font-display text-[clamp(2rem,4vw,2.8rem)] font-medium leading-tight">
            {t("title")}
          </h1>
          <p className="mt-3 text-ink-2">{t("intro")}</p>
          <ul className="panel mt-8 grid divide-y divide-rule">
            {photoCredits.map((c) => (
              <li key={c} className="px-5 py-3 text-[0.93rem] text-ink-2">
                {c}
              </li>
            ))}
          </ul>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
