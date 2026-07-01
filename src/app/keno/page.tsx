'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { getMe } from '@/lib/api';

// Dynamically import to avoid SSR issues with WebSocket
const FastKenoBoard = dynamic(
  () => import('@/components/keno/FastKenoBoard'),
  { ssr: false }
);

interface UserData {
  id: string;
  balance?: number;
  wallet?: { balance: number };
}

export default function KenoPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Try reading the cached user from sessionStorage first.
    //    The lobby page always writes 'lobby_user' when it loads.
    //    This makes navigation from lobby → keno instant and reliable
    //    because Telegram initData is only injected on the very first
    //    page load and is NOT re-sent on client-side route changes.
    try {
      const cached = sessionStorage.getItem('lobby_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.id) {
          setUser(parsed);
          setLoading(false);
          return; // skip the API call entirely
        }
      }
    } catch (_) {}

    // 2. Fallback: call the API (works when the user deep-links directly
    //    to /keno or opens it fresh from the Telegram bot).
    getMe()
      .then((u) => { if (u?.id) setUser(u); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: '100dvh',
        background: 'linear-gradient(180deg,#0c1a11 0%,#08120c 60%,#050d08 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16,
        fontFamily: "'Inter',sans-serif",
      }}>
        {/* animated keno ball */}
        <div style={{ animation: 'floatBall 1.6s ease-in-out infinite' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'radial-gradient(circle at 32% 30%,#1e4030,#0a1a10)',
            border: '2px solid rgba(34,197,94,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            position: 'relative', overflow: 'hidden',
          }}>
            <span style={{ fontSize: 32, fontWeight: 900, color: '#fff' }}>80</span>
            <div style={{
              position: 'absolute', top: 8, left: 11, width: 30, height: 18,
              borderRadius: '50%', background: 'rgba(255,255,255,0.12)',
              transform: 'rotate(-30deg)', filter: 'blur(4px)',
            }} />
          </div>
        </div>
        <div style={{ color: '#334155', fontSize: 14, fontWeight: 600 }}>
          Loading Fast Keno…
        </div>
        <style>{`
          @keyframes floatBall{0%,100%{transform:translateY(0);}50%{transform:translateY(-10px);}}
        `}</style>
      </div>
    );
  }

  if (!user?.id) {
    return (
      <div style={{
        minHeight: '100dvh',
        background: 'linear-gradient(180deg,#0c1a11 0%,#050d08 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 12,
        fontFamily: "'Inter',sans-serif", color: '#94a3b8',
        padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 48 }}>🔐</div>
        <div style={{ fontSize: 17, color: '#f87171', fontWeight: 800 }}>Session Required</div>
        <div style={{ fontSize: 13, color: '#475569' }}>
          Open this app from the Telegram bot to play Fast Keno.
        </div>
      </div>
    );
  }

  const balanceETB = user.wallet?.balance ?? user.balance ?? 0;

  return (
    <FastKenoBoard
      userId={user.id}
      balance={typeof balanceETB === 'number' ? Math.floor(balanceETB) : 0}
    />
  );
}
