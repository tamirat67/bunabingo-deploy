"use client";

import Script from 'next/script';

export default function ErudaProvider() {
  return (
    <Script
      src="https://cdn.jsdelivr.net/npm/eruda"
      strategy="afterInteractive"
      onLoad={() => {
        const w = window as any;
        if (w.eruda) {
          w.eruda.init();
        }
      }}
    />
  );
}
