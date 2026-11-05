"use client";

import { useRef, useState } from "react";
import { FormAlert, TextField, buttonClass, cx } from "@pegah/ui";
import { browserApi, problemMessage } from "@/lib/api-browser";
import { uploadImage, type MediaItem } from "@/lib/upload-image";

export type HeroRef = { key: string; url: string; alt: string };

/** Upload form shared by the picker and the media library page. */
export function UploadForm({
  csrfToken,
  onUploaded,
}: {
  csrfToken: string;
  onUploaded: (m: MediaItem) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [credit, setCredit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const m = await uploadImage(file, { alt, credit: credit || undefined }, csrfToken);
      setFile(null);
      setAlt("");
      setCredit("");
      if (input.current) input.current.value = "";
      onUploaded(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-[14px] border border-dashed border-rule p-4">
      <label className="grid gap-1 text-[0.84rem] font-semibold">
        Photo (JPEG, PNG or WebP)
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-[0.86rem] font-normal"
        />
      </label>
      <TextField
        label="Description for screen readers (required)"
        value={alt}
        maxLength={255}
        onChange={(e) => setAlt(e.target.value)}
        hint="Say what the photo shows, e.g. 'Tea bushes on a hillside at sunrise'."
      />
      <TextField
        label="Credit (photographer or source)"
        value={credit}
        maxLength={255}
        onChange={(e) => setCredit(e.target.value)}
        hint="Use only photos you own or are licensed to use."
      />
      {error && <FormAlert>{error}</FormAlert>}
      <button
        type="button"
        disabled={busy || !file || alt.trim().length < 3}
        onClick={submit}
        className={buttonClass("primary", "sm", "justify-self-start")}
      >
        {busy ? "Uploading…" : "Upload photo"}
      </button>
    </div>
  );
}

/**
 * Main-photo field for destinations, hotels and tours: shows the current photo
 * and opens the media library to choose or upload another (ADR-0030).
 */
export function HeroPicker({
  value,
  onChange,
  csrfToken,
  readOnly,
}: {
  value: HeroRef | null;
  onChange: (v: HeroRef | null) => void;
  csrfToken: string;
  readOnly?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    dialog.current?.showModal();
    setError(null);
    const { data, error: problem } = await browserApi.GET("/api/v1/admin/media", {
      params: { query: { limit: 60 } },
    });
    if (data) setItems(data.items);
    else setError(problemMessage(problem));
  }

  function choose(m: { key: string; url: string; alt: string }) {
    onChange({ key: m.key, url: m.url, alt: m.alt });
    dialog.current?.close();
  }

  return (
    <div className="grid gap-2">
      <span className="text-[0.84rem] font-semibold">Main photo</span>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative h-[90px] w-[140px] overflow-hidden rounded-[10px] border border-rule bg-paper-2">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- library images are already optimised WebP
            <img src={value.url} alt={value.alt} className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center px-2 text-center text-[0.74rem] text-ink-3">
              No photo yet (a sample is shown on the website)
            </span>
          )}
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={open} className={buttonClass("outline", "sm")}>
              {value ? "Change photo" : "Choose photo"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className={buttonClass("ghost", "sm")}
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>
      <dialog
        ref={dialog}
        aria-label="Choose a photo"
        className="w-[min(920px,calc(100vw-32px))] rounded-card border border-rule bg-card p-0 text-ink backdrop:bg-night/60"
      >
        <div className="grid max-h-[80vh] gap-4 overflow-y-auto p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[1rem] font-semibold">Choose a photo</h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className={buttonClass("ghost", "sm")}
            >
              Close
            </button>
          </div>
          <UploadForm csrfToken={csrfToken} onUploaded={choose} />
          {error && <FormAlert>{error}</FormAlert>}
          {items === null ? (
            <p className="text-[0.86rem] text-ink-2">Loading the library…</p>
          ) : items.length === 0 ? (
            <p className="text-[0.86rem] text-ink-2">
              The library is empty. Upload the first photo above.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {items.map((m) => (
                <li key={m.key}>
                  <button
                    type="button"
                    onClick={() => choose(m)}
                    className={cx(
                      "block w-full overflow-hidden rounded-[10px] border-2 text-left",
                      value?.key === m.key
                        ? "border-primary"
                        : "border-transparent hover:border-ink",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
                    <img src={m.url} alt={m.alt} className="aspect-[4/3] w-full object-cover" />
                    <span className="block truncate px-1 py-1 text-[0.74rem] text-ink-2">
                      {m.alt}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </dialog>
    </div>
  );
}
