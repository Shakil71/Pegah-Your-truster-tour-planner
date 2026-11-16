import path from "node:path";
import type { NextConfig } from "next";

/** Local development only: in production Nginx routes /api to the API before Next.js. */
const apiOrigin =
  process.env.API_INTERNAL_URL ??
  (process.env.NODE_ENV === "production" ? "http://127.0.0.1:4100" : "http://127.0.0.1:4000");

const nextConfig: NextConfig = {
  // Served under /admin: the public site proxies /admin/* here (see
  // apps/web/next.config.ts), so the back office needs no nginx change.
  basePath: "/admin",
  transpilePackages: ["@pegah/ui", "@pegah/shared", "@pegah/design-tokens", "@pegah/api-client"],
  images: {
    formats: ["image/avif", "image/webp"],
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
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
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
  async redirects() {
    // Opening the admin port directly ("/") lands on the dashboard.
    return [{ source: "/", destination: "/admin", basePath: false, permanent: false }];
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*`, basePath: false }];
  },
};

export default nextConfig;
