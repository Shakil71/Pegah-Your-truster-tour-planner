import createClient, { type ClientOptions } from "openapi-fetch";
import type { components, paths } from "./schema";

/**
 * Typed client for the Pegah REST API. Paths, parameters and response bodies
 * come from the generated OpenAPI types, so a contract change that is not
 * reflected here fails the TypeScript build (ADR-0002).
 */
export type { components, paths };
export type Schemas = components["schemas"];

export type PegahClient = ReturnType<typeof createClient<paths>>;

export function createPegahClient(options: ClientOptions & { baseUrl: string }): PegahClient {
  return createClient<paths>(options);
}

/** RFC 9457 problem details returned for every API error. */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  requestId?: string;
  errors?: { path: string; message: string; code: string }[];
}

export function isProblem(value: unknown): value is Problem {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Problem).type === "string" &&
    typeof (value as Problem).status === "number"
  );
}

/** The user-safe message of a problem, with a generic fallback. */
export function problemMessage(
  value: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!isProblem(value)) return fallback;
  return value.detail ?? value.title ?? fallback;
}
