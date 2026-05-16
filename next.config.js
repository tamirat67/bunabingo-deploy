/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  // Required for Docker standalone output (smaller production image)
  output: 'standalone',

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
