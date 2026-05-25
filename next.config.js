/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  // Removed output: 'standalone' for Cloudflare Pages compatibility

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors *; frame-src *; child-src *;"
          },
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL'
          }
        ],
      },
    ];
  },
};

module.exports = nextConfig;
