import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    unoptimized: false,
    remotePatterns: [],
  },
  // Ensure static pages can be generated properly
  output: undefined,
};

export default nextConfig;
