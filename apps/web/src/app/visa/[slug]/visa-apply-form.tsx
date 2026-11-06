"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert, TextField, buttonClass } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

const PURPOSES = ["TOURISM", "BUSINESS", "FAMILY", "STUDY", "MEDICAL", "OTHER"] as const;

export function VisaApplyForm({
  slug,
  csrfToken,
  contact,
}: {
  slug: string;
  csrfToken: string;
  contact: { name: string; email: string; phone: string };
}) {
  const t = useTranslations("services");
  const router = useRouter();
  const [v, setV] = useState({
    travelDate: "",
    purpose: "TOURISM" as (typeof PURPOSES)[number],
    travellers: "1",
    nationality: "BD",
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
    const { data, error: problem } = await browserApi.POST("/api/v1/me/requests/visa", {
      headers: csrf(csrfToken),
      body: {
        visaProductSlug: slug,
        travellers: Number(v.travellers),
        details: { travelDate: v.travelDate, purpose: v.purpose, nationality: v.nationality },
        contact: { name: v.name, email: v.email, phone: v.phone },
        note: v.note,
      },
    });
    setBusy(false);
    if (!data) return setError(problemMessage(problem));
    router.push(`/account/requests/${data.id}`);
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-3">
      <TextField
        label={t("travelDate")}
        type="date"
        required
        value={v.travelDate}
        onChange={set("travelDate")}
      />
      <label className="grid gap-1 text-[0.84rem] font-semibold">
        {t("purpose")}
        <select
          value={v.purpose}
          onChange={set("purpose")}
          className="h-11 rounded-md border border-rule bg-card px-3 font-normal"
        >
          {PURPOSES.map((p) => (
            <option key={p} value={p}>
              {t(`purpose_${p}`)}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={t("travellers")}
          type="number"
          min={1}
          max={50}
          value={v.travellers}
          onChange={set("travellers")}
        />
        <TextField
          label={t("nationality")}
          maxLength={2}
          value={v.nationality}
          onChange={set("nationality")}
        />
      </div>
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
      <label className="grid gap-1 text-[0.84rem] font-semibold">
        {t("note")}
        <textarea
          value={v.note}
          onChange={set("note")}
          maxLength={1000}
          rows={3}
          className="rounded-md border border-rule bg-card px-3 py-2 font-normal"
        />
      </label>
      {error && <FormAlert>{error}</FormAlert>}
      <button
        type="submit"
        disabled={busy || !v.travelDate}
        className={buttonClass("primary", "md", "h-12")}
      >
        {busy ? t("submitting") : t("submitVisa")}
      </button>
    </form>
  );
}
