"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Icon, cx } from "@pegah/ui";
import { isLibraryImage, isLowRes, sharpWidth } from "@/lib/media";

export type GalleryPhoto = {
  url: string;
  alt: string;
  credit: string | null;
  width?: number | null;
  height?: number | null;
};

export type ViewerLabels = {
  title: string;
  open: string;
  close: string;
  previous: string;
  next: string;
  /** "Photo {n} of {total}" */
  count: string;
};

/** Open/close state for a PhotoViewer; arrow keys move between photos while open. */
export function usePhotoViewer(count: number) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const d = dialog.current;
    if (!d || count === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % count);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + count) % count);
    };
    d.addEventListener("keydown", onKey);
    return () => d.removeEventListener("keydown", onKey);
  }, [count]);

  const open = useCallback((i: number) => {
    setIndex(i);
    dialog.current?.showModal();
  }, []);

  return { dialog, index, setIndex, open };
}

/**
 * Full-screen photo viewer on a native <dialog> (focus trap, Esc closes,
 * click outside closes). Small photos are shown near their real size over
 * a blurred backdrop so they stay sharp; a thumbnail strip jumps to any photo.
 */
export function PhotoViewer({
  dialog,
  photos,
  index,
  setIndex,
  labels,
}: {
  dialog: RefObject<HTMLDialogElement | null>;
  photos: GalleryPhoto[];
  index: number;
  setIndex: (i: number | ((i: number) => number)) => void;
  labels: ViewerLabels;
}) {
  const photo = photos[index];
  const total = photos.length;

  return (
    <dialog
      ref={dialog}
      aria-label={labels.title}
      className="m-auto max-h-[100dvh] w-[min(1100px,100vw)] max-w-none bg-transparent p-0 backdrop:bg-night/90"
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
    >
      {photo && (
        <figure className="grid gap-3 p-3 text-white">
          <div className="relative grid aspect-[3/2] w-full place-items-center overflow-hidden rounded-[12px] bg-night">
            {isLowRes(photo) ? (
              <>
                <Image
                  src={photo.url}
                  alt=""
                  aria-hidden
                  fill
                  unoptimized
                  sizes="1100px"
                  className="scale-110 object-cover opacity-50 blur-2xl"
                />
                <div
                  className="relative h-full w-full"
                  style={{
                    maxWidth: sharpWidth(photo.width ?? 0),
                    maxHeight: sharpWidth(photo.height ?? photo.width ?? 0),
                  }}
                >
                  <Image
                    src={photo.url}
                    alt={photo.alt}
                    fill
                    unoptimized
                    sizes={`${sharpWidth(photo.width ?? 0)}px`}
                    className="object-contain"
                  />
                </div>
              </>
            ) : (
              <Image
                src={photo.url}
                alt={photo.alt}
                fill
                unoptimized={isLibraryImage(photo.url)}
                sizes="1100px"
                className="object-contain"
              />
            )}
            {total > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setIndex((i) => (i - 1 + total) % total)}
                  className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-night/60 hover:bg-night/80"
                  aria-label={labels.previous}
                >
                  <Icon name="arrowLeft" className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIndex((i) => (i + 1) % total)}
                  className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-night/60 hover:bg-night/80"
                  aria-label={labels.next}
                >
                  <Icon name="arrowRight" className="size-5" />
                </button>
              </>
            )}
          </div>

          <figcaption className="flex flex-wrap items-center justify-between gap-3 text-[0.86rem]">
            <span>
              {labels.count.replace("{n}", String(index + 1)).replace("{total}", String(total))}
              {photo.credit && <span className="ml-2 text-white/70">· {photo.credit}</span>}
            </span>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="grid size-10 place-items-center rounded-full bg-white/15 hover:bg-white/25"
              aria-label={labels.close}
            >
              <Icon name="x" className="size-5" />
            </button>
          </figcaption>

          {total > 1 && (
            <ul className="flex gap-2 overflow-x-auto pb-1">
              {photos.map((p, i) => (
                <li key={p.url} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`${labels.open}: ${p.alt}`}
                    aria-current={i === index ? "true" : undefined}
                    className={cx(
                      "relative block h-14 w-20 overflow-hidden rounded-[8px] ring-2 transition",
                      i === index
                        ? "ring-primary"
                        : "opacity-60 ring-transparent hover:opacity-100",
                    )}
                  >
                    <Image
                      src={p.url}
                      alt=""
                      fill
                      unoptimized={isLibraryImage(p.url)}
                      sizes="80px"
                      className="object-cover"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </figure>
      )}
    </dialog>
  );
}
