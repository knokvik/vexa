import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  transpilePackages: ["@vexa/shared", "@vexa/intelligence"],
  outputFileTracingRoot: root,
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
