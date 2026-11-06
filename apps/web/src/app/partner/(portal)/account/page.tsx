import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PasswordForm } from "@/app/account/profile/profile-forms";
import { requirePartner } from "@/lib/api-server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partner"))("nav.account") };
}

export default async function PartnerAccountPage() {
  const session = await requirePartner();
  const partner = session.user.partner!;
  const t = await getTranslations("partner");
  const pct = (partner.commissionBps / 100).toFixed(partner.commissionBps % 100 ? 2 : 0);
  return (
    <div className="grid max-w-[720px] gap-6">
      <h1 className="font-display text-[clamp(1.9rem,3vw,2.5rem)] font-medium leading-tight">
        {t("nav.account")}
      </h1>
      <section className="panel p-5 md:p-6">
        <dl className="grid gap-3 text-[0.92rem] sm:grid-cols-2">
          <div>
            <dt className="text-[0.76rem] uppercase tracking-[0.08em] text-ink-3">
              {t("account.you")}
            </dt>
            <dd className="mt-1">
              {session.user.fullName}
              <span className="block text-ink-2">{session.user.email}</span>
            </dd>
          </div>
          <div>
            <dt className="text-[0.76rem] uppercase tracking-[0.08em] text-ink-3">
              {t("account.company")}
            </dt>
            <dd className="mt-1">
              {partner.name}
              <span className="block text-ink-2">
                {partner.kind === "SUPPLIER"
                  ? t("kind.SUPPLIER")
                  : t("account.agentCommission", { pct })}
              </span>
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-[0.82rem] text-ink-3">{t("account.contact")}</p>
      </section>
      <PasswordForm csrfToken={session.csrfToken} partner />
    </div>
  );
}
