'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function SecurityGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Start as 'true' to avoid blank-page flash — only block if we're SURE it's not Telegram
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    // 1. Allow any admin or agent routes
    if (pathname.startsWith('/admin') || pathname.startsWith('/agent')) {
      return;
    }

    // 2. Allow if the user has an admin token in localStorage
    if (typeof window !== 'undefined') {
      try {
        if (localStorage.getItem('admin_token')) return;
      } catch (e) {
        // Ignore localStorage errors
      }
    }

    // 3. Retry loop for Telegram WebApp (handles Android async load race condition)
    let retries = 0;
    const maxRetries = 50;
    
    const checkTelegram = () => {
      const isTelegram = typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData;
      if (isTelegram) {
        // Confirmed Telegram — no block needed
        return;
      }
      
      retries++;
      if (retries < maxRetries) {
        setTimeout(checkTelegram, 100);
      } else {
        // After all retries, not Telegram — block access
        setBlocked(true);
      }
    };
    
    checkTelegram();
  }, [pathname]);

  if (blocked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A', color: 'white', padding: '20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '16px', color: '#F59E0B' }}>BUNA BINGO</h1>
        <p style={{ marginBottom: '24px', fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>Please open this app from inside the Telegram Bot.</p>
        <a 
          href="https://t.me/buna_bingobot" 
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: '12px 24px', backgroundColor: '#F59E0B', color: '#0F172A', borderRadius: '12px', fontWeight: '900', textDecoration: 'none' }}
        >
          OPEN IN TELEGRAM
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
