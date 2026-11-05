import type { Schemas } from "@pegah/api-client";

export type MediaItem = Schemas["AdminMediaResultDto_Output"]["media"];

const MAX_EDGE = 2000;
/** Nginx accepts request bodies up to 1 MB; stay safely below. */
const TARGET_BYTES = 950_000;

/**
 * Shrinks a photo in the browser before upload (ADR-0030): at most 2000 px on
 * the long side, WebP (or JPEG where WebP encoding is unavailable), lowering
 * quality until it fits under 1 MB. The server re-encodes and strips metadata
 * again, so this is only about the upload limit and speed.
 */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  for (const quality of [0.86, 0.78, 0.68, 0.55]) {
    const webp = await encode("image/webp", quality);
    const blob = webp && webp.type === "image/webp" ? webp : await encode("image/jpeg", quality);
    if (blob && blob.size <= TARGET_BYTES) return blob;
  }
  throw new Error("This photo is too detailed to fit under 1 MB. Try a smaller image.");
}

/** Uploads one photo to the media library and returns it. */
export async function uploadImage(
  file: File,
  meta: { alt: string; credit?: string; license?: string },
  csrfToken: string,
): Promise<MediaItem> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error("Choose a JPEG, PNG or WebP photo.");
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
