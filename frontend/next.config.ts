import type { NextConfig } from 'next';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..');

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ['better-sqlite3'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.externals.push('server-only');
    }
    return config;
  },
  output: 'standalone',
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
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
