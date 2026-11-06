import { getTranslations } from "next-intl/server";
import { Icon } from "@pegah/ui";
import { getCustomer, serverApi } from "@/lib/api-server";
import { ResendVerification } from "./resend-verification";

/** Reminds signed-in customers to confirm their email (ADR-0035). Renders nothing once verified. */
export async function VerifyEmailBanner() {
  const session = await getCustomer();
  if (!session) return null;
  const api = await serverApi();
  const profile = (await api.GET("/api/v1/me/profile")).data;
  if (!profile || profile.emailVerified) return null;
  const t = await getTranslations("verifyEmail");
  return (
    <section
      aria-label={t("bannerLabel")}
      className="flex flex-wrap items-center gap-3 rounded-[14px] border border-rule bg-primary-soft px-4 py-3"
    >
      <Icon name="bell" className="size-5 shrink-0 text-primary-ink" />
      <p className="min-w-[220px] flex-1 text-[0.9rem]">
        {t.rich("banner", { email: profile.email, b: (c) => <b>{c}</b> })}
      </p>
      <ResendVerification csrfToken={session.csrfToken} />
    </section>
  );
}
