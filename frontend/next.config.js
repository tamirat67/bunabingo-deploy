/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors * https://t.me https://web.telegram.org" },
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://bunabingo.onrender.com',
    NEXT_PUBLIC_PUSHER_KEY: process.env.NEXT_PUBLIC_PUSHER_KEY || '13890cf18bf6ba41dc0d',
    NEXT_PUBLIC_PUSHER_CLUSTER: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2',
  },
};

module.exports = nextConfig;
