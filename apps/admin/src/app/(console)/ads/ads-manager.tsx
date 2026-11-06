"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Schemas } from "@pegah/api-client";
import { FormAlert, SelectField, TextField, buttonClass, cx } from "@pegah/ui";
import { HeroPicker, type HeroRef } from "@/components/media-picker";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import { dhakaDateTime } from "@/lib/format";

type Ad = Schemas["AdminAdListDto_Output"]["items"][number];
type Placement = Ad["placement"];

const PLACEMENTS: Record<Placement, string> = {
  HOME_TOP: "Home page, below the search",
  HOME_MIDDLE: "Home page, middle",
  OFFERS_TOP: "Offers page, top",
};

/** ISO instant → value for a datetime-local input, in Dhaka time (UTC+6, no DST). */
function toDhakaInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 6 * 3600_000).toISOString().slice(0, 16);
}
function fromDhakaInput(v: string): string | null {
  return v ? new Date(`${v}:00+06:00`).toISOString() : null;
}

const blank = {
  titleEn: "",
  titleBn: "",
  textEn: "",
  textBn: "",
  linkHref: "",
  placement: "HOME_TOP" as Placement,
  startsAt: "",
  endsAt: "",
  active: "true",
  sortOrder: "0",
};

export function AdsManager({ items, csrfToken }: { items: Ad[]; csrfToken: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Ad | "new" | null>(null);
  const [v, setV] = useState(blank);
  const [image, setImage] = useState<HeroRef | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "good" | "critical"; text: string } | null>(null);

  function open(a: Ad | "new") {
    setNote(null);
    setEditing(a);
    if (a === "new") {
      setV(blank);
      setImage(null);
      return;
    }
    setV({
      titleEn: a.titleEn,
      titleBn: a.titleBn,
      textEn: a.textEn,
      textBn: a.textBn,
      linkHref: a.linkHref,
      placement: a.placement,
      startsAt: toDhakaInput(a.startsAt),
      endsAt: toDhakaInput(a.endsAt),
      active: String(a.active),
      sortOrder: String(a.sortOrder),
    });
    setImage(a.image);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setNote(null);
    if (!image) {
      setNote({ tone: "critical", text: "Choose a banner photo." });
      return;
    }
    const body = {
      titleEn: v.titleEn,
      titleBn: v.titleBn,
      textEn: v.textEn,
      textBn: v.textBn,
      media: image.key,
      linkHref: v.linkHref.trim(),
      placement: v.placement,
      startsAt: fromDhakaInput(v.startsAt),
      endsAt: fromDhakaInput(v.endsAt),
      active: v.active === "true",
      sortOrder: Number(v.sortOrder) || 0,
    };
    setBusy(true);
    const result =
      editing === "new"
        ? await browserApi.POST("/api/v1/admin/ads", { headers: csrf(csrfToken), body })
        : await browserApi.PUT("/api/v1/admin/ads/{id}", {
            params: { path: { id: (editing as Ad).id } },
            headers: csrf(csrfToken),
            body,
          });
    setBusy(false);
    if (!result.response.ok) {
      setNote({ tone: "critical", text: problemMessage(result.error) });
      return;
    }
    setNote({ tone: "good", text: "Ad saved." });
    setEditing(null);
    router.refresh();
  }

  async function remove(a: Ad) {
    if (!window.confirm(`Delete the ad "${a.titleEn}"? This cannot be undone.`)) return;
    setNote(null);
    const result = await browserApi.DELETE("/api/v1/admin/ads/{id}", {
      params: { path: { id: a.id } },
      headers: csrf(csrfToken),
    });
    if (!result.response.ok) {
      setNote({ tone: "critical", text: problemMessage(result.error) });
      return;
    }
    setNote({ tone: "good", text: "Ad deleted." });
    if (editing !== "new" && editing?.id === a.id) setEditing(null);
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
          New ad
        </button>
      </div>
      {note && !editing && <FormAlert tone={note.tone}>{note.text}</FormAlert>}

      {editing && (
        <form onSubmit={save} className="panel grid gap-4 p-5 md:p-6" noValidate>
          <h2 className="text-[1rem] font-semibold">
            {editing === "new" ? "New ad" : `Edit: ${v.titleEn}`}
          </h2>
          <HeroPicker
            value={image}
            onChange={setImage}
            csrfToken={csrfToken}
            label="Banner photo (wide photos work best)"
            emptyText="Required"
          />
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Headline (English)" {...field("titleEn")} />
            <TextField label="Headline (Bangla)" lang="bn" {...field("titleBn")} />
            <TextField label="Short line (English, optional)" {...field("textEn")} />
            <TextField label="Short line (Bangla, optional)" lang="bn" {...field("textBn")} />
            <TextField
              label="Link (optional)"
              hint="A page on this site such as /offers/eid-coxs-bazar, or a full https:// address."
              {...field("linkHref")}
            />
            <SelectField label="Where it shows" {...field("placement")}>
              {Object.entries(PLACEMENTS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Start (Dhaka time, optional)"
              type="datetime-local"
              {...field("startsAt")}
            />
            <TextField
              label="End (Dhaka time, optional)"
              type="datetime-local"
              {...field("endsAt")}
            />
            <SelectField label="Switched on" {...field("active")}>
              <option value="true">On</option>
              <option value="false">Off</option>
            </SelectField>
            <TextField label="Order" type="number" min={0} {...field("sortOrder")} />
          </div>
          {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={buttonClass("primary", "sm")}>
              {busy ? "Saving…" : "Save ad"}
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
        <p className="panel p-8 text-center text-ink-2">No ads yet.</p>
      ) : (
        <ul className="grid gap-3">
          {items.map((a) => (
            <li key={a.id} className="panel flex flex-wrap items-center gap-4 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- library thumbnail */}
              <img src={a.image.url} alt="" className="h-16 w-28 rounded-[8px] object-cover" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{a.titleEn}</p>
                <p className="text-[0.82rem] text-ink-3">
                  {PLACEMENTS[a.placement]}
                  {a.startsAt ? ` · from ${dhakaDateTime(a.startsAt)}` : ""}
                  {a.endsAt ? ` · until ${dhakaDateTime(a.endsAt)}` : ""}
                </p>
              </div>
              <span
                className={cx(
                  "rounded-full px-2.5 py-1 text-[0.74rem] font-semibold",
                  a.live ? "bg-good-soft text-good" : "bg-paper-2 text-ink-2",
                )}
              >
                {a.live ? "Showing now" : a.active ? "Scheduled / ended" : "Off"}
              </span>
              <button
                type="button"
                onClick={() => open(a)}
                className={buttonClass("outline", "sm")}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => remove(a)}
                className={buttonClass("ghost", "sm")}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
