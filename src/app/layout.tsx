import type { Metadata } from 'next';
import Script from 'next/script';
import { Suspense } from 'react';
import Navbar from '../components/Navbar';
import DebugOverlay from '../components/DebugOverlay';
import './globals.css';

export const metadata: Metadata = {
  title: 'Buna Bingo',
  description: 'The ultimate bingo experience on Telegram',
};

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
        <Suspense fallback={null}>
          {children}
        </Suspense>
        <Navbar />
        <DebugOverlay />
      </body>
    </html>
  );
}
