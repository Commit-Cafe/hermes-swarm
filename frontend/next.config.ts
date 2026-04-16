import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent ESLint issues from failing production builds.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
