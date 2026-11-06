"use client";

import { useEffect, useRef, useState } from "react";
import { FormAlert, Icon, buttonClass, cx } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import type { MediaItem } from "@/lib/upload-image";
import { UploadForm, type HeroRef } from "./media-picker";

/**
 * Photo gallery editor: thumbnails in display order (move, remove) and a
 * library dialog that adds several photos at once.
 */
export function GalleryPicker({
  value,
  onChange,
  csrfToken,
  readOnly,
  label = "Photo gallery",
}: {
  value: HeroRef[];
  onChange: (v: HeroRef[]) => void;
  csrfToken: string;
  readOnly?: boolean;
  label?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setPicked(new Set());
    dialog.current?.showModal();
    setError(null);
    const { data, error: problem } = await browserApi.GET("/api/v1/admin/media", {
      params: { query: { limit: 100 } },
    });
    if (data) setItems(data.items);
    else setError(problemMessage(problem));
  }

  function add() {
    const have = new Set(value.map((v) => v.key));
    const extra = (items ?? [])
      .filter((m) => picked.has(m.key) && !have.has(m.key))
      .map((m) => ({ key: m.key, url: m.url, alt: m.alt }));
    onChange([...value, ...extra]);
    dialog.current?.close();
  }

  const move = (i: number, by: number) => {
    const next = [...value];
    const [x] = next.splice(i, 1);
    next.splice(i + by, 0, x!);
    onChange(next);
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[0.84rem] font-semibold">
          {label} ({value.length})
        </span>
        {!readOnly && (
          <button type="button" onClick={open} className={buttonClass("outline", "sm")}>
            <Icon name="plus" className="size-4" /> Add photos
          </button>
        )}
      </div>
      {value.length === 0 ? (
        <p className="text-[0.8rem] text-ink-3">No gallery photos yet.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          {value.map((p, i) => (
            <li key={p.key} className="grid gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- library images are already optimised WebP */}
              <img
                src={p.url}
                alt={p.alt}
                className="aspect-[4/3] w-full rounded-[8px] object-cover"
              />
              {!readOnly && (
                <div className="flex justify-between gap-1">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className={buttonClass("ghost", "sm", "px-2")}
                    aria-label={`Move photo ${i + 1} earlier`}
                  >
                    <Icon name="arrowLeft" className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((_, k) => k !== i))}
                    className={buttonClass("ghost", "sm", "px-2")}
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    <Icon name="x" className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={i === value.length - 1}
                    onClick={() => move(i, 1)}
                    className={buttonClass("ghost", "sm", "px-2")}
                    aria-label={`Move photo ${i + 1} later`}
                  >
                    <Icon name="arrowRight" className="size-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <dialog
        ref={dialog}
        aria-label="Add photos"
        className="w-[min(920px,calc(100vw-32px))] rounded-card border border-rule bg-card p-0 text-ink backdrop:bg-night/60"
      >
        <div className="grid max-h-[80vh] gap-4 overflow-y-auto p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[1rem] font-semibold">Add photos ({picked.size} selected)</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={add}
                disabled={picked.size === 0}
                className={buttonClass("primary", "sm")}
              >
                Add selected
              </button>
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                className={buttonClass("ghost", "sm")}
              >
                Close
              </button>
            </div>
          </div>
          <UploadForm
            csrfToken={csrfToken}
            onUploaded={(m) => {
              setItems((list) => [m as MediaItem, ...(list ?? [])]);
              setPicked((s) => new Set(s).add(m.key));
            }}
          />
          {error && <FormAlert>{error}</FormAlert>}
          {items === null ? (
            <p className="text-[0.86rem] text-ink-2">Loading the library…</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {items.map((m) => {
                const on = picked.has(m.key);
                return (
                  <li key={m.key}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setPicked((s) => {
                          const n = new Set(s);
                          if (n.has(m.key)) n.delete(m.key);
                          else n.add(m.key);
                          return n;
                        })
                      }
                      className={cx(
                        "block w-full overflow-hidden rounded-[10px] border-2 text-left",
                        on ? "border-primary" : "border-transparent hover:border-ink",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
                      <img src={m.url} alt={m.alt} className="aspect-[4/3] w-full object-cover" />
                      <span className="block truncate px-1 py-1 text-[0.74rem] text-ink-2">
                        {m.alt}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </dialog>
    </div>
  );
}

type Amenity = { slug: string; name: string; group: string | null };

/** Facility checkboxes grouped by type, with "add a facility" for new ones. */
export function AmenityPicker({
  scope,
  value,
  onChange,
  csrfToken,
  readOnly,
}: {
  scope: "HOTEL" | "ROOM" | "TOUR";
  value: string[];
  onChange: (v: string[]) => void;
  csrfToken: string;
  readOnly?: boolean;
}) {
  const [all, setAll] = useState<Amenity[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void browserApi
      .GET("/api/v1/admin/amenities", { params: { query: { scope } } })
      .then(({ data, error: problem }) => {
        if (!live) return;
        if (data) setAll(data.items);
        else setError(problemMessage(problem));
      });
    return () => {
      live = false;
    };
  }, [scope]);

  async function create() {
    setError(null);
    const { data, error: problem } = await browserApi.POST("/api/v1/admin/amenities", {
      headers: csrf(csrfToken),
      body: { scope, name: name.trim() },
    });
    if (!data) {
      setError(problemMessage(problem));
      return;
    }
    setAll((list) =>
      list?.some((a) => a.slug === data.amenity.slug) ? list : [...(list ?? []), data.amenity],
    );
    if (!value.includes(data.amenity.slug)) onChange([...value, data.amenity.slug]);
    setName("");
  }

  const groups = new Map<string, Amenity[]>();
  for (const a of all ?? [])
    groups.set(a.group ?? "Other", [...(groups.get(a.group ?? "Other") ?? []), a]);
  const toggle = (slug: string) =>
    onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);

  return (
    <fieldset className="grid gap-3" disabled={readOnly}>
      <legend className="text-[0.84rem] font-semibold">Facilities ({value.length})</legend>
      {error && <FormAlert>{error}</FormAlert>}
      {all === null ? (
        <p className="text-[0.8rem] text-ink-3">Loading facilities…</p>
      ) : (
        [...groups].map(([g, list]) => (
          <div key={g}>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
              {g}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5">
              {list.map((a) => (
                <label key={a.slug} className="flex items-center gap-1.5 text-[0.84rem]">
                  <input
                    type="checkbox"
                    checked={value.includes(a.slug)}
                    onChange={() => toggle(a.slug)}
                    className="size-4 accent-[var(--pg-primary)]"
                  />
                  {a.name}
                </label>
              ))}
            </div>
          </div>
        ))
      )}
      {!readOnly && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-[0.78rem] font-semibold text-ink-2">
            New facility
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className="h-9 w-56 rounded-md border border-rule bg-card px-2 text-[0.86rem] text-ink"
            />
          </label>
          <button
            type="button"
            onClick={create}
            disabled={name.trim().length < 2}
            className={buttonClass("outline", "sm")}
          >
            Add
          </button>
        </div>
      )}
    </fieldset>
  );
}
