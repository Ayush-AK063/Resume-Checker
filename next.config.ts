import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // External packages for server-side rendering
  serverExternalPackages: ['pdf-parse'],
  // Enable Turbopack configuration
  turbopack: {},
  // instrumentation.ts is now loaded automatically in Next.js 15+
};

export default nextConfig;
