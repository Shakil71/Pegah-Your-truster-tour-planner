/**
 * A same-site path to send someone to after signing in, or `fallback`.
 * Refuses anything a browser could read as another site: "//evil.com",
 * "/\evil.com" (browsers treat "\" as "/"), "http://…", and control
 * characters or whitespace that browsers strip before parsing.
 */
export function safeRedirectPath(next: string | null | undefined, fallback: string): string {
  if (!next || next.length > 2000) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  // eslint-disable-next-line no-control-regex -- control characters are exactly what we refuse
  if (/[\\\u0000-\u001f\u007f\s]/.test(next)) return fallback;
  try {
    const base = "https://pegah.invalid";
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
