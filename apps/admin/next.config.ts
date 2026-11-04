import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Served under /admin: the public site proxies /admin/* here (see
  // apps/web/next.config.ts), so the back office needs no nginx change.
  basePath: "/admin",
  transpilePackages: ["@pegah/ui", "@pegah/shared", "@pegah/design-tokens"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
  poweredByHeader: false,
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
  async redirects() {
    // Opening the admin port directly ("/") lands on the dashboard.
    return [{ source: "/", destination: "/admin", basePath: false, permanent: false }];
  },
};

export default nextConfig;
