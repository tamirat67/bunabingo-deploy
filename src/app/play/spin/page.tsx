'use client';
import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, AlertCircle, RefreshCw, Trophy } from 'lucide-react';
import { getMe, getWallet } from '../../../lib/api';
import Navbar from '../../../components/Navbar';

// ─── Wheel SVG ────────────────────────────────────────────────────────────────
function PrizeWheel({ segments, sliceDeg }: { segments: any[], sliceDeg: number }) {
  const cx = 200, cy = 200, r = 190, labelR = 135;

  return (
    <svg viewBox="0 0 400 400" className="w-full h-full" style={{ transform: 'rotate(0deg)', transition: 'none' }}>
      <defs>
        <radialGradient id="goldRing" cx="50%" cy="50%" r="50%">
          <stop offset="85%" stopColor="#b8860b" />
          <stop offset="100%" stopColor="#ffd700" />
        </radialGradient>
        <radialGradient id="hubGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ffe066" />
          <stop offset="60%" stopColor="#c8890a" />
          <stop offset="100%" stopColor="#7a4f00" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <circle cx={cx} cy={cy} r={r + 7} fill="url(#goldRing)" />

      {Array.from({ length: 30 }, (_, i) => {
        const deg = (i / 30) * 360;
        const bx = cx + (r + 4) * Math.cos((deg * Math.PI) / 180);
        const by = cy + (r + 4) * Math.sin((deg * Math.PI) / 180);
        return <circle key={i} cx={bx} cy={by} r={3.5} fill={i % 2 === 0 ? '#fff7a0' : '#ffd700'} opacity={0.9} />;
      })}

      {segments.map((seg, i) => {
        const start = i * sliceDeg - 90;
        const end = start + sliceDeg;
        const midDeg = start + sliceDeg / 2;
        const midRad = (midDeg * Math.PI) / 180;
        const lx = cx + labelR * Math.cos(midRad);
        const ly = cy + labelR * Math.sin(midRad);
        const textAngle = midDeg + 90;

        const [line1, line2] = seg.label.includes(' ')
          ? seg.label.split(' ')
          : [seg.label, ''];

        return (
          <g key={i}>
            <path
              d={slicePath(cx, cy, r, start, end)}
              fill={seg.color}
              stroke="#000"
              strokeWidth={1.5}
            />
            <line
              x1={cx} y1={cy}
              x2={cx + r * Math.cos((start * Math.PI) / 180)}
              y2={cy + r * Math.sin((start * Math.PI) / 180)}
              stroke="rgba(0,0,0,0.4)"
              strokeWidth={1}
            />
            <text
              x={lx} y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={seg.textColor}
              fontSize={line2 ? 13 : 15}
              fontWeight="900"
              fontFamily="sans-serif"
              transform={`rotate(${textAngle}, ${lx}, ${ly})`}
              style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)', letterSpacing: '-0.5px' }}
            >
              {line2 ? (
                <>
                  <tspan x={lx} dy={line2 ? '-7' : '0'}>{line1}</tspan>
                  <tspan x={lx} dy="15">{line2}</tspan>
                </>
              ) : (
                line1
              )}
            </text>
          </g>
        );
      })}

      <circle cx={cx} cy={cy} r={48} fill="rgba(0,0,0,0.4)" />
      <circle cx={cx} cy={cy} r={44} fill="url(#hubGrad)" stroke="#ffd700" strokeWidth={3} />
      <text x={cx} y={cy + 2} textAnchor="middle" dominantBaseline="middle" fontSize={28} filter="url(#glow)">⭐</text>
    </svg>
  );
}

function slicePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

function SpinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stake = parseInt(searchParams.get('stake') || '10', 10);

  const [user, setUser] = useState<any>(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<null | { segment: any; index: number }>(null);
  const [showResult, setShowResult] = useState(false);
  const [error, setError] = useState('');
  const totalSpun = useRef(0);

  const SEGMENTS = [
    { label: 'FREE',    value: 0,   type: 'free', color: '#6F4E37', textColor: '#ffffff' },
    { label: '5 ETB',   value: 5,   type: 'win',  color: '#D4AF37', textColor: '#3D2B1F' },
    { label: '10 ETB',  value: 10,  type: 'win',  color: '#A64B2A', textColor: '#ffffff' },
    { label: '20 ETB',  value: 20,  type: 'win',  color: '#6F4E37', textColor: '#ffffff' },
    { label: '30 ETB',  value: 30,  type: 'win',  color: '#D4AF37', textColor: '#3D2B1F' },
    { label: '40 ETB',  value: 40,  type: 'win',  color: '#A64B2A', textColor: '#ffffff' },
    { label: 'BAD LUCK',value: 0,   type: 'lose', color: '#4B3621', textColor: '#ff4444' },
    { label: '50 ETB',  value: 50,  type: 'win',  color: '#6F4E37', textColor: '#ffffff' },
    { label: '70 ETB',  value: 70,  type: 'win',  color: '#D4AF37', textColor: '#3D2B1F' },
    { label: '100 ETB', value: 100, type: 'win',  color: '#A64B2A', textColor: '#ffffff' },
  ];

  const TOTAL = SEGMENTS.length;
  const SLICE_DEG = 360 / TOTAL;

  useEffect(() => {
    getMe().then(setUser);
  }, []);

  const handleSpin = async () => {
    if (spinning || !user || user.wallet.balance < stake) return;
    setError('');
    setSpinning(true);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://bunabingo.onrender.com';
      const initData = (window as any).Telegram?.WebApp?.initData || '';
      
      const res = await fetch(`${API_URL}/api/game/spin`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-telegram-init-data': initData
        },
        body: JSON.stringify({ stake }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Spin failed');

      const winIdx = data.winIdx;
      const segCenter = winIdx * SLICE_DEG + SLICE_DEG / 2;
      const extraSpins = 360 * (8 + Math.floor(Math.random() * 4)); 
      const targetAngle = totalSpun.current - segCenter - 90 + extraSpins;

      totalSpun.current = targetAngle % 360;

      const wheelEl = document.getElementById('prize-wheel-inner');
      if (wheelEl) {
        wheelEl.style.transition = 'transform 5s cubic-bezier(0.17, 0.67, 0.12, 1)';
        wheelEl.style.transform = `rotate(${targetAngle}deg)`;
      }

      setTimeout(() => {
        setResult({ segment: SEGMENTS[winIdx], index: winIdx });
        setSpinning(false);
        setShowResult(true);
        getMe().then(setUser); // Refresh balance
      }, 5200);

    } catch (e: any) {
      setError(e.message || 'Error occurred');
      setSpinning(false);
    }
  };

  const isWin = result && (result.segment.type === 'win' || result.segment.type === 'free');
  const isLose = result && result.segment.type === 'lose';

  return (
    <div className="selection-container brown" style={{ minHeight: '100vh', background: '#2D1B14' }}>
      <div className="selection-header-top">
        <button className="btn-back" onClick={() => router.push('/')}><ArrowLeft size={20} /></button>
        <div className="header-text">
          <h1 style={{ color: '#D4AF37' }}>Spin & Win</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>STAKE {stake} ETB</p>
        </div>
      </div>

      <div className="stats-row-brown" style={{ marginTop: '20px' }}>
        <div className="capsule-brown"><div className="l">BALANCE</div><div className="v">{Number(user?.wallet?.balance || 0).toFixed(0)}</div></div>
        <div className="capsule-brown"><div className="l">WINNINGS</div><div className="v">{Number(user?.wallet?.totalWon || 0).toFixed(0)}</div></div>
      </div>

      <div className="wheel-area" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: '40px', position: 'relative' }}>
         <div style={{ position: 'relative', width: '300px', height: '300px' }}>
            <div id="prize-wheel-inner" style={{ width: '100%', height: '100%' }}>
               <PrizeWheel segments={SEGMENTS} sliceDeg={SLICE_DEG} />
            </div>
            <div style={{ position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
               <div style={{ width: '30px', height: '40px', background: 'linear-gradient(to bottom, #ffd700, #d42b2b)', clipPath: 'polygon(50% 100%, 0% 0%, 100% 0%)' }}></div>
            </div>
         </div>

         <div className="spin-actions" style={{ marginTop: '40px', width: '100%', maxWidth: '300px' }}>
            {error && <div className="error-msg" style={{ color: '#ff4444', fontSize: '12px', marginBottom: '10px', textAlign: 'center' }}>{error}</div>}
            
            <button 
                onClick={handleSpin}
                disabled={spinning || (user && user.wallet.balance < stake)}
                className="btn-bingo-main"
                style={{ 
                    background: spinning ? '#666' : 'linear-gradient(to right, #D4AF37, #B8860B)',
                    boxShadow: spinning ? 'none' : '0 6px 0 #7a4f00'
                }}
            >
               {spinning ? 'SPINNING...' : `SPIN FOR ${stake} ETB`}
            </button>
         </div>
      </div>

      <AnimatePresence>
        {showResult && result && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="win-overlay"
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          >
             <div className="win-card" style={{ background: '#3D2B1F', border: '2px solid #D4AF37', borderRadius: '24px', padding: '40px', textAlign: 'center', width: '100%', maxWidth: '320px' }}>
                <div style={{ fontSize: '64px', marginBottom: '20px' }}>{isLose ? '😔' : '🎉'}</div>
                <h2 style={{ color: '#D4AF37', fontSize: '28px', fontWeight: '900', marginBottom: '10px' }}>{result.segment.label}</h2>
                <p style={{ color: 'white', opacity: 0.7, marginBottom: '30px' }}>{isLose ? 'Better luck next time!' : 'Congratulations!'} </p>
                <button onClick={() => setShowResult(false)} className="btn-bingo-main" style={{ background: '#D4AF37', boxShadow: '0 4px 0 #7a4f00' }}>OK</button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SpinPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SpinContent />
    </Suspense>
  );
}
