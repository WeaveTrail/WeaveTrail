import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@weavetrail/contracts",
    "@weavetrail/replay-engine",
    "@weavetrail/scenarios",
  ],
};

export default nextConfig;
