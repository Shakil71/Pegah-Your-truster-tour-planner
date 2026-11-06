import type { HotelSummary } from "@pegah/contracts";
import type { Destination, Hotel, MediaAsset } from "@pegah/db";

export type MediaLike = Pick<MediaAsset, "storageKey" | "altText" | "credit" | "width" | "height">;

export function toMedia(m: MediaLike | null | undefined, mediaBaseUrl: string) {
  if (!m) return null;
  return {
    url: `${mediaBaseUrl.replace(/\/$/, "")}/${m.storageKey}`,
    alt: m.altText,
    credit: m.credit,
    width: m.width,
    height: m.height,
  };
}

export function toHotelSummary(
  h: Hotel & { destination: Pick<Destination, "slug" | "name">; hero: MediaLike | null },
  mediaBaseUrl: string,
): HotelSummary {
  return {
    id: h.publicId,
    slug: h.slug,
    name: h.name,
    nameBn: h.nameBn,
    destination: { slug: h.destination.slug, name: h.destination.name },
    starRating: h.starRating,
    summary: h.summary,
    hero: toMedia(h.hero, mediaBaseUrl),
  };
}

type AmenityRow = {
  slug: string;
  name: string;
  groupName: string | null;
  sortOrder: number;
  icon: MediaLike | null;
};

/** Amenities in a stable order: group, then sort order, then name. */
export function toAmenities(rows: Array<{ amenity: AmenityRow }>, mediaBaseUrl: string) {
  return rows
    .map((r) => r.amenity)
    .sort(
      (a, b) =>
        (a.groupName ?? "~").localeCompare(b.groupName ?? "~") ||
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name),
    )
    .map((a) => ({
      slug: a.slug,
      name: a.name,
      group: a.groupName,
      icon: toMedia(a.icon, mediaBaseUrl),
    }));
}

export function toGallery(rows: Array<{ media: MediaLike }>, mediaBaseUrl: string) {
  return rows.map((r) => toMedia(r.media, mediaBaseUrl)!);
}

/** Tour highlight/include lists are stored as JSON arrays of strings. */
export function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}
