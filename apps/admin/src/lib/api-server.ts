import { createPegahClient, type Schemas } from "@pegah/api-client";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Where server components reach the API: directly on the loopback interface,
 * never through the public origin. Production: 127.0.0.1:4100 (systemd).
 */
const API_ORIGIN =
  process.env.API_INTERNAL_URL ??
  (process.env.NODE_ENV === "production" ? "http://127.0.0.1:4100" : "http://127.0.0.1:4000");

/**
 * A per-request API client that forwards the staff's cookies and real client
 * IP (set by Nginx), so authorization and rate limits apply to the person,
 * not to this server. Responses are never cached.
 */
export async function serverApi() {
  const [cookieStore, h] = await Promise.all([cookies(), headers()]);
  const forwarded = h.get("x-forwarded-for");
  return createPegahClient({
    baseUrl: API_ORIGIN,
    cache: "no-store",
    headers: {
      cookie: cookieStore.toString(),
      ...(forwarded ? { "x-forwarded-for": forwarded } : {}),
    },
  });
}

export type StaffSession = Schemas["SessionResponseDto_Output"];

/** The signed-in staff session, or a redirect to the login screen. */
export async function requireStaff(): Promise<StaffSession> {
  const api = await serverApi();
  const { data, response } = await api.GET("/api/v1/staff/auth/session");
  if (response.status === 401 || !data) redirect("/login");
  return data;
}

/** Throws for unexpected API failures so the error boundary shows them. */
export function ensure<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.data !== undefined) return result.data;
  if (result.response.status === 401) redirect("/login");
  throw new Error(`API ${result.response.status} for ${new URL(result.response.url).pathname}`);
}
