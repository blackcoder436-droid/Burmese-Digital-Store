/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
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
        hostname: 'cdn.burmesedigital.store',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
    ],
  },
  serverExternalPackages: ['tesseract.js', 'sharp'],
  // Disable x-powered-by header to reduce fingerprinting
  poweredByHeader: false,
  // Compress responses
  compress: true,
};

module.exports = nextConfig;
