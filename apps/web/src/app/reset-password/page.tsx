import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PageShell } from "@/components/shop/page-shell";
import { ResetForm } from "./reset-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("resetTitle"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const t = await getTranslations("auth");
  const valid = typeof token === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(token);
  return (
    <PageShell>
      <div className="panel mx-auto grid max-w-[520px] gap-2 p-6 md:p-10">
        <h1 className="font-display text-[2rem] font-medium">{t("resetTitle")}</h1>
        {valid ? (
          <ResetForm token={token} />
        ) : (
          <p className="text-ink-2">
            {t.rich("linkIncomplete", {
              link: (chunks) => (
                <Link href="/forgot-password" className="font-semibold text-primary-ink">
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
