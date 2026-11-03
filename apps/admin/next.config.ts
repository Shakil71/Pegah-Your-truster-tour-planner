import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pegah/ui", "@pegah/shared", "@pegah/design-tokens"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
  poweredByHeader: false,
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
