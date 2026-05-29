"use client";

import { useEffect } from 'react';

export default function ErudaProvider() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
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
