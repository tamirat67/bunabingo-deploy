'use client';
import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, LogOut, Volume2, VolumeX, ShieldCheck, Trophy } from 'lucide-react';
import { getMe, getGame, pusherAuth, getMyCard } from '../../../lib/api';
import Pusher from 'pusher-js';

import { useTheme } from '../../../context/ThemeContext';

const PALETTE = ['#D4AF37','#E67E22','#C0392B','#8B6B1D','#A0522D','#CD853F','#DAA520','#B8860B'];

function PrizeWheel({ segments, sliceDeg, T }: { segments: any[]; sliceDeg: number; T: any }) {
  const cx = 200, cy = 200, r = 190, labelR = 145;
  return (
    <svg viewBox="0 0 400 400" style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 6px 20px rgba(61,43,31,0.5))' }}>
      <defs>
        <radialGradient id="hubG" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#3D2B1F" />
          <stop offset="85%"  stopColor="#2D1B14" />
          <stop offset="100%" stopColor="#D4AF37" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r + 6} fill={T.header} stroke={T.gold} strokeWidth={5} />
      {Array.from({ length: 32 }).map((_, i) => {
        const deg = (i / 32) * 360;
        const x = cx + (r + 2) * Math.cos((deg * Math.PI) / 180);
        const y = cy + (r + 2) * Math.sin((deg * Math.PI) / 180);
        return <circle key={i} cx={x} cy={y} r={3.5} fill={i % 2 === 0 ? T.gold : '#fff'} />;
      })}
      {segments.map((seg, i) => {
        const start = i * sliceDeg - 90;
        const end   = start + sliceDeg;
        const mid   = start + sliceDeg / 2;
        const mRad  = (mid * Math.PI) / 180;
        const lx    = cx + labelR * Math.cos(mRad);
        const ly    = cy + labelR * Math.sin(mRad);
        return (
          <g key={i}>
            <path d={slicePath(cx, cy, r, start, end)} fill={seg.color} stroke="rgba(0,0,0,0.2)" strokeWidth={1.5} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={15} fontWeight="900" transform={`rotate(${mid + 90}, ${lx}, ${ly})`} style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>
              {seg.label}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={60} fill="url(#hubG)" stroke={T.gold} strokeWidth={4} />
      <g transform={`translate(${cx - 40}, ${cy - 40}) scale(0.8)`}>
        <text x="50" y="35" textAnchor="middle" fill={T.gold} fontSize="11" fontWeight="bold">BUNA GAME ZONE</text>
        <text x="50" y="60" textAnchor="middle" fill="#ffffff" fontSize="26" fontWeight="black">SPIN</text>
      </g>
    </svg>
  );
}

function slicePath(cx: number, cy: number, r: number, s: number, e: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(s)), y1 = cy + r * Math.sin(rad(s));
  const x2 = cx + r * Math.cos(rad(e)), y2 = cy + r * Math.sin(rad(e));
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${e - s > 180 ? 1 : 0} 1 ${x2} ${y2} Z`;
}

function SpinContent() {
  const router = useRouter();
  const { T } = useTheme();
  const sp = useSearchParams();
  const gameId = sp.get('id');

  const [game, setGame] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<null | { winnerCardId: number; prizeAmount: string }>(null);
  const [showResult, setShowResult] = useState(false);
  const [segments, setSegments] = useState<any[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [serverOff, setServerOff] = useState(0);
  const totalSpun = useRef(0);

  useEffect(() => {
    setMounted(true);
    if (!gameId) return;

    Promise.all([getGame(gameId), getMyCard(gameId)]).then(([g, t]) => {
      setGame(g);
      if (g.endTime && g.serverTime) {
        setServerOff(g.serverTime - Date.now());
        setEndTime(g.endTime);
      }
      setTickets((t.tickets || []).sort((a: any, b: any) => (a.card?.id || 0) - (b.card?.id || 0)));
      if (g.status === 'COUNTDOWN') setCountdown(g.countdownSeconds);
      if (g.status === 'FINISHED' && g.winners?.length) {
        setResult({ winnerCardId: (g.winners[0].ticket?.card as any)?.id || 1, prizeAmount: g.winners[0].prizeAmount });
        setShowResult(true);
      }
    });

    const pk = process.env.NEXT_PUBLIC_PUSHER_KEY, pc = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!pk || !pc) return;
    const pusher = new Pusher(pk, {
      cluster: pc,
      authorizer: ch => ({ authorize: (sid, cb) => pusherAuth(sid, ch.name).then(d => cb(null, d)).catch(e => cb(e, null)) }),
    });
    const ch = pusher.subscribe(`private-game-${gameId}`);
    ch.bind('countdown-start', (d: any) => {
      if (d.endTime && d.serverTime) {
        setServerOff(d.serverTime - Date.now());
        setEndTime(d.endTime);
      }
      setCountdown(d.seconds);
      if (d.playerCount !== undefined) setGame((p: any) => p ? { ...p, currentPlayers: d.playerCount } : p);
    });
    ch.bind('countdown-tick', (d: any) => {
      if (d.endTime && d.serverTime) {
        setServerOff(d.serverTime - Date.now());
        setEndTime(d.endTime);
      }
      setCountdown(d.secondsRemaining);
      setGame((p: any) => p ? { ...p, currentPlayers: d.playerCount } : p);
    });
    ch.bind('player-joined', (d: any) => {
      if (d.endTime && d.serverTime) {
        setServerOff(d.serverTime - Date.now());
        setEndTime(d.endTime);
      }
      setGame((p: any) => p ? { ...p, currentPlayers: d.playerCount } : p);
      if (d.secondsRemaining !== undefined) setCountdown(d.secondsRemaining);
    });
    ch.bind('spin-result', (d: any) => { setCountdown(null); handleRaffleResult(d); });
    return () => { ch.unbind_all(); pusher.disconnect(); };
  }, [gameId, mounted]);

  // Local countdown fallback for smoothness
  useEffect(() => {
    if (endTime === null) return;
    const timer = setInterval(() => {
      const now = Date.now() + serverOff;
      const rem = Math.max(0, Math.ceil((endTime - now) / 1000));
      setCountdown(rem);
      if (rem <= 0) setEndTime(null);
    }, 1000);
    return () => clearInterval(timer);
  }, [endTime, serverOff]);

  const handleRaffleResult = (data: any) => {
    const sold = data.soldCards || [];
    let segs = sold.map((id: any, i: any) => ({ label: `${id}`, cardId: id, color: PALETTE[i % PALETTE.length] }));
    while (segs.length < 16 && segs.length > 0) segs = [...segs, ...segs.map((s: any, idx: any) => ({ ...s, color: PALETTE[(segs.length + idx) % PALETTE.length] }))];
    segs = segs.slice(0, 24);
    setSegments(segs);
    setSpinning(true);

    const SLICE = 360 / segs.length;
    const winIdx = segs.findIndex((s: any) => s.cardId === data.winnerCardId);
    if (winIdx !== -1) {
      const target = totalSpun.current - (winIdx * SLICE + SLICE / 2) - 90 + 360 * (12 + Math.floor(Math.random() * 5));
      totalSpun.current = target % 360;
      const el = document.getElementById('wheel-inner');
      if (el) { el.style.transition = 'transform 7s cubic-bezier(0.15,0.8,0.1,1)'; el.style.transform = `rotate(${target}deg)`; }
      setTimeout(() => {
        setResult({ winnerCardId: data.winnerCardId, prizeAmount: data.prizeAmount });
        setSpinning(false);
        setShowResult(true);
      }, 7500);
    }
  };

  if (!mounted) return null;
  const stake = game?.room?.ticketPrice || 0;
  const cdText = countdown !== null ? `${countdown}s` : (spinning ? 'SPINNING' : 'WAIT');

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: '90px', fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ background: T.header, padding: '12px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `3px solid ${T.gold}` }}>
        <div style={{ color: T.gold, fontWeight: '900', fontSize: '18px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={20} /> BUNA GAME ZONE
        </div>
        <div onClick={() => setSoundOn(!soundOn)} style={{ color: soundOn ? T.gold : '#666', cursor: 'pointer' }}>
          {soundOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', padding: '10px', background: T.statBg, borderBottom: `1px solid ${T.gold}44` }}>
        {[ ['GAME', gameId?.slice(-6).toUpperCase() || '--'], ['PLAYERS', game?.currentPlayers || '-'], ['STAKE', `${stake} ETB`], ['POOL', stake * 10] ].map(([l, v]) => (
          <div key={l as string} style={{ background: T.card, border: `1px solid ${T.gold}33`, padding: '6px 4px', textAlign: 'center', borderRadius: '8px' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', color: T.brown }}>{l}</div>
            <div style={{ fontSize: '12px', fontWeight: '900', color: T.header }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', padding: '10px' }}>
        <div style={{ flex: 1, background: T.header, borderRadius: '14px', padding: '12px', textAlign: 'center', border: `2px solid ${T.gold}` }}>
          <div style={{ color: T.gold, fontSize: '10px', fontWeight: '900' }}>COUNT DOWN</div>
          <div style={{ color: 'white', fontSize: '28px', fontWeight: '900' }}>{cdText}</div>
        </div>
        <div style={{ flex: 2, background: T.header, borderRadius: '14px', padding: '12px', textAlign: 'center', border: `2px solid ${T.gold}` }}>
          <div style={{ color: T.gold, fontSize: '10px', fontWeight: '900' }}>PRIZE POOL</div>
          <div style={{ color: 'white', fontSize: '24px', fontWeight: '900' }}>{stake * 8} ETB</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', padding: '0 10px 10px' }}>
        <div style={{ flex: 1.3, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', background: T.statBg, borderRadius: '50%', border: `4px solid ${T.gold}`, boxShadow: `0 0 20px ${T.gold}44` }}>
            <div style={{ position: 'absolute', top: '-18px', left: '50%', transform: 'translateX(-50%)', zIndex: 20 }}>
              <div style={{ width: 0, height: 0, borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderTop: `28px solid ${T.header}`, filter: `drop-shadow(0 2px 4px ${T.gold})` }} />
            </div>
            <div id="wheel-inner" style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
              {segments.length > 0 ? <PrizeWheel segments={segments} sliceDeg={360 / segments.length} T={T} /> : 
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: T.brown }}><RefreshCw size={40} style={{ animation: 'spin 2s linear infinite' }} /></div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => window.location.reload()} style={{ flex: 1, background: T.header, color: T.gold, border: `2px solid ${T.gold}`, padding: '12px', borderRadius: '12px', fontWeight: 'bold' }}>Refresh</button>
            <button onClick={() => router.push('/')} style={{ flex: 1, background: '#C0392B', color: 'white', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold' }}>Leave</button>
          </div>
        </div>

        <div style={{ flex: 1, maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ color: T.header, fontWeight: '900', fontSize: '13px' }}>🏆 YOUR CARTELAS ({tickets.length})</div>
          {tickets.map((t: any) => {
            const cardObj = t.card as { id: number; rows: any[][] }, rows = cardObj?.rows ?? [], cardId = cardObj?.id ?? '?', isWinner = result?.winnerCardId === cardId;
            return (
              <div key={t.id} style={{ background: T.card, borderRadius: '14px', border: isWinner ? `3px solid ${T.gold}` : `1px solid ${T.gold}33`, boxShadow: isWinner ? `0 0 20px ${T.gold}66` : 'none' }}>
                <div style={{ background: isWinner ? T.gold : T.header, padding: '6px 10px', color: isWinner ? T.header : T.gold, fontWeight: '900', fontSize: '12px' }}>{isWinner ? '🏆 ' : ''}CARD #{cardId}</div>
                <div style={{ padding: '6px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px' }}>
                  {rows.map((row: any[], ri) => row.map((cell: any, ci) => (
                    <div key={`${ri}-${ci}`} style={{ height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '5px', fontSize: '11px', fontWeight: '900', background: (cell === 0 || cell === 'FREE') ? '#27AE60' : T.statBg, color: (cell === 0 || cell === 'FREE') ? 'white' : T.header }}>{ (cell === 0 || cell === 'FREE') ? '★' : cell }</div>
                  )))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {showResult && result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'fixed', inset: 0, background: 'rgba(61,43,31,0.95)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} style={{ background: T.card, border: `4px solid ${T.gold}`, borderRadius: '28px', padding: '40px', textAlign: 'center', maxWidth: '300px' }}>
              <Trophy size={60} color={T.gold} style={{ margin: '0 auto 15px' }} />
              <h2 style={{ color: T.header, fontSize: '26px', fontWeight: '900' }}>WINNER!</h2>
              <div style={{ background: T.gold, color: T.header, padding: '10px', borderRadius: '20px', fontWeight: '900', fontSize: '20px', margin: '15px 0' }}>CARD #{result.winnerCardId}</div>
              <div style={{ color: T.header, fontSize: '32px', fontWeight: '900', marginBottom: '25px' }}>{Number(result.prizeAmount).toFixed(0)} ETB</div>
              <button onClick={() => router.push('/')} style={{ width: '100%', background: T.gold, color: T.header, border: 'none', padding: '15px', borderRadius: '15px', fontWeight: '900' }}>BACK TO LOBBY</button>
            </motion.div>
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
