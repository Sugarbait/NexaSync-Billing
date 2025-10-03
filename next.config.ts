import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Only run ESLint on these directories during build
    dirs: ['app', 'components', 'lib'],
    // Ignore errors during build (warnings only)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow production builds to successfully complete even with type errors
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
