/** Website languages (ADR-0028). English is the default; Bangla is chosen in the header. */
export const LOCALES = ["en", "bn"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
/** Cookie holding the visitor's choice (one year, not a secret). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Intl locale for dates and counts: Bangla numerals in Bangla. Prices keep
 * Latin digits in both languages (formatMoney) so they match the payment
 * page and bank messages.
 */
export function intlLocale(locale: Locale): string {
  return locale === "bn" ? "bn-BD" : "en-GB";
}
