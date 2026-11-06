"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert, TextField, buttonClass } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import { money } from "@/lib/format";

type Money = { amountMinor: number; currency: "BDT" | "USD" };

/** Places an offer order; the server recomputes the total and reserves stock. */
export function OfferOrderForm({
  offerId,
  unitPrice,
  maxQuantity,
  csrfToken,
  buyer: initialBuyer,
}: {
  offerId: string;
  unitPrice: Money;
  maxQuantity: number;
  csrfToken: string;
  buyer: { name: string; email: string; phone: string };
}) {
  const t = useTranslations("offers");
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [buyer, setBuyer] = useState(initialBuyer);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total: Money = {
    amountMinor: unitPrice.amountMinor * quantity,
    currency: unitPrice.currency,
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const {
      data,
      error: problem,
      response,
    } = await browserApi.POST("/api/v1/me/orders/offer", {
      headers: csrf(csrfToken),
      body: {
        offerId,
        quantity,
        buyer,
        ...(note.trim() ? { note: note.trim() } : {}),
        expectedTotal: total,
      },
    });
    setBusy(false);
    if (response.ok && data) {
      router.push(`/account/orders/${data.id}?new=1`);
      return;
    }
    if ((problem as { type?: string } | undefined)?.type === "/problems/price-changed") {
      setError(t("priceChanged"));
      router.refresh();
      return;
    }
    setError(problemMessage(problem));
  }

  return (
    <form onSubmit={submit} className="mt-5 grid gap-3" noValidate>
      <label className="grid gap-1 text-[0.84rem] font-semibold">
        {t("quantity")}
        <select
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="h-11 rounded-control border border-rule bg-card px-3 text-[0.92rem] font-normal"
        >
          {Array.from({ length: Math.max(1, maxQuantity) }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <TextField
        label={t("name")}
        autoComplete="name"
        value={buyer.name}
        onChange={(e) => setBuyer({ ...buyer, name: e.target.value })}
      />
      <TextField
        label={t("email")}
        type="email"
        autoComplete="email"
        value={buyer.email}
        onChange={(e) => setBuyer({ ...buyer, email: e.target.value })}
      />
      <TextField
        label={t("phone")}
        type="tel"
        autoComplete="tel"
        placeholder="+8801XXXXXXXXX"
        value={buyer.phone}
        onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })}
      />
      <TextField
        label={t("note")}
        value={note}
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
      />
      <p className="flex items-center justify-between border-t border-rule pt-3 font-bold">
        <span>{t("total")}</span>
        <span className="tabular text-[1.2rem]">{money(total)}</span>
      </p>
      {error && <FormAlert>{error}</FormAlert>}
      <button type="submit" disabled={busy} className={buttonClass("primary", "md", "h-12")}>
        {busy ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
