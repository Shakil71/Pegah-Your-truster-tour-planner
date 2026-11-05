"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cx } from "@pegah/ui";
import { LOCALE_COOKIE, type Locale } from "@/i18n/locales";

/** Switches between English and Bangla. The choice is a cookie; the page re-renders in place. */
export function LanguageSwitch({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("header");
  const router = useRouter();
  const [pending, start] = useTransition();
  const next: Locale = locale === "bn" ? "en" : "bn";

  function choose() {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={choose}
      disabled={pending}
      lang={next}
      title={t("switchLanguage")}
      className={cx(
        "font-semibold underline-offset-4 hover:underline disabled:opacity-60",
        className,
      )}
    >
      {next === "bn" ? "বাংলা" : "English"}
    </button>
  );
}
