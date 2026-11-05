import { z } from "zod";
import { DestinationSummarySchema, HotelSummarySchema, TourSummarySchema } from "./catalog";
import { SlugSchema, nullableText } from "./common";
import { MediaKeySchema } from "./media";

/**
 * Home page content edited in the console (ADR-0031). Featured items are
 * chosen from the real catalog by slug; anything unpublished or deleted is
 * skipped when the page is built. Empty lists mean "use the built-in default".
 */
const Line = (max: number) => z.string().trim().max(max);

export const HomeSlideSchema = z.object({
  media: MediaKeySchema,
  placeEn: Line(80).min(2),
  placeBn: Line(80).min(2),
});

export const HomePromiseSchema = z.object({
  titleEn: Line(80).min(3),
  titleBn: Line(80).min(3),
  bodyEn: Line(240).min(10),
  bodyBn: Line(240).min(10),
});

export const HomeSettingsSchema = z.object({
  slides: z.array(HomeSlideSchema).max(6),
  featuredDestinations: z.array(SlugSchema).max(8),
  featuredHotels: z.array(SlugSchema).max(8),
  featuredTours: z.array(SlugSchema).max(6),
  promises: z.array(HomePromiseSchema).max(3),
});
export type HomeSettings = z.infer<typeof HomeSettingsSchema>;

/** What the website renders: featured items resolved from the published catalog. */
export const PublicHomeSchema = z.object({
  slides: z.array(
    z.object({
      url: z.string(),
      alt: z.string(),
      credit: nullableText(255),
      placeEn: z.string(),
      placeBn: z.string(),
    }),
  ),
  destinations: z.array(DestinationSummarySchema),
  hotels: z.array(HotelSummarySchema),
  tours: z.array(TourSummarySchema),
  promises: z.array(HomePromiseSchema),
});
export type PublicHome = z.infer<typeof PublicHomeSchema>;
