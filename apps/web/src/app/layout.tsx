import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Hanken_Grotesk, Hind_Siliguri, Noto_Serif_Bengali } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { ValidationLocale } from "@/i18n/validation-locale";
import { savedTheme } from "@/lib/theme";
import "./globals.css";

const display = Bodoni_Moda({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--pg-font-display",
  display: "swap",
});
const text = Hanken_Grotesk({ subsets: ["latin"], variable: "--pg-font-text", display: "swap" });
const bengali = Noto_Serif_Bengali({
  subsets: ["bengali"],
  weight: "500",
  variable: "--pg-font-bn",
  display: "swap",
});

/** Bangla body text (ADR-0028); the bengali subset is only downloaded where Bangla appears. */
const bengaliText = Hind_Siliguri({
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  variable: "--pg-font-bn-text",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: { default: t("title"), template: "%s · Pegah" },
    description: t("description"),
  };
}

export const viewport: Viewport = {
  themeColor: "#0f1330",
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, messages, theme] = await Promise.all([getLocale(), getMessages(), savedTheme()]);
  return (
    <html
      lang={locale}
      data-theme={theme}
      className={`${display.variable} ${text.variable} ${bengali.variable} ${bengaliText.variable}`}
    >
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ValidationLocale />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
