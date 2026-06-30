'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { getMe } from '@/lib/api';

// Dynamically import to avoid SSR issues with WebSocket
const FastKenoBoard = dynamic(() => import('@/components/keno/FastKenoBoard'), { ssr: false });

export default function KenoPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Attempt to get the user from the existing /me endpoint
    getMe().then((user) => {
      if (user?.id) {
        setUserId(user.id);
      }
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0a1a', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px'
      }}>
        <div style={{ fontSize: '48px', animation: 'spin 1.5s linear infinite' }}>🎱</div>
        <div style={{ color: '#94a3b8', fontSize: '16px', fontFamily: 'Inter, sans-serif' }}>Loading Fast Keno...</div>
        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  if (!userId) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0a1a', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px',
        fontFamily: 'Inter, sans-serif', color: '#94a3b8', padding: '24px', textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px' }}>🔐</div>
        <div style={{ fontSize: '18px', color: '#f87171', fontWeight: '700' }}>Session Required</div>
        <div style={{ fontSize: '14px' }}>Please open this app from the Telegram bot to play.</div>
      </div>
    );
  }

  return <FastKenoBoard userId={userId} />;
}
