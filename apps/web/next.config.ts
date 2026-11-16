import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/** Language from a cookie, messages per request (ADR-0028). */
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Where the admin app listens. The public site proxies /admin/* to it, so the
 * back office is reachable on the same origin without an nginx change.
 * Production: 127.0.0.1:3101 (systemd); local dev: 127.0.0.1:3001.
 */
const adminOrigin =
  process.env.ADMIN_INTERNAL_URL ??
  (process.env.NODE_ENV === "production" ? "http://127.0.0.1:3101" : "http://127.0.0.1:3001");

/** Local development only: in production Nginx routes /api to the API before Next.js. */
const apiOrigin =
  process.env.API_INTERNAL_URL ??
  (process.env.NODE_ENV === "production" ? "http://127.0.0.1:4100" : "http://127.0.0.1:4000");

const nextConfig: NextConfig = {
  transpilePackages: ["@pegah/ui", "@pegah/shared", "@pegah/design-tokens", "@pegah/api-client"],
  images: {
    formats: ["image/avif", "image/webp"],
    // Photos are the product: encode at 90 rather than the default 75 so
    // banners and cards stay crisp (Next.js uses the closest allowed value).
    qualities: [90],
  },
  poweredByHeader: false,
  // Security headers on every page (ADR-0015). The full script CSP stays
  // with Nginx/the API; here: no framing (clickjacking), no MIME sniffing,
  // a strict referrer, HTTPS only, and no camera/microphone/location use.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
  // Self-contained server bundle for hosts without a build step (cPanel, ADR-0040).
  ...(process.env.NEXT_OUTPUT === "standalone"
    ? { output: "standalone" as const, outputFileTracingRoot: path.join(__dirname, "../..") }
    : {}),
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
  async rewrites() {
    return [
      { source: "/admin", destination: `${adminOrigin}/admin` },
      { source: "/admin/:path*", destination: `${adminOrigin}/admin/:path*` },
      { source: "/api/:path*", destination: `${apiOrigin}/api/:path*` },
      // Media library images (ADR-0030), served by the API with immutable caching.
      { source: "/media/:path*", destination: `${apiOrigin}/api/v1/media/:path*` },
    ];
  },
};

export default withNextIntl(nextConfig);
