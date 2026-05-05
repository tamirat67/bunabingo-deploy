import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '../components/Toast';

export const metadata: Metadata = {
  title: 'BunaBingo — Play & Win',
  description: 'Automated Bingo platform — Deposit, Play, Win instantly.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#2d1b4d" />
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body>
        <ToastProvider>
          <div className="app">{children}</div>
        </ToastProvider>
      </body>
    </html>
  );
}
