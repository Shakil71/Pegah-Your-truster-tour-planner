"use client";

import Image from "next/image";
import { Icon } from "@pegah/ui";
import { isLibraryImage } from "@/lib/media";
import { PhotoViewer, usePhotoViewer, type GalleryPhoto, type ViewerLabels } from "./photo-viewer";

/** Thumbnails shown under the main room photo; the last one says "+N" if there are more. */
const THUMBS = 3;

/**
 * A room's main photo with its other photos as thumbnails underneath.
 * Any photo opens the full-screen viewer at that photo.
 */
export function RoomPhotos({
  photos,
  labels,
  countLabel,
}: {
  photos: GalleryPhoto[];
  labels: ViewerLabels;
  /** "{count} photos", already formatted. */
  countLabel: string;
}) {
  const viewer = usePhotoViewer(photos.length);
  const [cover, ...others] = photos;
  if (!cover) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-[12px] bg-paper-2 text-ink-3">
        <Icon name="bed" className="size-9" />
      </div>
    );
  }
  const thumbs = others.slice(0, THUMBS);
  const hidden = others.length - thumbs.length;

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => viewer.open(0)}
        aria-label={`${labels.open}: ${cover.alt}`}
        className="group relative block aspect-[4/3] overflow-hidden rounded-[12px] bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Image
          src={cover.url}
          alt=""
          fill
          unoptimized={isLibraryImage(cover.url)}
          sizes="(min-width: 1024px) 240px, (min-width: 640px) 200px, 100vw"
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        {photos.length > 1 && (
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-night/75 px-2.5 py-1 text-[0.72rem] font-semibold text-white backdrop-blur">
            <Icon name="view" className="size-3.5" />
            {countLabel}
          </span>
        )}
      </button>

      {thumbs.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {thumbs.map((p, i) => {
            const last = i === thumbs.length - 1 && hidden > 0;
            return (
              <li key={p.url}>
                <button
                  type="button"
                  onClick={() => viewer.open(i + 1)}
                  aria-label={`${labels.open}: ${p.alt}`}
                  className="relative block aspect-[4/3] w-full overflow-hidden rounded-[8px] bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Image
                    src={p.url}
                    alt=""
                    fill
                    unoptimized={isLibraryImage(p.url)}
                    sizes="(min-width: 640px) 80px, 33vw"
                    className="object-cover transition duration-300 hover:scale-[1.05]"
                  />
                  {last && (
                    <span className="absolute inset-0 grid place-items-center bg-night/60 text-[0.9rem] font-semibold text-white">
                      +{hidden}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <PhotoViewer
        dialog={viewer.dialog}
        photos={photos}
        index={viewer.index}
        setIndex={viewer.setIndex}
        labels={labels}
      />
    </div>
  );
}
