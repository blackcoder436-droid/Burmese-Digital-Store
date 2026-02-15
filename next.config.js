/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'burmesedigital.store',
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['tesseract.js', 'sharp'],
  },
  // Disable x-powered-by header to reduce fingerprinting
  poweredByHeader: false,
  // Compress responses
  compress: true,
};

module.exports = nextConfig;
