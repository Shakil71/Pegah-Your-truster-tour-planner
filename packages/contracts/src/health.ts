import { z } from "zod";
import { nullableText } from "./common";

export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "down"]),
  checks: z.record(z.string(), z.enum(["up", "down"])),
  version: z.string(),
  /** Deployed git commit (null for local builds). */
  commit: nullableText(),
  builtAt: nullableText(),
  time: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
