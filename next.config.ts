import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Required for Hostinger / Node.js server deployment
  // These packages use native Node.js modules and must NOT be bundled by webpack
  serverExternalPackages: ['googleapis', 'google-auth-library'],
  // Ensure background-sync.js and its dependencies are included in the standalone output
  outputFileTracingIncludes: {
    '/**': ['./utils/**'],
  },
};

export default nextConfig;
