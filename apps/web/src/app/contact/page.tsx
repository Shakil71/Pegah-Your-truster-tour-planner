import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Icon, type IconName } from "@pegah/ui";
import { PageShell } from "@/components/shop/page-shell";
import { getCustomer, serverApi } from "@/lib/api-server";
import { ContactForm } from "./contact-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact");
  return { title: t("title"), description: t("intro") };
}
export const dynamic = "force-dynamic";

const TOPICS = ["BOOKING", "RESERVATION", "PACKAGE", "OTHER"] as const;

/** Contact page (ADR-0041): the form, and every other way to reach the team. */
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; about?: string }>;
}) {
  const t = await getTranslations("contact");
  const session = await getCustomer();
  const api = await serverApi();
  const general = (await api.GET("/api/v1/site")).data?.general;
  const query = await searchParams;
  const asked = query.topic?.toUpperCase();
  // "Request this tour" links here with the tour's name; it only pre-fills the message.
  const about = query.about
    ?.replace(/[\u0000-\u001f<>]/g, "")
    .trim()
    .slice(0, 160);
  const initialTopic = TOPICS.find((k) => k === asked);
  const whatsapp = general?.whatsapp.replace(/[^\d]/g, "");

  const ways: Array<{ icon: IconName; label: string; value: string; href?: string }> = general
    ? [
        ...(general.supportPhone
          ? [
              {
                icon: "chat" as const,
                label: t("call"),
                value: general.supportPhone,
                href: `tel:${general.supportPhone.replace(/[^\d+]/g, "")}`,
              },
            ]
          : []),
        ...(whatsapp
          ? [
              {
                icon: "chat" as const,
                label: "WhatsApp",
                value: general.whatsapp,
                href: `https://wa.me/${whatsapp}`,
              },
            ]
          : []),
        ...(general.supportEmail
          ? [
              {
                icon: "doc" as const,
                label: t("emailUs"),
                value: general.supportEmail,
                href: `mailto:${general.supportEmail}`,
              },
            ]
          : []),
        ...(general.officeAddress
          ? [{ icon: "pin" as const, label: t("office"), value: general.officeAddress }]
          : []),
      ]
    : [];

  return (
    <PageShell>
      <div className="grid gap-8">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
            {t("eyebrow")}
          </p>
          <h1 className="mt-1.5 font-display text-[clamp(2.2rem,4vw,3.4rem)] font-medium leading-tight">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-[62ch] text-ink-2">{t("intro")}</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <ContactForm
            initialTopic={initialTopic}
            initialMessage={about ? t("aboutTrip", { name: about }) : ""}
            initial={{
              name: session?.user.fullName ?? "",
              email: session?.user.email ?? "",
              phone: session?.user.phone ?? "",
            }}
          />

          <aside className="grid content-start gap-4">
            {ways.length > 0 && (
              <section className="panel p-5 md:p-6" aria-labelledby="ways-h">
                <h2 id="ways-h" className="font-semibold">
                  {t("otherWays")}
                </h2>
                <ul className="mt-4 grid gap-3">
                  {ways.map((w) => (
                    <li key={w.label} className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-ink">
                        <Icon name={w.icon} className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[0.74rem] uppercase tracking-[0.08em] text-ink-3">
                          {w.label}
                        </span>
                        {w.href ? (
                          <a
                            href={w.href}
                            className="break-words font-semibold"
                            {...(w.href.startsWith("https://")
                              ? { target: "_blank", rel: "noopener noreferrer" }
                              : {})}
                          >
                            {w.value}
                          </a>
                        ) : (
                          <span className="block font-semibold">{w.value}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="panel p-5 md:p-6">
              <h2 className="font-semibold">{t("whatNext")}</h2>
              <ol className="mt-3 grid gap-2.5 text-[0.88rem] text-ink-2">
                {(["one", "two", "three"] as const).map((k, i) => (
                  <li key={k} className="flex items-start gap-2.5">
                    <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-paper-2 text-[0.76rem] font-bold text-ink">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{t(`steps.${k}`)}</span>
                  </li>
                ))}
              </ol>
            </section>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
