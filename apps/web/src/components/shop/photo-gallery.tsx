"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@pegah/ui";

export type GalleryPhoto = { url: string; alt: string; credit: string | null };

/**
 * Photo strip with a full-screen viewer (native <dialog>: focus trap, Esc to
 * close). Arrow keys move between photos.
 */
export function PhotoGallery({
  photos,
  labels,
}: {
  photos: GalleryPhoto[];
  labels: {
    title: string;
    open: string;
    close: string;
    previous: string;
    next: string;
    count: string;
  };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const photo = photos[index];

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % photos.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + photos.length) % photos.length);
    };
    d.addEventListener("keydown", onKey);
    return () => d.removeEventListener("keydown", onKey);
  }, [photos.length]);

  if (photos.length === 0) return null;
  const open = (i: number) => {
    setIndex(i);
    dialog.current?.showModal();
  };

  return (
    <section aria-label={labels.title}>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {photos.slice(0, 12).map((p, i) => (
          <li key={p.url} className={i === 0 ? "col-span-2 row-span-2" : undefined}>
            <button
              type="button"
              onClick={() => open(i)}
              className="relative block aspect-[4/3] size-full overflow-hidden rounded-[10px] bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label={`${labels.open}: ${p.alt}`}
            >
              <Image
                src={p.url}
                alt=""
                fill
                sizes={
                  i === 0 ? "(min-width: 1024px) 420px, 66vw" : "(min-width: 1024px) 210px, 33vw"
                }
                className="object-cover transition duration-300 hover:scale-[1.03]"
              />
              {i === 11 && photos.length > 12 && (
                <span className="absolute inset-0 grid place-items-center bg-night/60 text-[1rem] font-semibold text-white">
                  +{photos.length - 12}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        aria-label={labels.title}
        className="m-auto max-h-[100dvh] w-[min(1100px,100vw)] max-w-none bg-transparent p-0 backdrop:bg-night/90"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        {photo && (
          <figure className="grid gap-3 p-3 text-white">
            <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[12px] bg-night">
              <Image
                src={photo.url}
                alt={photo.alt}
                fill
                sizes="1100px"
                className="object-contain"
              />
            </div>
            <figcaption className="flex flex-wrap items-center justify-between gap-3 text-[0.86rem]">
              <span>
                {labels.count
                  .replace("{n}", String(index + 1))
                  .replace("{total}", String(photos.length))}
                {photo.credit && <span className="ml-2 text-white/70">· {photo.credit}</span>}
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}
                  className="grid size-10 place-items-center rounded-full bg-white/15 hover:bg-white/25"
                  aria-label={labels.previous}
                >
                  <Icon name="arrowLeft" className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIndex((i) => (i + 1) % photos.length)}
                  className="grid size-10 place-items-center rounded-full bg-white/15 hover:bg-white/25"
                  aria-label={labels.next}
                >
                  <Icon name="arrowRight" className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => dialog.current?.close()}
                  className="grid size-10 place-items-center rounded-full bg-white/15 hover:bg-white/25"
                  aria-label={labels.close}
                >
                  <Icon name="x" className="size-5" />
                </button>
              </span>
            </figcaption>
          </figure>
        )}
      </dialog>
    </section>
  );
}
