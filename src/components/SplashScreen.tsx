'use client';

import { useEffect, useState } from 'react';

export default function SplashScreen() {
  // Show only once per browser/Telegram session — skip on hard refresh
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    const seen = sessionStorage.getItem('buna_splash_shown');
    if (seen) return false;
    sessionStorage.setItem('buna_splash_shown', '1');
    return true;
  });
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Start fade-out at 2.5 s, fully gone at 3 s
    const fadeTimer = setTimeout(() => setFading(true), 2500);
    const hideTimer = setTimeout(() => setVisible(false), 3000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% 0%, #1a0a00 0%, #0F172A 60%, #07101f 100%)',
        transition: 'opacity 0.5s ease',
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? 'none' : 'all',
      }}
    >
      {/* Glow orb behind logo */}
      <div style={{
        position: 'absolute',
        width: '260px',
        height: '260px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%)',
        filter: 'blur(40px)',
        animation: 'splashOrb 2s ease-in-out infinite alternate',
      }} />

      {/* Logo ring */}
      <div style={{
        position: 'relative',
        width: '110px',
        height: '110px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #F59E0B, #D97706)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 0 4px rgba(245,158,11,0.15), 0 0 40px rgba(245,158,11,0.4), 0 20px 60px rgba(0,0,0,0.6)',
        animation: 'splashPop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards',
        marginBottom: '28px',
      }}>
        <span style={{ fontSize: '52px', lineHeight: 1 }}>☕️</span>

        {/* Spinning ring */}
        <div style={{
          position: 'absolute',
          inset: '-8px',
          borderRadius: '50%',
          border: '2px solid transparent',
          borderTopColor: 'rgba(245,158,11,0.7)',
          borderRightColor: 'rgba(245,158,11,0.3)',
          animation: 'splashSpin 1.5s linear infinite',
        }} />
      </div>

      {/* Brand name */}
      <div style={{
        fontSize: '32px',
        fontWeight: 900,
        letterSpacing: '3px',
        textTransform: 'uppercase',
        background: 'linear-gradient(135deg, #F59E0B, #FDE68A, #D97706)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        textShadow: 'none',
        animation: 'splashFadeUp 0.7s 0.2s both',
        marginBottom: '8px',
      }}>
        Buna Bingo
      </div>

      {/* Tagline */}
      <div style={{
        fontSize: '13px',
        fontWeight: 600,
        color: 'rgba(255,255,255,0.45)',
        letterSpacing: '1.5px',
        animation: 'splashFadeUp 0.7s 0.4s both',
        marginBottom: '48px',
      }}>
        ☕️ የቡና ጣዕም፣ ወርቃማ ድሎች
      </div>

      {/* Progress bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: 'rgba(255,255,255,0.06)',
      }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg, #D97706, #F59E0B, #FDE68A)',
          boxShadow: '0 0 8px rgba(245,158,11,0.8)',
          animation: 'splashProgress 2.5s linear forwards',
          width: '0%',
        }} />
      </div>

      <style>{`
        @keyframes splashOrb {
          from { transform: scale(0.9); opacity: 0.6; }
          to   { transform: scale(1.1); opacity: 1; }
        }
        @keyframes splashPop {
          from { transform: scale(0.4); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        @keyframes splashSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes splashFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashProgress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </div>
  );
}
