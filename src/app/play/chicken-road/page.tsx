'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ChickenRoadPage() {
  const router = useRouter();

  useEffect(() => {
    // If the Telegram Web App back button is available, show it and handle clicks
    const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
    if (tg && tg.BackButton) {
      tg.BackButton.show();
      const handleBack = () => {
        router.push('/');
      };
      tg.BackButton.onClick(handleBack);
      
      return () => {
        tg.BackButton.offClick(handleBack);
        tg.BackButton.hide();
      };
    }
  }, [router]);

  return (
    <div style={{ width: '100%', height: '100vh', overflow: 'hidden', background: '#1e100b' }}>
      <style>{`.bottom-navbar { display: none !important; }`}</style>
      <iframe 
        src="/chicken-road.html" 
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block'
        }}
        title="Chicken Road Game"
        allow="fullscreen"
      />
    </div>
  );
}
