"use client";

import { useEffect } from 'react';

export default function ErudaProvider() {
  useEffect(() => {
    if (typeof window !== 'undefined' && (window.location.search.includes('debug=1') || localStorage.getItem('debug_eruda'))) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/eruda';
      script.onload = () => {
        if ((window as any).eruda) {
          (window as any).eruda.init();
        }
      };
      document.body.appendChild(script);
    }
  }, []);

  return null;
}
