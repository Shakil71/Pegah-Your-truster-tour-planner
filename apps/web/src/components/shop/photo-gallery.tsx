"use client";

import Image from "next/image";
import { isLibraryImage } from "@/lib/media";
import { PhotoViewer, usePhotoViewer, type GalleryPhoto, type ViewerLabels } from "./photo-viewer";

export type { GalleryPhoto } from "./photo-viewer";

/** Hotel or tour photo strip; any photo opens the full-screen viewer. */
export function PhotoGallery({ photos, labels }: { photos: GalleryPhoto[]; labels: ViewerLabels }) {
  const viewer = usePhotoViewer(photos.length);
  if (photos.length === 0) return null;

  return (
    <section aria-label={labels.title}>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {photos.slice(0, 12).map((p, i) => (
          <li key={p.url} className={i === 0 ? "col-span-2 row-span-2" : undefined}>
            <button
              type="button"
              onClick={() => viewer.open(i)}
              className="relative block aspect-[4/3] size-full overflow-hidden rounded-[10px] bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label={`${labels.open}: ${p.alt}`}
            >
              <Image
                src={p.url}
                alt=""
                fill
                unoptimized={isLibraryImage(p.url)}
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
      <PhotoViewer
        dialog={viewer.dialog}
        photos={photos}
        index={viewer.index}
        setIndex={viewer.setIndex}
        labels={labels}
      />
    </section>
  );
}
