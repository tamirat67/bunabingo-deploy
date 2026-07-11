'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getTgInitData } from '@/lib/telegram';

export default function SecurityGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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

    // 3. Check for Telegram WebApp environment
    const isTelegramWebApp = typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp;
    if (isTelegramWebApp) {
      setIsChecking(false);
      return;
    }

    // 4. Retry loop for Telegram WebApp initData (for backend auth)
    let retries = 0;
    const maxRetries = 40;
    
    const checkTelegram = () => {
      const isTgNow = typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp;
      const hasInitData = getTgInitData() !== '';
      
      if (isTgNow || hasInitData) {
        setIsChecking(false);
        return;
      }
      
      retries++;
      if (retries < maxRetries) {
        setTimeout(checkTelegram, 100);
      } else {
        setIsChecking(false);
        setBlocked(true);
      }
    };
    
    checkTelegram();
  }, [pathname]);

  if (isChecking) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2D1B14', color: '#D4AF37', zIndex: 9999 }}>
        <style>{`body { background: #2D1B14 !important; }`}</style>
        <div className="animate-spin" style={{ width: '40px', height: '40px', border: '3px solid #D4AF37', borderTopColor: 'transparent', borderRadius: '50%', marginBottom: '16px' }}></div>
        <div style={{ fontWeight: '900', fontSize: '12px', letterSpacing: '2px', textShadow: '0 0 10px rgba(212,175,55,0.5)' }}>LOADING...</div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2D1B14', color: 'white', padding: '20px', textAlign: 'center', zIndex: 9999 }}>
        <h1 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '16px', color: '#D4AF37' }}>BUNA BINGO</h1>
        <p style={{ marginBottom: '24px', fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>Please open this app from inside the Telegram Bot.</p>
        <a 
          href="https://t.me/buna_bingobot" 
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: '12px 24px', backgroundColor: '#D4AF37', color: '#2D1B14', borderRadius: '12px', fontWeight: '900', textDecoration: 'none' }}
        >
          OPEN IN TELEGRAM
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
