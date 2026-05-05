'use client';
import { useEffect } from 'react';
import { ToastProvider } from '../components/Toast';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Apply theme on initial load
    const savedTheme = localStorage.getItem('buna-theme');
    if (savedTheme === 'dark') {
      document.body.classList.add('theme-dark');
    } else {
      document.body.classList.remove('theme-dark');
    }
  }, []);

  return (
    <html lang="en">
      <head>
        <title>Buna Bingo</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
