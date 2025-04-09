import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'out',
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Make sure the app is served from the correct path
  // For GitHub Pages, we don't need basePath when using custom domain
  basePath: '',
  assetPrefix: ''
};

export default nextConfig;
