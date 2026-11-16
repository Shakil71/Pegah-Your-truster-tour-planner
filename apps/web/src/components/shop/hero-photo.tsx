import Image, { type StaticImageData } from "next/image";
import { isLibraryImage, isLowRes, sharpWidth } from "@/lib/media";

type Media = { url: string; alt: string; width: number | null; height: number | null };

/**
 * Background photo for the hotel and tour page banners. A large photo fills
 * the banner as before. A small one (old-website imports are often 480 px)
 * would look blurred when stretched to 1280 px, so it becomes a soft,
 * deliberately blurred backdrop, and the photo itself is shown sharp, close
 * to its real size, on the right (tablet and up).
 */
export function HeroPhoto({ media, fallback }: { media: Media | null; fallback: StaticImageData }) {
  if (!media || !isLowRes(media)) {
    const src = media?.url ?? fallback;
    return (
      <Image
        src={src}
        alt={media?.alt ?? ""}
        fill
        priority
        unoptimized={isLibraryImage(src)}
        sizes="(min-width: 1280px) 1280px, 100vw"
        className="object-cover opacity-75"
      />
    );
  }

  const w = sharpWidth(media.width ?? 0);
  return (
    <>
      <Image
        src={media.url}
        alt=""
        aria-hidden
        fill
        priority
        unoptimized
        sizes="100vw"
        className="scale-110 object-cover opacity-60 blur-2xl"
      />
      <div
        className="absolute right-6 top-6 hidden aspect-[4/3] w-[42%] overflow-hidden rounded-[14px] shadow-lift ring-1 ring-white/20 md:right-10 md:top-10 md:block"
        style={{ maxWidth: w }}
      >
        <Image
          src={media.url}
          alt={media.alt}
          fill
          unoptimized
          sizes={`${w}px`}
          className="object-cover"
        />
      </div>
    </>
  );
}
