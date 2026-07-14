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
    <div style={{ width: '100%', height: '100vh', overflow: 'hidden', background: '#13151c', backgroundColor: '#13151c' }}>
      <style>{`.bottom-navbar { display: none !important; } html,body{background:#13151c!important;}`}</style>
      <iframe 
        src="/chicken-road.html" 
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          background: '#13151c',
          backgroundColor: '#13151c',
        }}
        title="Chicken Road Game"
        allow="fullscreen"
      />
    </div>
  );
}
