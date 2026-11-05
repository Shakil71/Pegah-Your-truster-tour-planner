import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@pegah/ui";
import { photoCredits } from "@/data/home";
import { serverApi } from "@/lib/api-server";
import { buildInfo } from "@/lib/build-info";

const columns: { title: string; links: { key: string; href: string | null }[] }[] = [
  {
    title: "travel",
    links: [
      { key: "stays", href: "/stays" },
      { key: "tours", href: "/tours" },
      { key: "destinations", href: "/#explore" },
      { key: "flightsSoon", href: null },
      { key: "visaSoon", href: null },
    ],
  },
  {
    title: "help",
    links: [
      { key: "manageBooking", href: "/account/bookings" },
      { key: "cancellations", href: "/pages/cancellations" },
      { key: "paymentMethods", href: "/pages/payments" },
      { key: "contact", href: "/pages/contact" },
    ],
  },
  {
    title: "pegah",
    links: [
      { key: "about", href: "/about" },
      { key: "forPartners", href: "/pages/partners" },
      { key: "partnerSignIn", href: "/partner/login" },
      { key: "terms", href: "/pages/terms" },
      { key: "privacy", href: "/pages/privacy" },
    ],
  },
];

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const api = await serverApi();
  const contact = (await api.GET("/api/v1/site")).data?.general;
  return (
    <footer className="bg-night px-[max(16px,env(safe-area-inset-left,0px))] pb-8 pt-[72px] text-on-night">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))]">
          <div className="col-span-2 md:col-span-1">
            <Logo tone="light" className="h-16" />
            <p className="mt-3.5 max-w-[34ch] opacity-80">{t("tagline")}</p>
            {contact && (contact.supportPhone || contact.supportEmail) && (
              <address className="mt-4 grid gap-1 text-[0.92rem] not-italic opacity-90">
                {contact.supportPhone && (
                  <a href={`tel:${contact.supportPhone}`} className="tabular hover:underline">
                    {contact.supportPhone}
                  </a>
                )}
                {contact.supportEmail && (
                  <a href={`mailto:${contact.supportEmail}`} className="hover:underline">
                    {contact.supportEmail}
                  </a>
                )}
                {contact.officeAddress && <span>{contact.officeAddress}</span>}
              </address>
            )}
            <ul className="mt-4 flex flex-wrap gap-2" aria-label={t("paymentMethodsLabel")}>
              {["Visa", "Mastercard", "bKash", "Nagad"].map((p) => (
                <li
                  key={p}
                  className="rounded-md border border-white/25 px-2.5 py-1 text-[0.76rem] font-semibold"
                >
                  {p}
                </li>
              ))}
            </ul>
          </div>
          {columns.map((c) => (
            <div key={c.title}>
              <h2 className="mb-3.5 text-[0.7rem] font-bold uppercase tracking-[0.16em] opacity-65">
                {t(`columns.${c.title}`)}
              </h2>
              <ul className="grid gap-2 text-[0.92rem]">
                {c.links.map((l) => (
                  <li key={l.key}>
                    {l.href ? (
                      <Link href={l.href} className="hover:underline">
                        {t(`links.${l.key}`)}
                      </Link>
                    ) : (
                      <span className="opacity-60">{t(`links.${l.key}`)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <hr aria-hidden="true" className="stitch my-12 border-0" />
        <div className="flex flex-wrap justify-between gap-x-6 gap-y-2 text-[0.8rem] opacity-70">
          <span>{t("copyright")}</span>
          <span>{t("prelaunch")}</span>
          {buildInfo.commitUrl ? (
            <a
              href={buildInfo.commitUrl}
              className="tabular underline-offset-2 hover:underline"
              title={t("deployedCommit")}
            >
              {t("build")} {buildInfo.sha} · {buildInfo.builtAtLabel}
            </a>
          ) : (
            <span className="tabular">
              {t("build")} {buildInfo.sha}
            </span>
          )}
        </div>
        <details className="mt-[18px] text-[0.78rem] opacity-75">
          <summary className="cursor-pointer">{t("photoCredits")}</summary>
          <ul className="mt-2.5 grid gap-1 text-[0.76rem]">
            {photoCredits.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </details>
      </div>
    </footer>
  );
}
