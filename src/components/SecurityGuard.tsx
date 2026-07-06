'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function SecurityGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    // 1. Allow any admin or agent routes
    if (pathname.startsWith('/admin') || pathname.startsWith('/agent')) {
      setIsAllowed(true);
      return;
    }

    // 2. Allow if the user has an admin token in localStorage
    if (typeof window !== 'undefined' && localStorage.getItem('admin_token')) {
      setIsAllowed(true);
      return;
    }

    // 3. Retry loop for Telegram WebApp (handles Android async load race condition)
    let retries = 0;
    const maxRetries = 10;
    
    const checkTelegram = () => {
      const isTelegram = typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData;
      if (isTelegram) {
        setIsAllowed(true);
        return;
      }
      
      retries++;
      if (retries < maxRetries) {
        setTimeout(checkTelegram, 100);
      } else {
        // 4. If none of the above, they are opening the app in a regular browser without admin rights.
        // Redirect to the Telegram Bot.
        setIsAllowed(false);
      }
    };
    
    checkTelegram();
  }, [pathname]);



  if (isAllowed === null) {
    return <div style={{ minHeight: '100vh', backgroundColor: '#3D2B1F' }}></div>;
  }

  if (isAllowed === false) {
    // Automatically redirect to the Telegram Bot
    if (typeof window !== 'undefined') {
      window.location.href = 'https://t.me/buna_bingobot';
    }
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3D2B1F', color: 'white', padding: '20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '16px', color: '#D4AF37' }}>BUNA BINGO</h1>
        <p style={{ marginBottom: '24px', fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>Redirecting to Telegram...</p>
        <a 
          href="https://t.me/buna_bingobot" 
          style={{ padding: '12px 24px', backgroundColor: '#D4AF37', color: '#3D2B1F', borderRadius: '12px', fontWeight: '900', textDecoration: 'none' }}
        >
          OPEN IN TELEGRAM
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
