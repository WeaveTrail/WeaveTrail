import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    useTypeScriptCli: false,
  },
  reactStrictMode: true,
  transpilePackages: [
    "@weavetrail/contracts",
    "@weavetrail/replay-engine",
    "@weavetrail/scenarios",
    "@weavetrail/published-data",
  ],
};

export default nextConfig;
