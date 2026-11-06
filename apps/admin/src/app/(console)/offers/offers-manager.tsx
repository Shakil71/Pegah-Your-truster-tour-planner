"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Schemas } from "@pegah/api-client";
import { parseTaka, takaText } from "@pegah/shared";
import { FormAlert, SelectField, TextAreaField, TextField, buttonClass, cx } from "@pegah/ui";
import { HeroPicker, type HeroRef } from "@/components/media-picker";
import { PublishPill } from "@/components/publish-pill";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import { money } from "@/lib/format";

type Offer = Schemas["AdminOfferListDto_Output"]["items"][number];

const blank = {
  slug: "",
  titleEn: "",
  titleBn: "",
  summaryEn: "",
  summaryBn: "",
  detailsEn: "",
  detailsBn: "",
  price: "",
  originalPrice: "",
  validUntil: "",
  stock: "",
  status: "DRAFT" as "DRAFT" | "PUBLISHED" | "SUSPENDED",
  sortOrder: "0",
};

export function OffersManager({ items, csrfToken }: { items: Offer[]; csrfToken: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Offer | "new" | null>(null);
  const [v, setV] = useState(blank);
  const [hero, setHero] = useState<HeroRef | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "good" | "critical"; text: string } | null>(null);

  function open(o: Offer | "new") {
    setNote(null);
    setEditing(o);
    if (o === "new") {
      setV(blank);
      setHero(null);
      return;
    }
    setV({
      slug: o.slug,
      titleEn: o.titleEn,
      titleBn: o.titleBn,
      summaryEn: o.summaryEn,
      summaryBn: o.summaryBn,
      detailsEn: o.detailsEn,
      detailsBn: o.detailsBn,
      price: takaText(o.price),
      originalPrice: takaText(o.originalPrice),
      validUntil: o.validUntil?.slice(0, 10) ?? "",
      stock: o.stock === null ? "" : String(o.stock),
      status: o.status,
      sortOrder: String(o.sortOrder),
    });
    setHero(o.hero);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setNote(null);
    const price = parseTaka(v.price);
    const original = v.originalPrice.trim() ? parseTaka(v.originalPrice) : null;
    if (price === null || price <= 0 || (v.originalPrice.trim() && original === null)) {
      setNote({ tone: "critical", text: "Enter prices in taka, e.g. 12000 or 12000.50." });
      return;
    }
    const body = {
      titleEn: v.titleEn,
      titleBn: v.titleBn,
      summaryEn: v.summaryEn,
      summaryBn: v.summaryBn,
      detailsEn: v.detailsEn,
      detailsBn: v.detailsBn,
      priceMinor: price,
      originalPriceMinor: original,
      heroMedia: hero?.key ?? null,
      // End of the chosen day in Dhaka (UTC+6).
      validUntil: v.validUntil ? new Date(`${v.validUntil}T23:59:59+06:00`).toISOString() : null,
      stock: v.stock.trim() ? Number(v.stock) : null,
      status: v.status,
      sortOrder: Number(v.sortOrder) || 0,
    };
    setBusy(true);
    const result =
      editing === "new"
        ? await browserApi.POST("/api/v1/admin/offers", {
            headers: csrf(csrfToken),
            body: { ...body, slug: v.slug },
          })
        : await browserApi.PUT("/api/v1/admin/offers/{id}", {
            params: { path: { id: (editing as Offer).id } },
            headers: csrf(csrfToken),
            body,
          });
    setBusy(false);
    if (!result.response.ok) {
      setNote({ tone: "critical", text: problemMessage(result.error) });
      return;
    }
    setNote({ tone: "good", text: "Offer saved." });
    setEditing(null);
    router.refresh();
  }

  const field = (k: keyof typeof blank) => ({
    value: v[k],
    onChange: (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value }),
  });

  return (
    <div className="grid gap-6">
      <div className="flex justify-end">
        <button type="button" onClick={() => open("new")} className={buttonClass("primary", "sm")}>
          New offer
        </button>
      </div>
      {note && !editing && <FormAlert tone={note.tone}>{note.text}</FormAlert>}

      {editing && (
        <form onSubmit={save} className="panel grid gap-4 p-5 md:p-6" noValidate>
          <h2 className="text-[1rem] font-semibold">
            {editing === "new" ? "New offer" : `Edit: ${v.titleEn}`}
          </h2>
          <HeroPicker value={hero} onChange={setHero} csrfToken={csrfToken} />
          <div className="grid gap-4 md:grid-cols-2">
            {editing === "new" && (
              <TextField
                label="Web address (slug)"
                hint="e.g. coxs-bazar-3-days"
                {...field("slug")}
              />
            )}
            <SelectField label="Status" {...field("status")}>
              <option value="DRAFT">Draft (hidden)</option>
              <option value="PUBLISHED">Published</option>
              <option value="SUSPENDED">Paused</option>
            </SelectField>
            <TextField label="Title (English)" {...field("titleEn")} />
            <TextField label="Title (Bangla)" lang="bn" {...field("titleBn")} />
            <TextField label="Short summary (English)" {...field("summaryEn")} />
            <TextField label="Short summary (Bangla)" lang="bn" {...field("summaryBn")} />
            <TextAreaField label="What is included (English)" rows={6} {...field("detailsEn")} />
            <TextAreaField
              label="What is included (Bangla)"
              lang="bn"
              rows={6}
              {...field("detailsBn")}
            />
            <TextField label="Price (৳ per package)" inputMode="decimal" {...field("price")} />
            <TextField
              label="Original price (৳, optional)"
              inputMode="decimal"
              hint="Shown struck through."
              {...field("originalPrice")}
            />
            <TextField label="Available until (optional)" type="date" {...field("validUntil")} />
            <TextField
              label="Packages for sale (empty = unlimited)"
              type="number"
              min={0}
              {...field("stock")}
            />
            <TextField label="Order on the page" type="number" min={0} {...field("sortOrder")} />
          </div>
          {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={buttonClass("primary", "sm")}>
              {busy ? "Saving…" : "Save offer"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className={buttonClass("ghost", "sm")}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <p className="panel p-8 text-center text-ink-2">No offers yet. Create the first one.</p>
      ) : (
        <ul className="grid gap-3">
          {items.map((o) => (
            <li key={o.id} className="panel flex flex-wrap items-center gap-4 p-4">
              {o.hero ? (
                // eslint-disable-next-line @next/next/no-img-element -- library thumbnail
                <img src={o.hero.url} alt="" className="h-16 w-24 rounded-[8px] object-cover" />
              ) : (
                <span className="grid h-16 w-24 place-items-center rounded-[8px] bg-paper-2 text-[0.7rem] text-ink-3">
                  No photo
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{o.titleEn}</p>
                <p className="text-[0.82rem] text-ink-3">
                  /{o.slug} · {money(o.price)} · sold {o.sold}
                  {o.stock !== null ? ` of ${o.stock}` : ""}
                  {o.validUntil ? ` · until ${o.validUntil.slice(0, 10)}` : ""}
                </p>
              </div>
              <PublishPill status={o.status} />
              <span
                className={cx(
                  "text-[0.78rem] font-semibold",
                  o.available ? "text-good" : "text-ink-3",
                )}
              >
                {o.available ? "On sale" : "Not on sale"}
              </span>
              <button
                type="button"
                onClick={() => open(o)}
                className={buttonClass("outline", "sm")}
              >
                Edit
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
