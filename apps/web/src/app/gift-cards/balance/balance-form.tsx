"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { FormAlert, TextField, buttonClass } from "@pegah/ui";
import type { Locale } from "@/i18n/locales";
import { browserApi } from "@/lib/api-browser";
import { calendarDate, money } from "@/lib/format";

type Result = {
  last4: string;
  balance: { amountMinor: number; currency: "BDT" | "USD" };
  expiresAt: string;
  usable: boolean;
};

export function BalanceForm() {
  const t = useTranslations("giftCards");
  const locale = useLocale() as Locale;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    const { data, response } = await browserApi.GET("/api/v1/gift-cards/balance", {
      params: { query: { code } },
    });
    setBusy(false);
    if (response.ok && data) setResult(data);
    else setError(t("notFound"));
  }

  return (
    <form onSubmit={submit} className="panel mt-3 grid gap-4 p-6">
      <TextField
        label={t("code")}
        value={code}
        autoComplete="off"
        spellCheck={false}
        placeholder="XXXX-XXXX-XXXX-XXXX"
        onChange={(e) => setCode(e.target.value.toUpperCase())}
      />
      {error && <FormAlert>{error}</FormAlert>}
      {result && (
        <div className="rounded-[14px] bg-good-soft p-4 text-good">
          <p className="text-[0.86rem] font-semibold">
            {t("balanceResult", { last4: result.last4 })}
          </p>
          <p className="tabular font-display text-[2rem] font-medium leading-tight">
            {money(result.balance)}
          </p>
          <p className="text-[0.84rem]">
            {result.usable
              ? t("validUntil", { date: calendarDate(result.expiresAt.slice(0, 10), locale) })
              : t("notUsable")}
          </p>
        </div>
      )}
      <button
        type="submit"
        disabled={busy || code.replace(/[^A-Z0-9]/gi, "").length < 16}
        className={buttonClass("primary", "md", "h-12")}
      >
        {busy ? t("checking") : t("check")}
      </button>
    </form>
  );
}
