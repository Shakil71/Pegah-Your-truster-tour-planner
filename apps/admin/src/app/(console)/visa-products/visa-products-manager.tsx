"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Schemas } from "@pegah/api-client";
import { FormAlert, Icon, TextField, buttonClass, cx } from "@pegah/ui";
import { HeroPicker, type HeroRef } from "@/components/media-picker";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import { money } from "@/lib/format";
import { parseTaka, takaText } from "@/lib/money-input";

type Visa = Schemas["AdminVisaProduct_Output"];
type Draft = {
  slug: string;
  country: string;
  countryBn: string;
  visaType: string;
  summary: string;
  processingTime: string;
  validity: string;
  fee: string;
  requirements: string;
  notes: string;
  status: "DRAFT" | "PUBLISHED" | "SUSPENDED";
  sortOrder: string;
  hero: HeroRef | null;
};
const toDraft = (v?: Visa): Draft => ({
  slug: v?.slug ?? "",
  country: v?.country ?? "",
  countryBn: v?.countryBn ?? "",
  visaType: v?.visaType ?? "Tourist visa",
  summary: v?.summary ?? "",
  processingTime: v?.processingTime ?? "",
  validity: v?.validity ?? "",
  fee: v ? takaText(v.fee) : "",
  requirements: (v?.requirements ?? ["Passport (at least 6 months valid)", "Recent photo"]).join(
    "\n",
  ),
  notes: v?.notes ?? "",
  status: v?.status ?? "DRAFT",
  sortOrder: String(v?.sortOrder ?? 0),
  hero: v?.hero ?? null,
});

export function VisaProductsManager({
  items,
  csrfToken,
  canManage,
}: {
  items: Visa[];
  csrfToken: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [d, setD] = useState<Draft>(toDraft());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) =>
    setD((s) => ({ ...s, [k]: e.target.value }));

  function open(v: Visa | "new") {
    setError(null);
    setEditing(v === "new" ? "new" : v.slug);
    setD(toDraft(v === "new" ? undefined : v));
  }

  async function save() {
    setError(null);
    const fee = parseTaka(d.fee);
    if (fee === null) return setError("Enter the starting price in taka, e.g. 6500.");
    setBusy(true);
    const body = {
      country: d.country,
      countryBn: d.countryBn,
      visaType: d.visaType,
      summary: d.summary,
      processingTime: d.processingTime,
      validity: d.validity,
      fee: { amountMinor: fee, currency: "BDT" as const },
      requirements: d.requirements
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      notes: d.notes,
      status: d.status,
      sortOrder: Number(d.sortOrder) || 0,
      heroMedia: d.hero?.key ?? null,
    };
    const r =
      editing === "new"
        ? await browserApi.POST("/api/v1/admin/visa-products", {
            headers: csrf(csrfToken),
            body: { ...body, slug: d.slug },
          })
        : await browserApi.PUT("/api/v1/admin/visa-products/{slug}", {
            params: { path: { slug: editing! } },
            headers: csrf(csrfToken),
            body,
          });
    setBusy(false);
    if (!r.response.ok) return setError(problemMessage(r.error));
    setEditing(null);
    router.refresh();
  }

  const form = (
    <div className="grid gap-3 rounded-[14px] border border-primary/50 bg-primary-soft/40 p-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <HeroPicker
          value={d.hero}
          onChange={(h) => setD((s) => ({ ...s, hero: h }))}
          csrfToken={csrfToken}
          label="Photo"
        />
      </div>
      <TextField
        label="URL slug"
        disabled={editing !== "new"}
        hint="e.g. thailand-tourist"
        value={d.slug}
        onChange={set("slug")}
      />
      <label className="grid gap-1 text-[0.84rem] font-semibold">
        Status
        <select
          value={d.status}
          onChange={set("status")}
          className="h-11 rounded-md border border-rule bg-card px-3 font-normal"
        >
          <option value="DRAFT">Draft (hidden)</option>
          <option value="PUBLISHED">Live on site</option>
          <option value="SUSPENDED">Suspended (hidden)</option>
        </select>
      </label>
      <TextField label="Country" value={d.country} onChange={set("country")} />
      <TextField
        label="Country in Bangla (optional)"
        lang="bn"
        value={d.countryBn}
        onChange={set("countryBn")}
      />
      <TextField label="Visa type" value={d.visaType} onChange={set("visaType")} />
      <TextField
        label="Processing time"
        hint="e.g. 7–10 working days"
        value={d.processingTime}
        onChange={set("processingTime")}
      />
      <TextField
        label="Validity (optional)"
        hint="e.g. 90 days, single entry"
        value={d.validity}
        onChange={set("validity")}
      />
      <TextField
        label="Price from, per traveller (৳)"
        inputMode="decimal"
        value={d.fee}
        onChange={set("fee")}
      />
      <TextField
        label="Sort order"
        inputMode="numeric"
        value={d.sortOrder}
        onChange={set("sortOrder")}
      />
      <label className="grid gap-1 text-[0.84rem] font-semibold md:col-span-2">
        Summary (shown on the list)
        <textarea
          value={d.summary}
          onChange={set("summary")}
          maxLength={300}
          rows={2}
          className="rounded-md border border-rule bg-card px-3 py-2 font-normal"
        />
      </label>
      <label className="grid gap-1 text-[0.84rem] font-semibold">
        Documents needed (one per line)
        <textarea
          value={d.requirements}
          onChange={set("requirements")}
          rows={6}
          className="rounded-md border border-rule bg-card px-3 py-2 font-normal"
        />
      </label>
      <label className="grid gap-1 text-[0.84rem] font-semibold">
        Notes (optional)
        <textarea
          value={d.notes}
          onChange={set("notes")}
          rows={6}
          className="rounded-md border border-rule bg-card px-3 py-2 font-normal"
        />
      </label>
      {error && (
        <div className="md:col-span-2">
          <FormAlert>{error}</FormAlert>
        </div>
      )}
      <div className="flex gap-2 md:col-span-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className={buttonClass("primary", "sm")}
        >
          {busy ? "Saving…" : editing === "new" ? "Add visa" : "Save visa"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(null)}
          className={buttonClass("ghost", "sm")}
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <section className="panel p-5 md:p-6" aria-labelledby="visa-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="visa-h" className="text-[0.95rem] font-semibold">
          Visas ({items.length})
        </h2>
        {canManage && editing !== "new" && (
          <button
            type="button"
            onClick={() => open("new")}
            className={buttonClass("outline", "sm")}
          >
            <Icon name="plus" className="size-4" /> Add visa
          </button>
        )}
      </div>
      <ul className="mt-4 grid gap-3">
        {editing === "new" && <li>{form}</li>}
        {items.map((v) =>
          editing === v.slug ? (
            <li key={v.id}>{form}</li>
          ) : (
            <li
              key={v.id}
              className={cx(
                "flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-rule p-4",
                v.status !== "PUBLISHED" && "opacity-70",
              )}
            >
              <div>
                <p className="font-semibold">
                  {v.country} · {v.visaType}
                  <span className="ml-2 text-[0.74rem] font-normal text-ink-3">
                    {v.status === "PUBLISHED" ? "live" : v.status.toLowerCase()}
                  </span>
                </p>
                <p className="text-[0.82rem] text-ink-2">
                  From {money(v.fee)} · {v.processingTime} · {v.requirements.length} documents ·{" "}
                  {v.openRequests} open requests
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => open(v)}
                  className={buttonClass("ghost", "sm")}
                >
                  Edit
                </button>
              )}
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
