import { z } from "zod";
import { InstantSchema, nullableText } from "./common";

/** Data imported from the old Pegah website (ADR-0038), read-only in the console. */
export const LegacyTableSchema = z.object({
  table: z.string(),
  rows: z.number().int(),
  /** Rows that became a hotel, room, tour, offer, customer… in the new system. */
  linked: z.number().int(),
});

export const LegacyTablesSchema = z.object({
  tables: z.array(LegacyTableSchema),
  total: z.number().int(),
});

export const LegacyRecordsQuerySchema = z.object({
  table: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{1,64}$/),
  q: z.string().trim().max(80).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type LegacyRecordsQuery = z.infer<typeof LegacyRecordsQuerySchema>;

export const LegacyRecordSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetType: nullableText(40),
  targetId: nullableText(24),
  /** The original row, every column as text (credentials removed at import). */
  payload: z.record(z.string(), nullableText(100_000)),
  importedAt: InstantSchema,
});

export const LegacyRecordsSchema = z.object({
  items: z.array(LegacyRecordSchema),
  nextCursor: nullableText(200),
});
