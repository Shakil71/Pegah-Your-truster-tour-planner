"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert, TextField, buttonClass, cx } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

const PRESETS = [1000, 2000, 5000, 10000];
const taka = (n: number) => `৳${n.toLocaleString("en-IN")}`;

/** Buy a gift card for yourself or someone else; the code goes to the recipient by email. */
export function GiftCardForm({
  csrfToken,
  minTaka,
  maxTaka,
  buyer: initialBuyer,
}: {
  csrfToken: string;
  minTaka: number;
  maxTaka: number;
  buyer: { name: string; email: string; phone: string };
}) {
  const t = useTranslations("giftCards");
  const router = useRouter();
  const [amount, setAmount] = useState(2000);
  const [custom, setCustom] = useState("");
  const [forSelf, setForSelf] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [buyer, setBuyer] = useState(initialBuyer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = custom ? Number(custom) : amount;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const {
      data,
      error: problem,
      response,
    } = await browserApi.POST("/api/v1/me/orders/gift-card", {
      headers: csrf(csrfToken),
      body: {
        amountTaka: chosen,
        buyer,
        forSelf,
        ...(forSelf
          ? {}
          : {
              recipientName: recipientName.trim(),
              recipientEmail: recipientEmail.trim(),
              ...(message.trim() ? { message: message.trim() } : {}),
            }),
      },
    });
    setBusy(false);
    if (response.ok && data) {
      router.push(`/account/orders/${data.id}?new=1`);
      return;
    }
    setError(problemMessage(problem));
  }

  return (
    <form onSubmit={submit} className="panel grid gap-6 p-6 md:p-8" noValidate>
      <h2 className="font-display text-[1.8rem] font-medium">{t("formTitle")}</h2>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-[0.9rem] font-semibold">{t("amount")}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={!custom && amount === p}
              onClick={() => {
                setAmount(p);
                setCustom("");
              }}
              className={cx(
                "tabular h-12 rounded-control border-[1.5px] font-semibold",
                !custom && amount === p
                  ? "border-primary bg-primary-soft"
                  : "border-rule hover:border-ink",
              )}
            >
              {taka(p)}
            </button>
          ))}
        </div>
        <TextField
          label={t("custom", {
            min: minTaka.toLocaleString("en-IN"),
            max: maxTaka.toLocaleString("en-IN"),
          })}
          type="number"
          inputMode="numeric"
          min={minTaka}
          max={maxTaka}
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ""))}
        />
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-[0.9rem] font-semibold">{t("forWhom")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            [false, t("forOther")],
            [true, t("forSelf")],
          ].map(([value, label]) => (
            <button
              key={String(value)}
              type="button"
              aria-pressed={forSelf === value}
              onClick={() => setForSelf(value as boolean)}
              className={cx(
                "h-12 rounded-control border-[1.5px] font-semibold",
                forSelf === value
                  ? "border-primary bg-primary-soft"
                  : "border-rule hover:border-ink",
              )}
            >
              {label as string}
            </button>
          ))}
        </div>
        {!forSelf && (
          <div className="grid gap-3 md:grid-cols-2">
            <TextField
              label={t("recipientName")}
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
            <TextField
              label={t("recipientEmail")}
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
            />
            <div className="md:col-span-2">
              <TextField
                label={t("message")}
                value={message}
                maxLength={300}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-[0.9rem] font-semibold">{t("yourDetails")}</legend>
        <TextField
          label={t("name")}
          autoComplete="name"
          value={buyer.name}
          onChange={(e) => setBuyer({ ...buyer, name: e.target.value })}
        />
        <div className="grid gap-3 md:grid-cols-2">
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
        </div>
      </fieldset>

      {error && <FormAlert>{error}</FormAlert>}
      <button type="submit" disabled={busy || !chosen} className={buttonClass("primary", "lg")}>
        {busy ? t("submitting") : `${t("submit")} · ${chosen ? taka(chosen) : ""}`}
      </button>
    </form>
  );
}
