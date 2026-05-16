import type { Metadata } from 'next';
import Script from 'next/script';
import { Suspense } from 'react';
import Navbar from '../components/Navbar';
// import DebugOverlay from '../components/DebugOverlay';
import './globals.css';

export const metadata: Metadata = {
  title: 'Buna Bingo',
  description: '🎰 Join me on Buna Bingo! ☕️ We both get 5 ETB bonus!',
  openGraph: {
    title: 'Buna Bingo',
    description: '🎰 Join me on Buna Bingo! ☕️ We both get 5 ETB bonus!',
    images: [{ url: '/banner.png', width: 1200, height: 630 }],
    type: 'website',
  },
};

import { ThemeProvider } from '../context/ThemeContext';
import { SocketProvider } from '../context/SocketContext';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <Script 
          src="https://telegram.org/js/telegram-web-app.js" 
          strategy="beforeInteractive" 
        />
      </head>
      <body>
        <SocketProvider>
          <ThemeProvider>
            <Suspense fallback={null}>
              {children}
            </Suspense>
            <Navbar />

          </ThemeProvider>
        </SocketProvider>
      </body>
    </html>
  );
}
