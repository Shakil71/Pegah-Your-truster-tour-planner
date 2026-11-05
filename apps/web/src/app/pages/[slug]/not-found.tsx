import Link from "next/link";
import { useTranslations } from "next-intl";
import { PageShell } from "@/components/shop/page-shell";

export default function PageNotWritten() {
  const t = useTranslations("pages");
  return (
    <PageShell>
      <div className="mx-auto max-w-[620px] py-10 text-center">
        <h1 className="font-display text-[2rem] font-medium">{t("beingWritten")}</h1>
        <p className="mt-2 text-ink-2">{t("beingWrittenIntro")}</p>
        <div className="mt-6 flex justify-center gap-4 text-[0.95rem] font-semibold">
          <Link href="/account/bookings" className="text-primary-ink">
            {t("myTrips")}
          </Link>
          <Link href="/" className="text-primary-ink">
            {t("home")}
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
