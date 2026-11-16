"use client";

import Image, { type StaticImageData } from "next/image";
import { Icon, cx } from "@pegah/ui";
import { isLibraryImage } from "@/lib/media";
import { PhotoViewer, usePhotoViewer, type GalleryPhoto, type ViewerLabels } from "./photo-viewer";

/**
 * Tour banner photos: one large photo and up to two beside it (stacked under
 * it on phones). Any photo opens the full-screen viewer. Old-website photos
 * are often 480 px wide, so the tiles stay close to that size rather than
 * stretching a photo across the whole banner.
 */
export function TourPhotos({
  photos,
  fallback,
  labels,
  countLabel,
}: {
  photos: GalleryPhoto[];
  fallback: StaticImageData;
  labels: ViewerLabels;
  /** "{count} photos", already formatted. */
  countLabel: string;
}) {
  const viewer = usePhotoViewer(photos.length);
  const [cover, ...rest] = photos;

  if (!cover) {
    return (
      <div className="relative aspect-[4/3] overflow-hidden rounded-[14px] lg:aspect-auto lg:h-full">
        <Image
          src={fallback}
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 640px, 100vw"
          className="object-cover"
        />
      </div>
    );
  }

  const side = rest.slice(0, 2);
  const tile = (p: GalleryPhoto, i: number, className: string, sizes: string, last?: boolean) => (
    <button
      key={p.url}
      type="button"
      onClick={() => viewer.open(i)}
      aria-label={`${labels.open}: ${p.alt}`}
      className={cx(
        "group relative block overflow-hidden rounded-[14px] bg-night-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className,
      )}
    >
      <Image
        src={p.url}
        alt=""
        fill
        priority={i === 0}
        unoptimized={isLibraryImage(p.url)}
        sizes={sizes}
        className="object-cover transition duration-500 group-hover:scale-[1.04]"
      />
      {last && (
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-night/80 px-3 py-1.5 text-[0.78rem] font-semibold text-white backdrop-blur">
          <Icon name="view" className="size-4" />
          {countLabel}
        </span>
      )}
    </button>
  );

  return (
    <>
      <div
        className={cx(
          "grid h-full gap-2",
          side.length > 0 && "grid-cols-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]",
        )}
      >
        {tile(
          cover,
          0,
          cx(
            "aspect-[4/3] sm:aspect-auto sm:min-h-[300px]",
            side.length > 0 ? "col-span-2 sm:col-span-1 sm:row-span-2" : "",
          ),
          "(min-width: 1024px) 480px, (min-width: 640px) 66vw, 100vw",
          side.length === 0 && photos.length > 1,
        )}
        {side.map((p, k) =>
          tile(
            p,
            k + 1,
            // A single side photo fills the column beside the cover.
            side.length === 1
              ? "col-span-2 aspect-[16/9] sm:col-span-1 sm:row-span-2 sm:aspect-auto"
              : "aspect-[4/3] sm:aspect-auto",
            "(min-width: 1024px) 240px, (min-width: 640px) 33vw, 50vw",
            k === side.length - 1 && photos.length > 1,
          ),
        )}
      </div>
      <PhotoViewer
        dialog={viewer.dialog}
        photos={photos}
        index={viewer.index}
        setIndex={viewer.setIndex}
        labels={labels}
      />
    </>
  );
}
