"use client";

import { useTranslations } from "next-intl";
import { buttonClass } from "@pegah/ui";

export function PrintButton() {
  const t = useTranslations("voucher");
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary", "sm")}>
      {t("print")}
    </button>
  );
}
