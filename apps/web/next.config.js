/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.backblazeb2.com',
      },
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb', // For large file uploads
    },
  },
};

module.exports = nextConfig;
