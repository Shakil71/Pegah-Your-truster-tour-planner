"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert, TextField, buttonClass, cx } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import { parseTaka } from "@pegah/shared";

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Bulk edit for a date range: rooms on sale and/or nightly rate, optionally
 * only on some weekdays (e.g. a Thursday–Friday weekend rate). The API locks
 * the dates and refuses to go below rooms already held or sold.
 */
export function CalendarEditor({
  roomId,
  from,
  today,
  csrfToken,
  weekdays,
}: {
  roomId: string;
  from: string;
  today: string;
  csrfToken: string;
  /** Short weekday names, Sunday first, in the page language. */
  weekdays: string[];
}) {
  const t = useTranslations("partner");
  const router = useRouter();
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(addDays(from, 30));
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [total, setTotal] = useState("");
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "critical"; text: string } | null>(null);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const rateMinor = rate.trim() ? parseTaka(rate) : undefined;
    if (rateMinor === null) {
      setMessage({ tone: "critical", text: t("editor.badRate") });
      return;
    }
    if (!total.trim() && rateMinor === undefined) {
      setMessage({ tone: "critical", text: t("editor.nothing") });
      return;
    }
    if (days.length === 0) {
      setMessage({ tone: "critical", text: t("editor.noDay") });
      return;
    }
    setBusy(true);
    const { data, error, response } = await browserApi.PUT("/api/v1/partner/rooms/{id}/calendar", {
      params: { path: { id: roomId } },
      headers: csrf(csrfToken),
      body: {
        from: start,
        to: end,
        ...(days.length < 7 ? { weekdays: days } : {}),
        ...(total.trim() ? { total: Number(total) } : {}),
        ...(rateMinor !== undefined
          ? { rate: { amountMinor: rateMinor, currency: "BDT" as const } }
          : {}),
      },
    });
    setBusy(false);
    if (!response.ok || !data) {
      setMessage({ tone: "critical", text: problemMessage(error) });
      return;
    }
    setMessage({ tone: "good", text: t("editor.updated", { count: data.datesUpdated }) });
    router.refresh();
  }

  return (
    <form onSubmit={apply} className="panel grid content-start gap-4 p-5 md:p-6">
      <h2 className="text-[0.95rem] font-semibold">{t("editor.title")}</h2>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={t("editor.from")}
          type="date"
          min={today}
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <TextField
          label={t("editor.to")}
          type="date"
          min={start}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>
      <fieldset>
        <legend className="text-[0.84rem] font-semibold">{t("editor.weekdays")}</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {weekdays.map((label, i) => {
            const on = days.includes(i);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                onClick={() => setDays((d) => (on ? d.filter((x) => x !== i) : [...d, i].sort()))}
                className={cx(
                  "rounded-full border px-3 py-1.5 text-[0.78rem] font-semibold",
                  on
                    ? "border-primary bg-primary text-on-primary"
                    : "border-rule text-ink-2 hover:border-ink",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[0.76rem] text-ink-3">{t("editor.tip")}</p>
      </fieldset>
      <TextField
        label={t("editor.rooms")}
        type="number"
        min={0}
        max={500}
        placeholder={t("editor.keep")}
        value={total}
        onChange={(e) => setTotal(e.target.value)}
        hint={t("editor.roomsHint")}
      />
      <TextField
        label={t("editor.rate")}
        inputMode="decimal"
        placeholder={t("editor.keep")}
        value={rate}
        onChange={(e) => setRate(e.target.value)}
        hint={t("editor.rateHint")}
      />
      {message && <FormAlert tone={message.tone}>{message.text}</FormAlert>}
      <button type="submit" disabled={busy} className={buttonClass("primary", "md")}>
        {busy ? t("editor.applying") : t("editor.apply")}
      </button>
    </form>
  );
}
