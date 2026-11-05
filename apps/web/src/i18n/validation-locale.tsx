"use client";

import { useLocale } from "next-intl";
import { z } from "zod";
import { friendlyMessage, friendlyMessageBn } from "@pegah/contracts";

/**
 * Form validation messages in the visitor's language. Runs only in the
 * browser: the server's zod configuration is shared by all requests and stays
 * English (the API's problem details are English too).
 */
export function ValidationLocale() {
  const locale = useLocale();
  if (typeof window !== "undefined") {
    z.config({ customError: locale === "bn" ? friendlyMessageBn : friendlyMessage });
  }
  return null;
}
