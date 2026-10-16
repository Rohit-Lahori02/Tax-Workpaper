import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The packet is read from disk at runtime; make sure it ships with the server bundle.
  outputFileTracingIncludes: {
    "/**": ["./data/**"],
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
