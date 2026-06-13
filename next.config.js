const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type checking runs in CI/dev — skip during production build to avoid OOM on low-memory VPS
    ignoreBuildErrors: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'burmesedigital.store',
      },
      {
        protocol: 'https',
        hostname: 'www.burmesedigital.store',
      },
      {
        protocol: 'https',
        hostname: 'cdn.burmesedigital.store',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
      },
    ],
  },
  serverExternalPackages: ['tesseract.js', 'sharp', 'ssh2'],
  outputFileTracingRoot: __dirname,
  // Disable x-powered-by header to reduce fingerprinting
  poweredByHeader: false,
  // Compress responses
  compress: true,
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
    };
    return config;
  },
};

module.exports = nextConfig;
