"use client";

import { useRef, useState } from "react";
import { FormAlert, TextField, buttonClass, cx } from "@pegah/ui";
import { browserApi, problemMessage } from "@/lib/api-browser";
import { altFromFileName, uploadImage, type MediaItem } from "@/lib/upload-image";

export type HeroRef = { key: string; url: string; alt: string };

type Pending = { id: number; file: File; preview: string; alt: string };

/**
 * Upload form shared by the picker and the media library page: pick photos
 * from the computer or phone (or drop them here), any format the browser can
 * open. Each photo gets a description from its file name, editable before
 * upload; photos are resized and compressed in the browser first.
 */
export function UploadForm({
  csrfToken,
  onUploaded,
  multiple = false,
}: {
  csrfToken: string;
  onUploaded: (m: MediaItem) => void;
  /** Allow several photos in one go (galleries, media library). */
  multiple?: boolean;
}) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [credit, setCredit] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  function add(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErrors([]);
    const list = Array.from(files).filter(
      (f) => !f.type || f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name),
    );
    const chosen = (multiple ? list : list.slice(0, 1)).map((file) => ({
      id: nextId.current++,
      file,
      preview: URL.createObjectURL(file),
      alt: altFromFileName(file.name),
    }));
    setPending((old) => {
      if (!multiple) old.forEach((p) => URL.revokeObjectURL(p.preview));
      return multiple ? [...old, ...chosen].slice(0, 20) : chosen;
    });
    if (input.current) input.current.value = "";
  }

  function drop(id: number) {
    setPending((old) => {
      old.filter((p) => p.id === id).forEach((p) => URL.revokeObjectURL(p.preview));
      return old.filter((p) => p.id !== id);
    });
  }

  async function submit() {
    const failed: string[] = [];
    for (const [i, p] of pending.entries()) {
      setBusy(`Uploading ${i + 1} of ${pending.length}…`);
      try {
        const m = await uploadImage(
          p.file,
          { alt: p.alt.trim().length >= 3 ? p.alt.trim() : "Photo", credit: credit || undefined },
          csrfToken,
        );
        URL.revokeObjectURL(p.preview);
        setPending((old) => old.filter((x) => x.id !== p.id));
        onUploaded(m);
      } catch (e) {
        failed.push(e instanceof Error ? e.message : `"${p.file.name}": upload failed.`);
      }
    }
    setErrors(failed);
    setBusy(null);
  }

  return (
    <div className="grid gap-3 rounded-[14px] border border-dashed border-rule p-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        className={cx(
          "grid cursor-pointer justify-items-center gap-1.5 rounded-[12px] border-2 border-dashed px-4 py-6 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary",
          dragging ? "border-primary bg-primary-soft" : "border-rule hover:border-ink-3",
        )}
      >
        <span className="text-[0.95rem] font-semibold">
          {multiple
            ? "Choose photos from your computer or phone"
            : "Choose a photo from your computer or phone"}
        </span>
        <span className="text-[0.8rem] text-ink-2">
          or drag {multiple ? "them" : "it"} here · JPEG, PNG, WebP, GIF, AVIF, any size
        </span>
        <span className={buttonClass("outline", "sm", "pointer-events-none mt-1")}>Browse…</span>
        <input
          ref={input}
          type="file"
          accept="image/*,.heic,.heif"
          aria-label={multiple ? "Photo files" : "Photo file"}
          multiple={multiple}
          onChange={(e) => add(e.target.files)}
          className="sr-only"
        />
      </label>

      {pending.length > 0 && (
        <ul className="grid gap-3">
          {pending.map((p) => (
            <li key={p.id} className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
              <img
                src={p.preview}
                alt=""
                className="size-16 shrink-0 rounded-[8px] bg-paper-2 object-cover"
              />
              <div className="min-w-0 flex-1">
                <TextField
                  label={`Description: ${p.file.name}`}
                  value={p.alt}
                  maxLength={255}
                  onChange={(e) =>
                    setPending((old) =>
                      old.map((x) => (x.id === p.id ? { ...x, alt: e.target.value } : x)),
                    )
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => drop(p.id)}
                disabled={!!busy}
                className={buttonClass("ghost", "sm", "mt-6")}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {pending.length > 0 && (
        <TextField
          label="Credit (optional: photographer or source)"
          value={credit}
          maxLength={255}
          onChange={(e) => setCredit(e.target.value)}
          hint="Use only photos you own or are licensed to use."
        />
      )}
      {errors.map((m) => (
        <FormAlert key={m}>{m}</FormAlert>
      ))}
      {pending.length > 0 && (
        <button
          type="button"
          disabled={!!busy}
          onClick={submit}
          className={buttonClass("primary", "sm", "justify-self-start")}
        >
          {busy ?? (pending.length > 1 ? `Upload ${pending.length} photos` : "Upload photo")}
        </button>
      )}
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
  label = "Main photo",
  emptyText = "No photo yet (a sample is shown on the website)",
}: {
  value: HeroRef | null;
  onChange: (v: HeroRef | null) => void;
  csrfToken: string;
  readOnly?: boolean;
  label?: string;
  emptyText?: string;
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
      <span className="text-[0.84rem] font-semibold">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative h-[90px] w-[140px] overflow-hidden rounded-[10px] border border-rule bg-paper-2">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- library images are already optimised WebP
            <img src={value.url} alt={value.alt} className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center px-2 text-center text-[0.74rem] text-ink-3">
              {emptyText}
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
