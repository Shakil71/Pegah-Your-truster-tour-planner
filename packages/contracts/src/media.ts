import { z } from "zod";
import { InstantSchema, nullableText } from "./common";

/**
 * Media library (ADR-0030). An image is identified by its `key`: a content
 * hash plus extension, so the same picture uploaded twice is stored once and
 * its URL can be cached forever.
 */
export const MediaKeySchema = z.string().regex(/^[a-f0-9]{24}\.webp$/, "Unknown image");

export const MediaAssetViewSchema = z.object({
  key: MediaKeySchema,
  url: z.string(),
  alt: z.string(),
  credit: nullableText(255),
  license: nullableText(80),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  byteSize: z.number().int().nullable(),
  createdAt: InstantSchema,
  /** Where the image is used as the main photo. */
  usedBy: z.object({
    hotels: z.number().int(),
    tours: z.number().int(),
    destinations: z.number().int(),
  }),
});
export type MediaAssetView = z.infer<typeof MediaAssetViewSchema>;

export const MediaListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(48),
});

export const MediaListSchema = z.object({
  items: z.array(MediaAssetViewSchema),
  nextCursor: nullableText(200),
});

/** Sent as query parameters with the raw image body (image/jpeg, image/png or image/webp). */
export const MediaUploadQuerySchema = z.object({
  alt: z.string().trim().min(3).max(255),
  credit: z.string().trim().max(255).optional(),
  license: z.string().trim().max(80).optional(),
});

export const MediaUpdateSchema = z.object({
  alt: z.string().trim().min(3).max(255),
  credit: z.string().trim().max(255).nullable(),
  license: z.string().trim().max(80).nullable(),
});

export const MediaResultSchema = z.object({ media: MediaAssetViewSchema });

/** Main photo picked for a destination, hotel or tour (admin view). */
export const HeroRefSchema = z.object({ key: MediaKeySchema, url: z.string(), alt: z.string() });
