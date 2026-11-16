import type { StaticImageData } from "next/image";

/**
 * Media library images (`/media/…`, ADR-0030) are stored as compressed WebP
 * already; letting Next.js re-encode them only loses detail. Static imports
 * (StaticImageData) still go through the optimiser.
 */
export function isLibraryImage(src: string | StaticImageData): src is string {
  return typeof src === "string" && src.startsWith("/media/");
}

/**
 * Many photos imported from the old website are 300–480 px wide (ADR-0038).
 * Stretched across a wide banner they look blurred, so callers show them at
 * close to their real size instead.
 */
export const LOW_RES_WIDTH = 1000;

export function isLowRes(media: { width?: number | null } | null | undefined): boolean {
  return !!media?.width && media.width < LOW_RES_WIDTH;
}

/** Largest on-screen width (px) at which a photo still looks sharp. */
export function sharpWidth(width: number): number {
  return Math.round(width * 1.5);
}
