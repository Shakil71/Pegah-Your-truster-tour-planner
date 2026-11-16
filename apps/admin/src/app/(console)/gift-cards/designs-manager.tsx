"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Schemas } from "@pegah/api-client";
import { FormAlert, SelectField, TextAreaField, TextField, buttonClass } from "@pegah/ui";
import { HeroPicker, type HeroRef } from "@/components/media-picker";
import { ItemActions } from "@/components/item-actions";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

type Design = Schemas["AdminGiftCardDesignListDto_Output"]["items"][number];

const blank = {
  nameEn: "",
  nameBn: "",
  labelEn: "",
  labelBn: "",
  lineEn: "",
  lineBn: "",
  messageEn: "",
  messageBn: "",
  amountTaka: "3000",
  active: "true",
  sortOrder: "0",
};

const taka = (minor: number) => `৳${(minor / 100).toLocaleString("en-IN")}`;

/** A small picture of the card as customers see it on /gift-cards. */
function CardPreview({
  image,
  name,
  label,
  amount,
}: {
  image: HeroRef | null;
  name: string;
  label: string;
  amount: string;
}) {
  return (
    <div className="relative aspect-[1.6/1] w-full max-w-[340px] overflow-hidden rounded-[16px] bg-night text-white shadow-lift">
      {image && (
        // eslint-disable-next-line @next/next/no-img-element -- library preview
        <img src={image.url} alt="" className="absolute inset-0 size-full object-cover" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(160deg,rgb(9_12_34/0.15),rgb(9_12_34/0.75))]" />
      {/* eslint-disable-next-line @next/next/no-img-element -- brand wordmark */}
      <img src="/brand/pegah-logo.webp" alt="" className="absolute left-3 top-3 h-7 w-auto" />
      <span className="tabular absolute right-3 top-3 rounded-full bg-primary px-2.5 py-0.5 font-semibold text-on-primary">
        ৳{Number(amount || 0).toLocaleString("en-IN")}
      </span>
      <span className="absolute bottom-3 left-3 right-3 truncate text-[0.68rem] font-bold uppercase tracking-[0.14em] text-white/90">
        Gift card{label ? ` · ${label}` : ""}
      </span>
      {!image && (
        <span className="absolute inset-0 grid place-items-center text-[0.8rem] text-white/70">
          Choose a photo
        </span>
      )}
      <span className="sr-only">{name}</span>
    </div>
  );
}

export function DesignsManager({ items, csrfToken }: { items: Design[]; csrfToken: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Design | "new" | null>(null);
  const [v, setV] = useState(blank);
  const [image, setImage] = useState<HeroRef | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "good" | "critical"; text: string } | null>(null);

  function open(d: Design | "new") {
    setNote(null);
    setEditing(d);
    if (d === "new") {
      setV(blank);
      setImage(null);
      return;
    }
    setV({
      nameEn: d.nameEn,
      nameBn: d.nameBn,
      labelEn: d.labelEn,
      labelBn: d.labelBn,
      lineEn: d.lineEn,
      lineBn: d.lineBn,
      messageEn: d.messageEn,
      messageBn: d.messageBn,
      amountTaka: String(d.amount.amountMinor / 100),
      active: String(d.active),
      sortOrder: String(d.sortOrder),
    });
    setImage(d.image);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setNote(null);
    if (!image) {
      setNote({ tone: "critical", text: "Choose or upload a card photo." });
      return;
    }
    const amount = Number(v.amountTaka.replace(/[,\s৳]/g, ""));
    if (!Number.isInteger(amount) || amount < 500 || amount > 100_000) {
      setNote({ tone: "critical", text: "Amount must be whole taka between 500 and 100,000." });
      return;
    }
    const body = {
      nameEn: v.nameEn,
      nameBn: v.nameBn,
      labelEn: v.labelEn,
      labelBn: v.labelBn,
      lineEn: v.lineEn,
      lineBn: v.lineBn,
      messageEn: v.messageEn,
      messageBn: v.messageBn,
      amountMinor: amount * 100,
      media: image.key,
      active: v.active === "true",
      sortOrder: Number(v.sortOrder) || 0,
    };
    setBusy(true);
    const result =
      editing === "new"
        ? await browserApi.POST("/api/v1/admin/gift-card-designs", {
            headers: csrf(csrfToken),
            body,
          })
        : await browserApi.PUT("/api/v1/admin/gift-card-designs/{id}", {
            params: { path: { id: (editing as Design).id } },
            headers: csrf(csrfToken),
            body,
          });
    setBusy(false);
    if (!result.response.ok) {
      setNote({ tone: "critical", text: problemMessage(result.error) });
      return;
    }
    setNote({ tone: "good", text: "Design saved. It shows on the website within a minute." });
    setEditing(null);
    router.refresh();
  }

  async function remove(d: Design) {
    if (!window.confirm(`Delete the design "${d.nameEn}"? Cards already sold are not affected.`))
      return;
    setNote(null);
    const result = await browserApi.DELETE("/api/v1/admin/gift-card-designs/{id}", {
      params: { path: { id: d.id } },
      headers: csrf(csrfToken),
    });
    if (!result.response.ok) {
      setNote({ tone: "critical", text: problemMessage(result.error) });
      return;
    }
    setNote({ tone: "good", text: "Design deleted." });
    if (editing !== "new" && editing?.id === d.id) setEditing(null);
    router.refresh();
  }

  const field = (k: keyof typeof blank) => ({
    value: v[k],
    onChange: (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value }),
  });

  return (
    <section aria-labelledby="designs-h" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="designs-h" className="text-[1.1rem] font-semibold">
            Card designs on the website
          </h2>
          <p className="text-[0.86rem] text-ink-2">
            Make your own cards with a photo, a suggested amount and a gift message. Customers pick
            one on the Gift cards page; any card works on every stay and tour.
          </p>
        </div>
        <button type="button" onClick={() => open("new")} className={buttonClass("primary", "sm")}>
          New design
        </button>
      </div>
      {note && !editing && <FormAlert tone={note.tone}>{note.text}</FormAlert>}

      {editing && (
        <form onSubmit={save} className="panel grid gap-5 p-5 md:p-6" noValidate>
          <h3 className="text-[1rem] font-semibold">
            {editing === "new" ? "New gift card design" : `Edit: ${v.nameEn}`}
          </h3>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="grid gap-4">
              <HeroPicker
                value={image}
                onChange={setImage}
                csrfToken={csrfToken}
                label="Card photo (upload a sharp, wide photo, 1600 px or more)"
                emptyText="Required"
              />
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Card name (English)" {...field("nameEn")} />
                <TextField label="Card name (Bangla)" lang="bn" {...field("nameBn")} />
                <TextField
                  label="Label on the card (English, optional)"
                  hint="For example: Cox's Bazar"
                  {...field("labelEn")}
                />
                <TextField
                  label="Label on the card (Bangla, optional)"
                  lang="bn"
                  {...field("labelBn")}
                />
                <TextField label="Short line (English, optional)" {...field("lineEn")} />
                <TextField label="Short line (Bangla, optional)" lang="bn" {...field("lineBn")} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <TextAreaField
                  label="Gift message (English, optional)"
                  hint="Prefilled in the form; the buyer can change it."
                  rows={3}
                  maxLength={300}
                  {...field("messageEn")}
                />
                <TextAreaField
                  label="Gift message (Bangla, optional)"
                  lang="bn"
                  rows={3}
                  maxLength={300}
                  {...field("messageBn")}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <TextField
                  label="Amount, taka"
                  inputMode="numeric"
                  hint="500 to 100,000"
                  {...field("amountTaka")}
                />
                <SelectField label="Shown on the website" {...field("active")}>
                  <option value="true">Yes</option>
                  <option value="false">No (hidden)</option>
                </SelectField>
                <TextField label="Order" type="number" min={0} {...field("sortOrder")} />
              </div>
            </div>
            <div className="grid content-start gap-2">
              <p className="text-[0.8rem] font-semibold text-ink-2">Preview</p>
              <CardPreview
                image={image}
                name={v.nameEn}
                label={v.labelEn}
                amount={v.amountTaka.replace(/[,\s৳]/g, "")}
              />
              <p className="font-semibold">{v.nameEn || "Card name"}</p>
              {v.lineEn && <p className="text-[0.86rem] text-ink-2">{v.lineEn}</p>}
            </div>
          </div>
          {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={buttonClass("primary", "sm")}>
              {busy ? "Saving…" : "Save design"}
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
        <p className="panel p-6 text-[0.9rem] text-ink-2">
          No designs of your own yet. Until you add one, the website shows Pegah&apos;s four
          built-in seasonal cards (Cox&apos;s Bazar and Saint Martin). Once you add a design, only
          your designs are shown.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((d) => (
            <li key={d.id} className="panel grid gap-3 p-4">
              <CardPreview
                image={d.image}
                name={d.nameEn}
                label={d.labelEn}
                amount={String(d.amount.amountMinor / 100)}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{d.nameEn}</p>
                  <p className="text-[0.82rem] text-ink-3">
                    {taka(d.amount.amountMinor)} · order {d.sortOrder}
                  </p>
                </div>
                <ItemActions
                  kind="gift-card-design"
                  itemKey={d.id}
                  name={d.nameEn}
                  visible={d.active}
                  csrfToken={csrfToken}
                  toggleOnly
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => open(d)}
                  className={buttonClass("outline", "sm")}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(d)}
                  className={buttonClass("ghost", "sm")}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
