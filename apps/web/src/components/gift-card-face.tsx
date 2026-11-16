import Image, { type StaticImageData } from "next/image";
import { cx } from "@pegah/ui";
import { isLibraryImage } from "@/lib/media";

/**
 * A gift card drawn like the real thing (credit-card proportions): the
 * design's photo full-bleed under a warm brand wash, the "Gift card" label
 * and Pegah wordmark, the amount, a chip, the masked code and the place.
 * Shared by the hero and the "choose a card" list on /gift-cards.
 */
export function GiftCardFace({
  image,
  alt = "",
  focus = "50% 50%",
  amountTaka,
  label,
  cardLabel,
  sizes,
  priority = false,
  className,
}: {
  image: string | StaticImageData;
  alt?: string;
  focus?: string;
  amountTaka?: number;
  /** Place on the card, e.g. "Cox's Bazar". */
  label?: string;
  /** "Gift card" in the page language. */
  cardLabel: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "@container relative isolate aspect-[1.586/1] w-full overflow-hidden rounded-[18px] bg-night text-white shadow-lift ring-1 ring-white/15 sm:rounded-[22px]",
        className,
      )}
    >
      <Image
        src={image}
        alt={alt}
        fill
        priority={priority}
        unoptimized={isLibraryImage(image)}
        placeholder={typeof image === "string" ? "empty" : "blur"}
        sizes={sizes}
        style={{ objectPosition: focus }}
        className="-z-10 object-cover transition-transform duration-700 group-hover:scale-[1.06]"
      />
      {/* Brand wash from the top-left corner, darker at the foot for the code. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--pg-primary)_55%,transparent)_0%,color-mix(in_srgb,var(--pg-primary)_18%,transparent)_38%,transparent_60%),linear-gradient(180deg,transparent_45%,rgb(9_12_34/0.78))]"
      />
      {/* Soft sheen, as on a printed card. */}
      <div
        aria-hidden
        className="absolute -inset-x-1/2 -top-1/2 -z-10 h-full rotate-12 bg-[linear-gradient(180deg,rgb(255_255_255/0.18),transparent)] opacity-70 transition-transform duration-700 group-hover:translate-y-6"
      />

      <div className="flex h-full flex-col justify-between p-[6%]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="block text-[3cqw] font-bold uppercase tracking-[0.2em] text-fixed-ink/85">
              {cardLabel}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element -- brand wordmark */}
            <img
              src="/brand/pegah-logo.webp"
              alt=""
              className="mt-[1.2cqw] h-[10.5cqw] w-auto drop-shadow-[0_1px_3px_rgb(9_12_34/0.7)]"
            />
          </div>
          {amountTaka !== undefined && (
            <span className="tabular rounded-full bg-primary px-[0.8em] py-[0.25em] font-display text-[5.4cqw] font-medium text-on-primary shadow-lift">
              ৳{amountTaka.toLocaleString("en-IN")}
            </span>
          )}
        </div>

        <div className="grid gap-[2.4cqw]">
          <div className="flex items-center justify-between gap-[3cqw]">
            {/* The chip. */}
            <span
              aria-hidden
              className="block h-[6.5cqw] w-[9cqw] shrink-0 rounded-[1.4cqw] bg-[linear-gradient(135deg,rgb(255_236_200),rgb(214_170_92)_55%,rgb(255_226_170))] shadow-[inset_0_0_0_1px_rgb(120_80_20/0.35)]"
            />
            {label && (
              <span className="min-w-0 truncate text-right text-[2.8cqw] font-bold uppercase tracking-[0.16em] text-white/90 drop-shadow">
                {label}
              </span>
            )}
          </div>
          <span className="whitespace-nowrap font-mono text-[4.6cqw] tracking-[0.14em] drop-shadow">
            XXXX-XXXX-XXXX-XXXX
          </span>
        </div>
      </div>
    </div>
  );
}
