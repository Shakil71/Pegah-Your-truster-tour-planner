import type { Schemas } from "@pegah/api-client";

export type MediaItem = Schemas["AdminMediaResultDto_Output"]["media"];

const MAX_EDGE = 2000;
/** Nginx accepts request bodies up to 1 MB; stay safely below. */
const TARGET_BYTES = 950_000;

/** HEIC/HEIF (iPhone) photos only decode in Safari; say how to convert them elsewhere. */
const HEIC = /\.(heic|heif)$/i;

/**
 * Prepares any photo the browser can open (JPEG, PNG, WebP, GIF, BMP, AVIF,
 * and HEIC in Safari) for upload (ADR-0030): at most 2000 px on the long
 * side, WebP (or JPEG where WebP encoding is unavailable). Quality steps down
 * until it fits under 1 MB, and very detailed photos are scaled a little
 * smaller instead of being refused. The server re-encodes and strips metadata
 * again, so this is only about the upload limit and speed.
 */
async function shrink(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      HEIC.test(file.name) || /hei[cf]/i.test(file.type)
        ? `"${file.name}" is an iPhone HEIC photo, which this browser cannot open. Open it in Photos and save or export it as JPEG, then upload that.`
        : `"${file.name}" could not be opened as a photo. Use a JPEG, PNG, WebP, GIF or AVIF image.`,
    );
  }
  const encode = (canvas: HTMLCanvasElement, type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  try {
    for (const edge of [MAX_EDGE, 1600, 1280]) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d")!;
      // Transparent PNG/GIF areas become white rather than black in JPEG.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.9, 0.84, 0.76, 0.66]) {
        const webp = await encode(canvas, "image/webp", quality);
        const blob =
          webp && webp.type === "image/webp" ? webp : await encode(canvas, "image/jpeg", quality);
        if (blob && blob.size <= TARGET_BYTES) return blob;
      }
    }
  } finally {
    bitmap.close();
  }
  throw new Error(`"${file.name}" could not be made small enough to upload. Try another photo.`);
}

/** A readable default description from a file name: "coxs-bazar_sunset.jpg" → "Coxs bazar sunset". */
export function altFromFileName(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\b(img|dsc|pxl|photo|image)\s*\d+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  // Nothing left but numbers (camera names like IMG_2026_1234): use a plain word.
  if (base.length < 3 || !/\p{L}/u.test(base)) return "Photo";
  return (base.charAt(0).toUpperCase() + base.slice(1)).slice(0, 255);
}

/** Uploads one photo to the media library and returns it. */
export async function uploadImage(
  file: File,
  meta: { alt: string; credit?: string; license?: string },
  csrfToken: string,
): Promise<MediaItem> {
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error(`"${file.name}" is not a photo.`);
  }
  const blob = await shrink(file);
  const q = new URLSearchParams({ alt: meta.alt });
  if (meta.credit) q.set("credit", meta.credit);
  if (meta.license) q.set("license", meta.license);
  const res = await fetch(`/api/v1/admin/media?${q}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": blob.type, "x-csrf-token": csrfToken },
    body: blob,
  });
  const json = (await res.json().catch(() => null)) as {
    media?: MediaItem;
    detail?: string;
    title?: string;
  } | null;
  if (!res.ok || !json?.media) {
    throw new Error(json?.detail ?? json?.title ?? "Upload failed. Please try again.");
  }
  return json.media;
}
