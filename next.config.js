/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  // Use 'standalone' for VPS Docker, but disable it for Cloudflare Pages
  output: process.env.CF_PAGES ? undefined : 'standalone',

  // ── Image Optimization ────────────────────────────────────────────
  // The slot splash image (buna_hot5_splash.png) is 1254×1254 at 2.34 MB.
  // Next.js will auto-serve it as a compressed WebP at the device's actual
  // pixel width (max 640px on mobile), reducing download to ~80–120 KB.
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [320, 375, 414, 640],
    imageSizes: [128, 256, 384],
    minimumCacheTTL: 86400,
  },

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
      // ── Unity WebGL: Gzip-compressed assets ──────────────────────
      // The .unityweb files (data, framework, wasm) are all Gzip-
      // compressed by the Unity build. The browser must receive the
      // Content-Encoding header so it decompresses them correctly.
      // Without this header the loader downloads the file but stalls
      // at ~90% because the raw bytes are still compressed.
      {
        source: '/unity/:path*.unityweb',
        headers: [
          { key: 'Content-Encoding', value: 'gzip' },
          { key: 'Cache-Control',    value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/unity/AirCrash.wasm.unityweb',
        headers: [
          { key: 'Content-Type',     value: 'application/wasm' },
          { key: 'Content-Encoding', value: 'gzip' },
          { key: 'Cache-Control',    value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/unity/AirCrash.framework.js.unityweb',
        headers: [
          { key: 'Content-Type',     value: 'application/javascript' },
          { key: 'Content-Encoding', value: 'gzip' },
          { key: 'Cache-Control',    value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
