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
      // ── Unity WebGL: Brotli-compressed assets ──────────────────────
      // The .unityweb files (data, framework, wasm) are all Brotli-
      // compressed by the Unity build. The browser must receive the
      // Content-Encoding header so it decompresses them correctly.
      // Without this header the loader downloads the file but stalls
      // at ~90% because the raw bytes are still compressed.
      {
        source: '/unity/:path*.unityweb',
        headers: [
          { key: 'Content-Encoding', value: 'br' },
          { key: 'Cache-Control',    value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/unity/AirCrash.wasm.unityweb',
        headers: [
          { key: 'Content-Type',     value: 'application/wasm' },
          { key: 'Content-Encoding', value: 'br' },
          { key: 'Cache-Control',    value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/unity/AirCrash.framework.js.unityweb',
        headers: [
          { key: 'Content-Type',     value: 'application/javascript' },
          { key: 'Content-Encoding', value: 'br' },
          { key: 'Cache-Control',    value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
