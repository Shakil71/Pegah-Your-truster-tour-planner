import { formatMoney, type Money } from "@pegah/shared";
import { intlLocale, type Locale } from "@/i18n/locales";

/** Money for display: paisa shown only when the amount is not whole taka. Latin digits in every language. */
export function money(m: Money): string {
  return formatMoney(m, { decimals: m.amountMinor % 100 !== 0 });
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();
function fmt(locale: Locale, kind: "date" | "dateTime" | "dayMonth"): Intl.DateTimeFormat {
  const key = `${locale}:${kind}`;
  let f = dateFormats.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(
      intlLocale(locale),
      kind === "date"
        ? { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }
        : kind === "dayMonth"
          ? { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }
          : {
              timeZone: "Asia/Dhaka",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              hourCycle: "h23",
            },
    );
    dateFormats.set(key, f);
  }
  return f;
}

/** A calendar date (YYYY-MM-DD) as "12 Nov 2026" / "১২ নভে, 2026". */
export function calendarDate(iso: string, locale: Locale = "en"): string {
  return fmt(locale, "date").format(new Date(`${iso}T00:00:00Z`));
}

/** A calendar date with weekday, "Thu 12 Nov". */
export function dayMonth(iso: string, locale: Locale = "en"): string {
  return fmt(locale, "dayMonth").format(new Date(`${iso}T00:00:00Z`));
}

/** An instant in Dhaka time, "12 Nov, 14:05". */
export function dhakaDateTime(iso: string, locale: Locale = "en"): string {
  return fmt(locale, "dateTime").format(new Date(iso));
}

/** Catalog name in the visitor's language: the Bangla name when one is filled in. */
export function localName(locale: Locale, name: string, bn?: string | null): string {
  return locale === "bn" && bn ? bn : name;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
}
