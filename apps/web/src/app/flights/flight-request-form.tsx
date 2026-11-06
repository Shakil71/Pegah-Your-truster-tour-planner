"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert, TextField, buttonClass, cx } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

const CABINS = ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"] as const;
const AIRPORTS = [
  "Dhaka (DAC)",
  "Chattogram (CGP)",
  "Cox's Bazar (CXB)",
  "Sylhet (ZYL)",
  "Jashore (JSR)",
  "Rajshahi (RJH)",
  "Saidpur (SPD)",
  "Barishal (BZL)",
  "Kolkata (CCU)",
  "Bangkok (BKK)",
  "Kuala Lumpur (KUL)",
  "Singapore (SIN)",
  "Dubai (DXB)",
  "Jeddah (JED)",
  "Kathmandu (KTM)",
];

export function FlightRequestForm({
  csrfToken,
  contact,
  initial,
}: {
  csrfToken: string;
  contact: { name: string; email: string; phone: string };
  initial: { from: string; to: string; date: string };
}) {
  const t = useTranslations("services");
  const router = useRouter();
  const [trip, setTrip] = useState<"ONE_WAY" | "ROUND_TRIP">("ROUND_TRIP");
  const [v, setV] = useState({
    from: initial.from || "Dhaka (DAC)",
    to: initial.to,
    departDate: initial.date,
    returnDate: "",
    adults: "1",
    children: "0",
    infants: "0",
    cabin: "ECONOMY" as (typeof CABINS)[number],
    preferredAirline: "",
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    note: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: problem } = await browserApi.POST("/api/v1/me/requests/flight", {
      headers: csrf(csrfToken),
      body: {
        details: {
          tripType: trip,
          from: v.from,
          to: v.to,
          departDate: v.departDate,
          returnDate: trip === "ROUND_TRIP" ? v.returnDate || null : null,
          adults: Number(v.adults),
          children: Number(v.children),
          infants: Number(v.infants),
          cabin: v.cabin,
          preferredAirline: v.preferredAirline,
        },
        contact: { name: v.name, email: v.email, phone: v.phone },
        note: v.note,
      },
    });
    setBusy(false);
    if (!data) return setError(problemMessage(problem));
    router.push(`/account/requests/${data.id}`);
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div
        role="radiogroup"
        aria-label={t("flightsTitle")}
        className="flex w-fit gap-1 rounded-full border border-rule p-1"
      >
        {(["ROUND_TRIP", "ONE_WAY"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={trip === k}
            onClick={() => setTrip(k)}
            className={cx(
              "rounded-full px-4 py-1.5 text-[0.86rem] font-semibold",
              trip === k ? "bg-ink text-card" : "text-ink-2 hover:text-ink",
            )}
          >
            {t(k === "ONE_WAY" ? "oneWay" : "roundTrip")}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={t("from")}
          list="pg-airports"
          required
          value={v.from}
          onChange={set("from")}
        />
        <TextField label={t("to")} list="pg-airports" required value={v.to} onChange={set("to")} />
        <TextField
          label={t("departDate")}
          type="date"
          required
          value={v.departDate}
          onChange={set("departDate")}
        />
        {trip === "ROUND_TRIP" && (
          <TextField
            label={t("returnDate")}
            type="date"
            required
            value={v.returnDate}
            min={v.departDate}
            onChange={set("returnDate")}
          />
        )}
      </div>
      <datalist id="pg-airports">
        {AIRPORTS.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>
      <div className="grid grid-cols-3 gap-3">
        <TextField
          label={t("adults")}
          type="number"
          min={1}
          max={9}
          value={v.adults}
          onChange={set("adults")}
        />
        <TextField
          label={t("children")}
          type="number"
          min={0}
          max={9}
          value={v.children}
          onChange={set("children")}
        />
        <TextField
          label={t("infants")}
          type="number"
          min={0}
          max={9}
          value={v.infants}
          onChange={set("infants")}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-[0.84rem] font-semibold">
          {t("cabin")}
          <select
            value={v.cabin}
            onChange={set("cabin")}
            className="h-11 rounded-md border border-rule bg-card px-3 font-normal"
          >
            {CABINS.map((c) => (
              <option key={c} value={c}>
                {t(`cabin_${c}`)}
              </option>
            ))}
          </select>
        </label>
        <TextField
          label={t("preferredAirline")}
          value={v.preferredAirline}
          onChange={set("preferredAirline")}
        />
      </div>
      <div className="grid gap-3 border-t border-rule pt-4 sm:grid-cols-3">
        <TextField
          label={t("contactName")}
          autoComplete="name"
          value={v.name}
          onChange={set("name")}
        />
        <TextField
          label={t("contactEmail")}
          type="email"
          autoComplete="email"
          value={v.email}
          onChange={set("email")}
        />
        <TextField
          label={t("contactPhone")}
          type="tel"
          autoComplete="tel"
          value={v.phone}
          onChange={set("phone")}
        />
      </div>
      <label className="grid gap-1 text-[0.84rem] font-semibold">
        {t("note")}
        <textarea
          value={v.note}
          onChange={set("note")}
          maxLength={1000}
          rows={2}
          className="rounded-md border border-rule bg-card px-3 py-2 font-normal"
        />
      </label>
      {error && <FormAlert>{error}</FormAlert>}
      <button
        type="submit"
        disabled={busy || !v.to || !v.departDate}
        className={buttonClass("primary", "md", "h-12 justify-self-start")}
      >
        {busy ? t("submitting") : t("submitFlight")}
      </button>
    </form>
  );
}
