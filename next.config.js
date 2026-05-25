/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  // Use 'standalone' for VPS Docker, but disable it for Cloudflare Pages
  output: process.env.CF_PAGES ? undefined : 'standalone',

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
