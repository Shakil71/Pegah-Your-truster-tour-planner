import path from "node:path";
import type { NextConfig } from "next";

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
  },
  poweredByHeader: false,
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
  async rewrites() {
    return [
      { source: "/admin", destination: `${adminOrigin}/admin` },
      { source: "/admin/:path*", destination: `${adminOrigin}/admin/:path*` },
      { source: "/api/:path*", destination: `${apiOrigin}/api/:path*` },
    ];
  },
};

export default nextConfig;
