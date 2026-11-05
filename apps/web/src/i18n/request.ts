import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "./locales";

/** The visitor's language comes from a cookie; URLs are the same in both languages. */
export default getRequestConfig(async () => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(chosen) ? chosen : DEFAULT_LOCALE;
  return {
    locale,
    timeZone: "Asia/Dhaka",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
