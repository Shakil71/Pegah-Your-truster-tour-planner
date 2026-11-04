import { z } from "zod";

/** ISO 4217 currencies the platform accepts. BDT is the default (ADR-0004). */
export const CurrencySchema = z.enum(["BDT", "USD"]);
export type Currency = z.infer<typeof CurrencySchema>;

/**
 * Money is always an integer count of minor units (paisa for BDT) plus a
 * currency. Floating-point amounts are rejected at the contract boundary.
 */
export const MoneySchema = z
  .object({
    amountMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    currency: CurrencySchema,
  })
  .meta({ id: "Money" });
export type Money = z.infer<typeof MoneySchema>;

/**
 * Nullable free text. Always use this instead of a bare `nullableText()`:
 * the explicit bound makes the JSON Schema an `anyOf`, which the OpenAPI
 * generator handles correctly (a bare one is emitted as `type: [string, null]`
 * and mis-read as an array, corrupting the generated client types).
 */
export const nullableText = (max = 10_000) => z.string().max(max).nullable();

/** Public identifiers are ULIDs (26 Crockford base32 characters). */
export const PublicIdSchema = z
  .string()
  .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, "Must be a 26-character ULID");

export const SlugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Must be lowercase words separated by hyphens");

/** A calendar date (no time, no zone), interpreted in Asia/Dhaka. */
export const CalendarDateSchema = z.iso.date();

/** An instant, serialised as ISO 8601 UTC. */
export const InstantSchema = z.iso.datetime({ offset: false });

export const PaginationQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export function paginated<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: nullableText(),
  });
}

/** RFC 9457 problem details, used for every error response. */
export const ProblemSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string().optional(),
    instance: z.string().optional(),
    requestId: z.string().optional(),
    errors: z
      .array(
        z.object({
          path: z.string(),
          message: z.string(),
          code: z.string(),
        }),
      )
      .optional(),
  })
  .meta({ id: "Problem" });
export type Problem = z.infer<typeof ProblemSchema>;
