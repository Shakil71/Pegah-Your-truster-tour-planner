"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert, TextField, buttonClass } from "@pegah/ui";
import { UploadForm } from "@/components/media-picker";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import type { MediaItem } from "@/lib/upload-image";

function kb(bytes: number | null) {
  return bytes === null ? "" : `${Math.round(bytes / 1024)} KB`;
}

function MediaCard({
  item,
  canManage,
  csrfToken,
}: {
  item: MediaItem;
  canManage: boolean;
  csrfToken: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [alt, setAlt] = useState(item.alt);
  const [credit, setCredit] = useState(item.credit ?? "");
  const [license, setLicense] = useState(item.license ?? "");
  const [error, setError] = useState<string | null>(null);
  const uses = item.usedBy.hotels + item.usedBy.tours + item.usedBy.destinations;

  async function save() {
    setError(null);
    const { error: problem, response } = await browserApi.PUT("/api/v1/admin/media/{key}", {
      params: { path: { key: item.key } },
      headers: csrf(csrfToken),
      body: { alt, credit: credit || null, license: license || null },
    });
    if (!response.ok) {
      setError(problemMessage(problem));
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("Delete this photo from the library?")) return;
    setError(null);
    const { error: problem, response } = await browserApi.DELETE("/api/v1/admin/media/{key}", {
      params: { path: { key: item.key } },
      headers: csrf(csrfToken),
    });
    if (!response.ok) {
      setError(problemMessage(problem));
      return;
    }
    router.refresh();
  }

  return (
    <li className="panel overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element -- already optimised WebP from the library */}
      <img src={item.url} alt={item.alt} className="aspect-[4/3] w-full object-cover" />
      <div className="grid gap-2 p-3 text-[0.82rem]">
        {editing ? (
          <>
            <TextField label="Description" value={alt} onChange={(e) => setAlt(e.target.value)} />
            <TextField label="Credit" value={credit} onChange={(e) => setCredit(e.target.value)} />
            <TextField
              label="Licence"
              value={license}
              onChange={(e) => setLicense(e.target.value)}
            />
            <div className="flex gap-2">
              <button type="button" onClick={save} className={buttonClass("primary", "sm")}>
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className={buttonClass("ghost", "sm")}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="font-semibold">{item.alt}</p>
            <p className="text-ink-3">
              {item.width}×{item.height} · {kb(item.byteSize)}
              {item.credit ? ` · ${item.credit}` : ""}
            </p>
            <p className="text-ink-2">
              {uses === 0
                ? "Not used yet"
                : `Main photo of ${[
                    item.usedBy.hotels && `${item.usedBy.hotels} hotel(s)`,
                    item.usedBy.tours && `${item.usedBy.tours} tour(s)`,
                    item.usedBy.destinations && `${item.usedBy.destinations} destination(s)`,
                  ]
                    .filter(Boolean)
                    .join(", ")}`}
            </p>
            {canManage && (
              <div className="flex gap-3 font-semibold">
                <button type="button" onClick={() => setEditing(true)} className="text-primary-ink">
                  Edit
                </button>
                <button
                  type="button"
                  onClick={remove}
                  disabled={uses > 0}
                  title={uses > 0 ? "Choose another photo where it is used first" : undefined}
                  className="text-critical disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            )}
          </>
        )}
        {error && <FormAlert>{error}</FormAlert>}
      </div>
    </li>
  );
}

export function MediaLibrary({
  items,
  canManage,
  csrfToken,
}: {
  items: MediaItem[];
  canManage: boolean;
  csrfToken: string;
}) {
  const router = useRouter();
  return (
    <div className="grid gap-6">
      {canManage && (
        <section className="panel p-5 md:p-6" aria-labelledby="upload-h">
          <h2 id="upload-h" className="mb-3 text-[0.95rem] font-semibold">
            Upload a photo
          </h2>
          <UploadForm csrfToken={csrfToken} onUploaded={() => router.refresh()} />
        </section>
      )}
      {items.length === 0 ? (
        <p className="panel p-8 text-center text-ink-2">No photos yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((m) => (
            <MediaCard key={m.key} item={m} canManage={canManage} csrfToken={csrfToken} />
          ))}
        </ul>
      )}
    </div>
  );
}
