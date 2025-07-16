import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@vexa/shared", "@vexa/intelligence"],
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
