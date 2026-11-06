"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Schemas } from "@pegah/api-client";
import { FormAlert, Icon, TextField, buttonClass, cx } from "@pegah/ui";
import { AmenityPicker, GalleryPicker } from "@/components/gallery-picker";
import type { HeroRef } from "@/components/media-picker";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import { money } from "@/lib/format";

type Room = Schemas["AdminRoom_Output"];
type Draft = {
  name: string;
  description: string;
  maxAdults: string;
  maxChildren: string;
  bedType: string;
  sizeSqm: string;
  isActive: boolean;
  roomType: string;
  details: string;
  airConditioned: "" | "yes" | "no";
  extraBeds: string;
  gallery: HeroRef[];
  amenities: string[];
};

const toDraft = (r?: Room): Draft => ({
  name: r?.name ?? "",
  description: r?.description ?? "",
  maxAdults: String(r?.maxAdults ?? 2),
  maxChildren: String(r?.maxChildren ?? 0),
  bedType: r?.bedType ?? "",
  sizeSqm: r?.sizeSqm ? String(r.sizeSqm) : "",
  isActive: r?.isActive ?? true,
  roomType: r?.roomType ?? "",
  details: r?.details ?? "",
  airConditioned: r?.airConditioned === true ? "yes" : r?.airConditioned === false ? "no" : "",
  extraBeds: String(r?.extraBeds ?? 0),
  gallery: r?.gallery ?? [],
  amenities: r?.amenities ?? [],
});

/** Room types of one hotel: list, inline edit, add, and a link to each room's calendar. */
export function RoomsEditor({
  hotelSlug,
  rooms,
  canManage,
  canInventory,
  csrfToken,
}: {
  hotelSlug: string;
  rooms: Room[];
  canManage: boolean;
  canInventory: boolean;
  csrfToken: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(
    rooms.length === 0 && canManage ? "new" : null,
  );
  const [draft, setDraft] = useState<Draft>(toDraft());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(target: Room | "new") {
    setError(null);
    setEditing(target === "new" ? "new" : target.id);
    setDraft(toDraft(target === "new" ? undefined : target));
  }

  async function save() {
    setBusy(true);
    setError(null);
    const body = {
      name: draft.name,
      description: draft.description,
      maxAdults: Number(draft.maxAdults),
      maxChildren: Number(draft.maxChildren),
      bedType: draft.bedType,
      sizeSqm: draft.sizeSqm ? Number(draft.sizeSqm) : null,
      isActive: draft.isActive,
      roomType: draft.roomType,
      details: draft.details,
      airConditioned:
        draft.airConditioned === ""
          ? ("UNKNOWN" as const)
          : draft.airConditioned === "yes"
            ? ("YES" as const)
            : ("NO" as const),
      extraBeds: Number(draft.extraBeds) || 0,
      gallery: draft.gallery.map((g) => g.key),
      amenities: draft.amenities,
    };
    const result =
      editing === "new"
        ? await browserApi.POST("/api/v1/admin/hotels/{slug}/rooms", {
            params: { path: { slug: hotelSlug } },
            headers: csrf(csrfToken),
            body,
          })
        : await browserApi.PUT("/api/v1/admin/rooms/{id}", {
            params: { path: { id: editing! } },
            headers: csrf(csrfToken),
            body,
          });
    setBusy(false);
    if (!result.response.ok) {
      setError(problemMessage(result.error));
      return;
    }
    setEditing(null);
    router.refresh();
  }

  const field = (key: keyof Draft, label: string, props: Record<string, unknown> = {}) => (
    <TextField
      label={label}
      value={String(draft[key] as string)}
      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
      {...props}
    />
  );

  const form = (
    <div className="grid gap-3 rounded-[14px] border border-primary/50 bg-primary-soft/40 p-4 md:grid-cols-3">
      {field("name", "Room type name")}
      {field("bedType", "Beds", { placeholder: "1 King" })}
      {field("sizeSqm", "Size m² (optional)", { inputMode: "numeric" })}
      {field("maxAdults", "Max adults", { type: "number", min: 1, max: 30 })}
      {field("maxChildren", "Max children", { type: "number", min: 0, max: 20 })}
      {field("roomType", "Room category (optional)", { placeholder: "Couple Deluxe" })}
      {field("extraBeds", "Extra beds", { type: "number", min: 0, max: 10 })}
      <label className="grid gap-1 text-[0.84rem] font-semibold">
        Air conditioning
        <select
          value={draft.airConditioned}
          onChange={(e) =>
            setDraft((d) => ({ ...d, airConditioned: e.target.value as Draft["airConditioned"] }))
          }
          className="h-11 rounded-md border border-rule bg-card px-3 font-normal"
        >
          <option value="">Not stated</option>
          <option value="yes">Air-conditioned</option>
          <option value="no">No air conditioning</option>
        </select>
      </label>
      <label className="flex items-center gap-2 self-end pb-3 text-[0.88rem]">
        <input
          type="checkbox"
          checked={draft.isActive}
          onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
          className="size-4 accent-[var(--pg-primary)]"
        />
        On sale (active)
      </label>
      <div className="md:col-span-3">{field("description", "Short description")}</div>
      <label className="grid gap-1 text-[0.84rem] font-semibold md:col-span-3">
        Full details (optional)
        <textarea
          value={draft.details}
          onChange={(e) => setDraft((d) => ({ ...d, details: e.target.value }))}
          rows={4}
          className="rounded-md border border-rule bg-card px-3 py-2 font-normal"
        />
      </label>
      <div className="md:col-span-3">
        <GalleryPicker
          label="Room photos"
          value={draft.gallery}
          onChange={(g) => setDraft((d) => ({ ...d, gallery: g }))}
          csrfToken={csrfToken}
        />
      </div>
      <div className="md:col-span-3">
        <AmenityPicker
          scope="ROOM"
          value={draft.amenities}
          onChange={(a) => setDraft((d) => ({ ...d, amenities: a }))}
          csrfToken={csrfToken}
        />
      </div>
      {error && (
        <div className="md:col-span-3">
          <FormAlert>{error}</FormAlert>
        </div>
      )}
      <div className="flex gap-2 md:col-span-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className={buttonClass("primary", "sm")}
        >
          {busy ? "Saving…" : editing === "new" ? "Add room type" : "Save room type"}
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
    <section className="panel p-5 md:p-6" aria-labelledby="rooms-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="rooms-h" className="text-[0.95rem] font-semibold">
            Room types ({rooms.length})
          </h2>
          <p className="mt-1 text-[0.78rem] text-ink-3">
            Open a room&apos;s calendar to set rooms on sale and nightly rates.
          </p>
        </div>
        {canManage && editing !== "new" && (
          <button
            type="button"
            onClick={() => open("new")}
            className={buttonClass("outline", "sm")}
          >
            <Icon name="plus" className="size-4" /> Add room type
          </button>
        )}
      </div>
      <ul className="mt-4 grid gap-3">
        {editing === "new" && <li>{form}</li>}
        {rooms.map((r) =>
          editing === r.id ? (
            <li key={r.id}>{form}</li>
          ) : (
            <li
              key={r.id}
              className={cx(
                "grid gap-3 rounded-[14px] border border-rule p-4 md:grid-cols-[minmax(0,1fr)_auto]",
                !r.isActive && "opacity-60",
              )}
            >
              <div>
                <p className="font-semibold">
                  {r.name}
                  {!r.isActive && (
                    <span className="ml-2 text-[0.74rem] font-normal text-ink-3">
                      (not on sale)
                    </span>
                  )}
                </p>
                <p className="text-[0.82rem] text-ink-2">
                  {r.bedType} · up to {r.maxAdults} adults
                  {r.maxChildren ? ` + ${r.maxChildren} children` : ""}
                  {r.sizeSqm ? ` · ${r.sizeSqm} m²` : ""}
                  {r.gallery.length ? ` · ${r.gallery.length} photos` : ""}
                  {r.amenities.length ? ` · ${r.amenities.length} facilities` : ""}
                </p>
                {(r.rackRate || r.discountRate) && (
                  <p className="text-[0.76rem] text-ink-3">
                    Old website price: {r.rackRate ? money(r.rackRate) : "—"}
                    {r.discountRate ? ` (offer ${money(r.discountRate)})` : ""}
                    {r.units ? ` · ${r.units} rooms` : ""} — reference only; set rates in the
                    calendar.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {canInventory && (
                  <Link href={`/catalog/rooms/${r.id}`} className={buttonClass("ink", "sm")}>
                    <Icon name="calendar" className="size-4" /> Calendar and rates
                  </Link>
                )}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => open(r)}
                    className={buttonClass("ghost", "sm")}
                  >
                    Edit
                  </button>
                )}
              </div>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
