"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert, TextField, buttonClass, cx } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import { parseTaka } from "@/lib/money-input";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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
}: {
  roomId: string;
  from: string;
  today: string;
  csrfToken: string;
}) {
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
      setMessage({ tone: "critical", text: "Enter the rate in taka, e.g. 6500 or 6500.50." });
      return;
    }
    if (!total.trim() && rateMinor === undefined) {
      setMessage({ tone: "critical", text: "Set rooms on sale, a rate, or both." });
      return;
    }
    if (days.length === 0) {
      setMessage({ tone: "critical", text: "Pick at least one weekday." });
      return;
    }
    setBusy(true);
    const { data, error, response } = await browserApi.PUT("/api/v1/admin/rooms/{id}/calendar", {
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
    setMessage({
      tone: "good",
      text: `${data.datesUpdated} dates updated. The website shows them within a minute.`,
    });
    router.refresh();
  }

  return (
    <form onSubmit={apply} className="panel grid content-start gap-4 p-5 md:p-6">
      <h2 className="text-[0.95rem] font-semibold">Change a date range</h2>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="From"
          type="date"
          min={today}
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <TextField
          label="To (inclusive)"
          type="date"
          min={start}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>
      <fieldset>
        <legend className="text-[0.84rem] font-semibold">On these weekdays</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {WEEKDAYS.map((label, i) => {
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
        <p className="mt-1.5 text-[0.76rem] text-ink-3">Tip: Thu + Fri only for a weekend rate.</p>
      </fieldset>
      <TextField
        label="Rooms on sale per night"
        type="number"
        min={0}
        max={500}
        placeholder="Leave empty to keep"
        value={total}
        onChange={(e) => setTotal(e.target.value)}
        hint="Cannot go below rooms already held or sold. 0 stops sales."
      />
      <TextField
        label="Nightly rate (৳, per room)"
        inputMode="decimal"
        placeholder="Leave empty to keep"
        value={rate}
        onChange={(e) => setRate(e.target.value)}
        hint="Before service charge and VAT. Existing bookings keep their price."
      />
      {message && <FormAlert tone={message.tone}>{message.text}</FormAlert>}
      <button type="submit" disabled={busy} className={buttonClass("primary", "md")}>
        {busy ? "Applying…" : "Apply to dates"}
      </button>
    </form>
  );
}
