import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Document PDFs read their fonts and the default logo from disk.
  outputFileTracingIncludes: {
    "/api/orders/*/documents/**": [
      "./src/pdf/fonts/*.ttf",
      "./brand/ze-logo-navy.svg",
    ],
  },
  experimental: {
    // forbidden() for role checks (requireRole).
    authInterrupts: true,
    // Logo and signature uploads: 1 MB file plus multipart overhead.
    serverActions: { bodySizeLimit: "2mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
