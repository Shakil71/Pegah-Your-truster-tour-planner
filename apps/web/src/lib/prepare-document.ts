"use client";

/** Photos above this size are re-encoded in the browser before upload. */
const SHRINK_ABOVE = 900 * 1024;
const MAX_EDGE = 2400;

/**
 * Returns the bytes to upload. Large JPEG/PNG photos of documents are scaled
 * to at most 2400 px and saved as JPEG so they upload quickly; PDFs are sent
 * unchanged (the server accepts up to 5 MB and checks the file type itself).
 */
export async function prepareDocument(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png)$/.test(file.type) || file.size <= SHRINK_ABOVE) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  return blob && blob.size < file.size ? blob : file;
}
