"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Schemas } from "@pegah/api-client";
import { FormAlert, Icon, TextField, buttonClass } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import { money } from "@/lib/format";

type Money = Schemas["BookingDetailDto_Output"]["amountDue"];
type Applied = { id: string; method: string | null; amount: Money };

/** Apply gift card balance to a held booking (ADR-0034). */
export function GiftCardBox({
  bookingId,
  csrfToken,
  total,
  amountDue,
  applied,
}: {
  bookingId: string;
  csrfToken: string;
  total: Money;
  amountDue: Money;
  applied: Applied[];
}) {
  const t = useTranslations("giftRedeem");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "good" | "critical"; text: string } | null>(null);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setBusy("apply");
    setNote(null);
    const { data, error, response } = await browserApi.POST("/api/v1/me/bookings/{id}/gift-card", {
      params: { path: { id: bookingId } },
      headers: csrf(csrfToken),
      body: { code },
    });
    setBusy(null);
    if (!response.ok || !data) {
      setNote({ tone: "critical", text: problemMessage(error) });
      return;
    }
    setCode("");
    setNote({
      tone: "good",
      text:
        data.bookingStatus === "CONFIRMED"
          ? t("confirmed")
          : t("appliedNote", { amount: money(data.applied), due: money(data.amountDue) }),
    });
    router.refresh();
  }

  async function remove(paymentId: string) {
    setBusy(paymentId);
    setNote(null);
    const { error, response } = await browserApi.DELETE(
      "/api/v1/me/bookings/{id}/gift-card/{paymentId}",
      { params: { path: { id: bookingId, paymentId } }, headers: csrf(csrfToken) },
    );
    setBusy(null);
    if (!response.ok) {
      setNote({ tone: "critical", text: problemMessage(error) });
      return;
    }
    router.refresh();
  }

  return (
    <section className="panel grid gap-4 p-5 md:p-6" aria-labelledby="gift-redeem-title">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-ink">
          <Icon name="gift" className="size-5" />
        </span>
        <div>
          <h2 id="gift-redeem-title" className="text-[1rem] font-semibold">
            {t("title")}
          </h2>
          <p className="text-[0.88rem] text-ink-2">{t("intro")}</p>
        </div>
      </div>

      {applied.length > 0 && (
        <ul className="grid gap-2 text-[0.9rem]">
          {applied.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-paper-2 px-3.5 py-2.5"
            >
              <span>
                {a.method} · <span className="tabular font-semibold">−{money(a.amount)}</span>
              </span>
              <button
                type="button"
                onClick={() => remove(a.id)}
                disabled={busy !== null}
                className="text-[0.84rem] font-semibold text-primary-ink hover:underline disabled:opacity-50"
              >
                {busy === a.id ? t("removing") : t("remove")}
              </button>
            </li>
          ))}
          <li className="flex justify-between px-1 pt-1 text-[0.9rem]">
            <span className="text-ink-2">{t("due", { total: money(total) })}</span>
            <span className="tabular font-semibold">{money(amountDue)}</span>
          </li>
        </ul>
      )}

      <form onSubmit={apply} className="flex flex-wrap items-end gap-2" noValidate>
        <TextField
          label={t("code")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          autoComplete="off"
          spellCheck={false}
          className="min-w-[220px] flex-1"
        />
        <button
          type="submit"
          disabled={busy !== null || code.replace(/[^a-z0-9]/gi, "").length < 16}
          className={buttonClass("primary", "md")}
        >
          {busy === "apply" ? t("applying") : t("apply")}
        </button>
      </form>
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
    </section>
  );
}
