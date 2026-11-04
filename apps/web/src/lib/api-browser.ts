"use client";

import { createPegahClient, problemMessage } from "@pegah/api-client";

/**
 * Browser-side client. Same origin: Nginx (or the dev rewrite) routes /api to
 * the API, so the HttpOnly session cookie is sent and never readable here.
 */
export const browserApi = createPegahClient({ baseUrl: "", credentials: "same-origin" });

export { problemMessage };

/** Header set for cookie-authenticated mutations (ADR-0015). */
export function csrf(token: string) {
  return { "x-csrf-token": token };
}
