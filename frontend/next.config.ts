import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // So production build in Docker doesn't fail just because of ESLint errors (e.g. no-explicit-any)
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

