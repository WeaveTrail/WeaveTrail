import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    useTypeScriptCli: false,
  },
  reactStrictMode: true,
  // The committed Korean faces are served from `public/`, which has no build
  // hash in its URLs. Their bytes never change under a given name, so say so
  // rather than revalidating a 430 KB file on every navigation.
  async headers() {
    return [
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  transpilePackages: [
    "@weavetrail/contracts",
    "@weavetrail/replay-engine",
    "@weavetrail/scenarios",
    "@weavetrail/published-data",
  ],
};

export default nextConfig;
