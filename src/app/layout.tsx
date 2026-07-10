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

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '500', '700', '800', '900'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
      </head>
      <body className={outfit.className} style={{ backgroundColor: '#0F172A', margin: 0, padding: 0 }}>
        <Script src="/telegram-web-app.js" strategy="beforeInteractive" />
        {/* Prevent white flash before React hydrates */}
        <style>{`html,body{background-color:#0F172A!important;}`}</style>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
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
              } catch(e) {}
            `
          }}
        />



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
