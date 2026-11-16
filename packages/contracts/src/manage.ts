import { z } from "zod";

/**
 * One console control for every listing: delete it, or show / hide it on the
 * website. Deleting is refused (409) while bookings, orders or requests still
 * point at the item; hiding is always possible.
 */
export const ManagedKindSchema = z.enum([
  "destination",
  "hotel",
  "room",
  "tour",
  "departure",
  "offer",
  "promotion",
  "page",
  "visa",
  "ad",
  "gift-card-design",
  "contact-message",
]);
export type ManagedKind = z.infer<typeof ManagedKindSchema>;

/** Kinds that can be shown or hidden (the rest can only be deleted). */
export const VISIBILITY_KINDS = [
  "destination",
  "hotel",
  "room",
  "tour",
  "offer",
  "promotion",
  "page",
  "visa",
  "ad",
  "gift-card-design",
] as const satisfies readonly ManagedKind[];

export const SetVisibilitySchema = z.object({ visible: z.boolean() });
export const VisibilityResultSchema = z.object({ visible: z.boolean() });
