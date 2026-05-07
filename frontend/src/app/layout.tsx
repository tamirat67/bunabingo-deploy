import type { Metadata } from 'next';
import { ToastProvider } from '../components/Toast';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Buna Bingo',
  description: 'Play Bingo and win real ETB prizes',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body>
        {/*
          Load Telegram WebApp SDK.
          In Telegram WebView the object is already injected natively;
          this script is only needed when testing in a regular browser.
        */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
