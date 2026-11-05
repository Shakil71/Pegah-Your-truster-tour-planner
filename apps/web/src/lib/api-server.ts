import { createPegahClient, type Schemas } from "@pegah/api-client";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

/**
 * Where server components reach the API: directly on the loopback interface,
 * never through the public origin. Production: 127.0.0.1:4100 (systemd).
 */
const API_ORIGIN =
  process.env.API_INTERNAL_URL ??
  (process.env.NODE_ENV === "production" ? "http://127.0.0.1:4100" : "http://127.0.0.1:4000");

/**
 * A per-request API client that forwards the visitor's cookies and real client
 * IP (set by Nginx), so sessions and rate limits apply to the person,
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

export type CustomerSession = Schemas["SessionResponseDto_Output"];

/** The signed-in customer, or null. */
export async function getCustomer(): Promise<CustomerSession | null> {
  const api = await serverApi();
  const { data } = await api.GET("/api/v1/auth/session");
  return data ?? null;
}

/** The signed-in customer, or a redirect to sign-in that comes back to `returnTo`. */
export async function requireCustomer(returnTo: string): Promise<CustomerSession> {
  const session = await getCustomer();
  if (!session) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return session;
}

/** Throws for unexpected API failures so the error boundary shows them. */
export function ensure<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.data !== undefined) return result.data;
  if (result.response.status === 401) redirect("/login");
  if (result.response.status === 404) notFound();
  throw new Error(`API ${result.response.status} for ${new URL(result.response.url).pathname}`);
}

/** The signed-in partner (supplier or agent) user, or null. */
export async function getPartner(): Promise<CustomerSession | null> {
  const api = await serverApi();
  const { data } = await api.GET("/api/v1/partner/auth/session");
  return data?.user.partner ? data : null;
}

/** The signed-in partner, or a redirect to the partner sign-in page. */
export async function requirePartner(kind?: "SUPPLIER" | "AGENT"): Promise<CustomerSession> {
  const session = await getPartner();
  if (!session) redirect("/partner/login");
  if (kind && session.user.partner?.kind !== kind) redirect("/partner");
  return session;
}
