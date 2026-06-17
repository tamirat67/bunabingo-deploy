import type { Metadata } from 'next';
import Script from 'next/script';
import { Suspense } from 'react';
import Navbar from '../components/Navbar';
import './globals.css';

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
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '700', '800', '900'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className={inter.className}>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />

        {/* ── Eruda mobile debugger ── Only visible to ADMINS */}
        <Script
          src="https://cdn.jsdelivr.net/npm/eruda"
          strategy="afterInteractive"
          id="eruda-src"
        />
        <Script id="eruda-init" strategy="afterInteractive">{`
          (function initEruda() {
            function isDebugging() {
              if (window.location.search.includes('debug=1')) return true;
              if (localStorage.getItem('admin_token')) return true;
              try {
                var u = sessionStorage.getItem('lobby_user');
                if (u) {
                  var p = JSON.parse(u);
                  return p.role === 'ADMIN' || p.isAdmin;
                }
              } catch(e) {}
              return false;
            }

            if (!isDebugging()) return;

            if (typeof eruda !== 'undefined') {
              eruda.init();
            } else {
              var t = setInterval(function() {
                if (typeof eruda !== 'undefined') {
                  clearInterval(t);
                  eruda.init();
                }
              }, 150);
              setTimeout(function() { clearInterval(t); }, 10000);
            }
          })();
        `}</Script>
        {/* ─────────────────────────────────────────────────────────────────── */}

        <SocketProvider>
          <ThemeProvider>
            <Suspense fallback={
              <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2D1B14' }}>
                <div className="animate-spin" style={{ width: '40px', height: '40px', border: '3px solid #D4AF37', borderTopColor: 'transparent', borderRadius: '50%', marginBottom: '16px' }}></div>
                <div style={{ color: '#D4AF37', fontWeight: '900', fontSize: '12px', letterSpacing: '2px', textShadow: '0 0 10px rgba(212,175,55,0.5)' }}>LOADING...</div>
              </div>
            }>
              <SecurityGuard>
                {children}
                <Navbar />
              </SecurityGuard>
            </Suspense>
          </ThemeProvider>
        </SocketProvider>
      </body>
    </html>
  );
}
