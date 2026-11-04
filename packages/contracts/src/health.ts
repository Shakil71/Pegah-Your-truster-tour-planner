import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "down"]),
  checks: z.record(z.string(), z.enum(["up", "down"])),
  version: z.string(),
  /** Deployed git commit (null for local builds). */
  commit: z.string().nullable(),
  builtAt: z.string().nullable(),
  time: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
