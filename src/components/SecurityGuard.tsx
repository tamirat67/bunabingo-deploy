'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getTgInitData } from '@/lib/telegram';

export default function SecurityGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // We start in a checking state so we don't render children (and fire API calls) before we know we are authorized.
  const [isChecking, setIsChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    // 1. Allow any admin or agent routes
    if (pathname.startsWith('/admin') || pathname.startsWith('/agent')) {
      setIsChecking(false);
      return;
    }

    // 2. Allow if the user has an admin token in localStorage
    if (typeof window !== 'undefined') {
      try {
        if (localStorage.getItem('admin_token') || localStorage.getItem('buna_admin_token')) {
          setIsChecking(false);
          return;
        }
      } catch (e) {
        // Ignore localStorage errors
      }
    }

    // 3. Retry loop for Telegram WebApp (handles Android async load race condition)
    let retries = 0;
    const maxRetries = 20; // 2 seconds total (100ms * 20), shorter since we have cache now
    
    const checkTelegram = () => {
      // Use getTgInitData which now includes our robust sessionStorage caching
      const hasInitData = getTgInitData() !== '';
      
      if (hasInitData) {
        // Confirmed Telegram — no block needed
        setIsChecking(false);
        return;
      }
      
      retries++;
      if (retries < maxRetries) {
        setTimeout(checkTelegram, 100);
      } else {
        // After all retries, not Telegram — block access
        setIsChecking(false);
        setBlocked(true);
      }
    };
    
    checkTelegram();
  }, [pathname]);

  if (isChecking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A', color: '#F59E0B', fontFamily: 'sans-serif' }}>
        <div style={{ fontWeight: 'bold', fontSize: '18px', letterSpacing: '2px' }}>LOADING BINGO...</div>
      </div>
    );
  }

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
