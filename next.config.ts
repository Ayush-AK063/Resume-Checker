import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // External packages for server-side rendering
  serverExternalPackages: ['pdf-parse'],
  // Enable Turbopack configuration
  turbopack: {},
};

export default nextConfig;
