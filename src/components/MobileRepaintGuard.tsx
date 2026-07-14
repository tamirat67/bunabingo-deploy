'use client';

import { useEffect } from 'react';

const BG = '#0F172A';

/**
 * MobileRepaintGuard — Permanently fixes white screen on Telegram Android.
 *
 * Root cause: Android Telegram WebView loses GPU compositor context when the
 * app goes to the background. On resume, all composited layers (body, html)
 * turn white. This component installs multiple listeners to detect and
 * instantly restore the dark background on every page.
 *
 * Runs client-side only. Safe for SSR/Next.js.
 */
export default function MobileRepaintGuard() {
  useEffect(() => {
    function forceRepaint() {
      try {
        // 1. Force background on html + body
        document.documentElement.style.backgroundColor = BG;
        document.documentElement.style.background = BG;
        document.body.style.backgroundColor = BG;
        document.body.style.background = BG;

        // 2. Trigger GPU recomposite via translateZ trick
        document.body.style.transform = 'translateZ(0)';
        requestAnimationFrame(() => {
          document.body.style.transform = '';
        });

        // 3. Telegram API — re-expand and set colors
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
          try { tg.expand(); } catch (_) {}
          try { tg.setBackgroundColor(BG); } catch (_) {}
          try { tg.setHeaderColor(BG); } catch (_) {}
        }
      } catch (_) {}
    }

    // Run immediately on mount
    forceRepaint();

    // Resume from background (main cause on Android)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        forceRepaint();
        setTimeout(forceRepaint, 200);
        setTimeout(forceRepaint, 600);
      }
    };

    // Window focus (minimize/restore)
    const onFocus = () => forceRepaint();

    // bfcache restore (browser back/forward)
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) forceRepaint();
    };

    // Route change (Next.js navigation)
    const onRouteChange = () => {
      forceRepaint();
      setTimeout(forceRepaint, 100);
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);

    // Next.js app router doesn't have router events but DOM mutations
    // catch navigations via popstate
    window.addEventListener('popstate', onRouteChange);

    // Watchdog: every 5 seconds check if background went white
    const watchdog = setInterval(() => {
      try {
        const bg = window.getComputedStyle(document.body).backgroundColor;
        // rgb(255,255,255) or transparent = white screen
        if (
          bg === 'rgb(255, 255, 255)' ||
          bg === 'rgba(0, 0, 0, 0)' ||
          bg === '' ||
          bg === 'transparent'
        ) {
          forceRepaint();
        }
      } catch (_) {}
    }, 5000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('popstate', onRouteChange);
      clearInterval(watchdog);
    };
  }, []);

  return null; // renders nothing
}
