import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PageShell } from "@/components/shop/page-shell";
import { ConfirmEmail } from "./confirm-email";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("verifyEmail"))("title"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * Landing page of the verification link. Nothing happens until the person
 * presses the button, so link scanners in mail systems cannot verify for them.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const t = await getTranslations("verifyEmail");
  const valid = typeof token === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(token);
  return (
    <PageShell>
      <div className="panel mx-auto grid max-w-[520px] gap-3 p-6 md:p-10">
        <h1 className="font-display text-[2rem] font-medium">{t("title")}</h1>
        {valid ? (
          <ConfirmEmail token={token} />
        ) : (
          <p className="text-ink-2">
            {t.rich("incomplete", {
              link: (chunks) => (
                <Link href="/account/profile" className="font-semibold text-primary-ink">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        )}
      </div>
    </PageShell>
  );
}
