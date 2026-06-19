import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Required for Hostinger / Node.js server deployment
};

export default nextConfig;
