import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['electron'],
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
