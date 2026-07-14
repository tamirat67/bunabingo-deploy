import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Suspense } from 'react';
import Navbar from '../components/Navbar';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Buna Games',
  description: '🎰 Join me on Buna Bingo! ☕️ We both get 5 ETB bonus!',
  metadataBase: new URL('https://bunatechhub.net'),
  openGraph: {
    title: 'Buna Games',
    description: '🎰 Join me on Buna Bingo! ☕️ We both get 5 ETB bonus!',
    images: [{ url: '/banner.png', width: 1200, height: 630 }],
    type: 'website',
  },
};

import { ThemeProvider } from '../context/ThemeContext';
import { SocketProvider } from '../context/SocketContext';
import SecurityGuard from '../components/SecurityGuard';
import { Outfit } from 'next/font/google';
import ErrorBoundary from '../components/ErrorBoundary';
import MobileRepaintGuard from '../components/MobileRepaintGuard';

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '500', '700', '800', '900'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ backgroundColor: '#0F172A' }}>
      <head>
        {/* CRITICAL: Inline style must be first to prevent white flash on ANY device */}
        <style dangerouslySetInnerHTML={{ __html: `
          html,body {
            background-color: #0F172A !important;
            min-height: 100vh;
            min-height: 100dvh;
          }
          /* Prevent white flash during font load */
          body { opacity: 1 !important; }
        `}} />
      </head>
      <body className={outfit.className} style={{ backgroundColor: '#0F172A', margin: 0, padding: 0 }}>
        <Script src="/telegram-web-app.js" strategy="beforeInteractive" />

        {/* ── PERMANENT WHITE SCREEN FIX ──────────────────────────────────────
            Runs synchronously BEFORE React hydrates.
            1. Forces dark background on html+body immediately
            2. Calls Telegram expand() to prevent viewport collapse
            3. Handles resume-from-background (Android GPU context loss)
            4. Watchdog: detects white screen and forces repaint every 10s
            5. ChunkLoadError Catcher: Hard reloads if old cached HTML requests deleted JS
        ────────────────────────────────────────────────────────────────────── */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              // Catch ChunkLoadErrors globally (when server deploys new build but client has old HTML)
              window.addEventListener('error', function(e) {
                if (e.message && e.message.match(/chunk/i)) {
                  window.location.reload(true);
                }
              }, true);
              window.addEventListener('unhandledrejection', function(e) {
                if (e.reason && e.reason.message && e.reason.message.match(/chunk/i)) {
                  window.location.reload(true);
                }
              });

              // 1. Force dark background immediately — before React
              var BG = '#0F172A';
              document.documentElement.style.backgroundColor = BG;
              document.documentElement.style.background = BG;
              if (document.body) {
                document.body.style.backgroundColor = BG;
                document.body.style.background = BG;
              }

              // 2. LocalStorage safety patch
              var originalGetItem = Storage.prototype.getItem;
              Storage.prototype.getItem = function() {
                try { return originalGetItem.apply(this, arguments); } catch(e) { return null; }
              };
              var originalSetItem = Storage.prototype.setItem;
              Storage.prototype.setItem = function() {
                try { originalSetItem.apply(this, arguments); } catch(e) {}
              };
              var originalRemoveItem = Storage.prototype.removeItem;
              Storage.prototype.removeItem = function() {
                try { originalRemoveItem.apply(this, arguments); } catch(e) {}
              };

              // 3. Telegram expand + setup (run after scripts load)
              function setupTelegram() {
                try {
                  var tg = window.Telegram && window.Telegram.WebApp;
                  if (tg) {
                    tg.expand();
                    tg.setBackgroundColor('#0F172A');
                    tg.setHeaderColor('#0F172A');
                    if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
                  }
                } catch(e) {}
              }
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', setupTelegram);
              } else {
                setupTelegram();
              }

              // 4. Repaint on visibility change (Android resume-from-background fix)
              // When Telegram puts the app in background on Android, the GPU compositor
              // context is destroyed. On resume, the WebView can show white.
              // Forcing a style change triggers a full repaint.
              function forceRepaint() {
                try {
                  var el = document.documentElement;
                  el.style.backgroundColor = BG;
                  if (document.body) {
                    document.body.style.backgroundColor = BG;
                    document.body.style.background = BG;
                    // Trigger reflow
                    document.body.style.transform = 'translateZ(0)';
                    requestAnimationFrame(function() {
                      document.body.style.transform = '';
                    });
                  }
                  setupTelegram();
                } catch(e) {}
              }

              document.addEventListener('visibilitychange', function() {
                if (document.visibilityState === 'visible') {
                  forceRepaint();
                  // Double-fire after 300ms for slower devices
                  setTimeout(forceRepaint, 300);
                }
              });

              // 5. Page focus (window minimize/restore)
              window.addEventListener('focus', forceRepaint);
              window.addEventListener('pageshow', function(e) {
                if (e.persisted) forceRepaint(); // bfcache restore
              });

              // 6. Watchdog: every 8 seconds, check if body background went white
              setInterval(function() {
                try {
                  var computed = window.getComputedStyle(document.body).backgroundColor;
                  // rgb(255, 255, 255) or transparent (empty)
                  if (computed === 'rgb(255, 255, 255)' || computed === 'rgba(0, 0, 0, 0)' || computed === 'transparent' || computed === '') {
                    forceRepaint();
                  }
                } catch(e) {}
              }, 8000);

            } catch(e) {}
          })();
        `}} />

        <SocketProvider>
          <MobileRepaintGuard />
          <ThemeProvider>
            <Suspense fallback={
              <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' }}>
                <div className="animate-spin" style={{ width: '40px', height: '40px', border: '3px solid #D4AF37', borderTopColor: 'transparent', borderRadius: '50%', marginBottom: '16px' }}></div>
                <div style={{ color: '#D4AF37', fontWeight: '900', fontSize: '12px', letterSpacing: '2px' }}>LOADING...</div>
              </div>
            }>
              <SecurityGuard>
                <ErrorBoundary>
                  {children}
                  <Navbar />
                </ErrorBoundary>
              </SecurityGuard>
            </Suspense>
          </ThemeProvider>
        </SocketProvider>
      </body>
    </html>
  );
}
