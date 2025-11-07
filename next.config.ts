import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
    eslint: {
    ignoreDuringBuilds: true, // This disables ESLint for all folders during production builds
  },
};

export default nextConfig;
