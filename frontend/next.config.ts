import type { NextConfig } from 'next';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..');

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.externals.push('server-only');
    }
    return config;
  },
  images: {
    unoptimized: true,
  },
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
