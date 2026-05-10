'use client';
import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, LogOut, Volume2, VolumeX } from 'lucide-react';
import { getMe, getGame, pusherAuth, getMyCard } from '../../../lib/api';
import Pusher from 'pusher-js';

// ── Coffee & Gold Theme ──────────────────────────────────────────────
const T = {
  bg:      '#F5E6BE',   // Cream
  header:  '#3D2B1F',   // Dark coffee
  gold:    '#D4AF37',   // Gold
  goldDk:  '#8B6B1D',   // Deep gold
  brown:   '#8D6E63',   // Warm brown
  card:    '#FFFFFF',
  statBg:  '#EEDCBA',
};

// Warm palette for wheel segments (coffee-inspired)
const PALETTE = [
  '#D4AF37','#E67E22','#C0392B','#8B6B1D',
  '#A0522D','#CD853F','#DAA520','#B8860B',
];

function PrizeWheel({ segments, sliceDeg }: { segments: any[]; sliceDeg: number }) {
  const cx = 200, cy = 200, r = 190, labelR = 145;
  return (
    <svg viewBox="0 0 400 400" style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 4px 15px rgba(61,43,31,0.5))' }}>
      <defs>
        <radialGradient id="hubG" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#3D2B1F" />
          <stop offset="85%"  stopColor="#2D1B14" />
          <stop offset="100%" stopColor="#D4AF37" />
        </radialGradient>
      </defs>
      {/* Outer rim */}
      <circle cx={cx} cy={cy} r={r + 6} fill={T.header} stroke={T.gold} strokeWidth={5} />
      {/* Decorative dots */}
      {Array.from({ length: 32 }).map((_, i) => {
        const deg = (i / 32) * 360;
        const x = cx + (r + 2) * Math.cos((deg * Math.PI) / 180);
        const y = cy + (r + 2) * Math.sin((deg * Math.PI) / 180);
        return <circle key={i} cx={x} cy={y} r={3.5} fill={i % 2 === 0 ? T.gold : '#fff'} />;
      })}
      {/* Slices */}
      {segments.map((seg, i) => {
        const start = i * sliceDeg - 90;
        const end   = start + sliceDeg;
        const mid   = start + sliceDeg / 2;
        const mRad  = (mid * Math.PI) / 180;
        const lx    = cx + labelR * Math.cos(mRad);
        const ly    = cy + labelR * Math.sin(mRad);
        return (
          <g key={i}>
            <path d={slicePath(cx, cy, r, start, end)} fill={seg.color} stroke="rgba(0,0,0,0.15)" strokeWidth={1.5} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
              fill="#fff" fontSize={15} fontWeight="900"
              transform={`rotate(${mid + 90}, ${lx}, ${ly})`}
              style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>
              {seg.label}
            </text>
          </g>
        );
      })}
      {/* Hub */}
      <circle cx={cx} cy={cy} r={58} fill="url(#hubG)" stroke={T.gold} strokeWidth={4} />
      <g transform={`translate(${cx - 35}, ${cy - 38}) scale(0.72)`}>
        <text x="50" y="35"  textAnchor="middle" fill={T.gold}  fontSize="13" fontWeight="bold">BUNA BINGO</text>
        <text x="50" y="60"  textAnchor="middle" fill="#ffffff"  fontSize="22" fontWeight="black">SPIN</text>
        <text x="50" y="82"  textAnchor="middle" fill={T.gold}  fontSize="12">ቡና ቢንጎ</text>
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

function StatBox({ label, value, span = 1 }: { label: string; value: any; span?: number }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.gold}44`, padding: '6px 4px', textAlign: 'center', borderRadius: '8px', gridColumn: span > 1 ? `span ${span}` : undefined }}>
      <div style={{ fontSize: '9px', fontWeight: 'bold', color: T.brown, letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: '12px', fontWeight: '900', color: T.header }}>{value}</div>
    </div>
  );
}

function SpinContent() {
  const router      = useRouter();
  const sp          = useSearchParams();
  const gameId      = sp.get('id');

  const [game,     setGame]     = useState<any>(null);
  const [tickets,  setTickets]  = useState<any[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [result,   setResult]   = useState<null | { winnerCardId: number; prizeAmount: string }>(null);
  const [showResult,setShowResult] = useState(false);
  const [segments, setSegments] = useState<any[]>([]);
  const [countdown,setCountdown]= useState<number | null>(null);
  const [soundOn,  setSoundOn]  = useState(true);
  const [mounted,  setMounted]  = useState(false);
  const totalSpun = useRef(0);

  useEffect(() => {
    setMounted(true);
    if (!gameId) return;

    Promise.all([getGame(gameId), getMyCard(gameId)]).then(([g, t]) => {
      setGame(g);
      setTickets(t.tickets || []);
      if (g.status === 'COUNTDOWN') setCountdown(g.countdownSeconds);
      if (g.status === 'FINISHED' && g.winners?.length) {
        const winCard = (g.winners[0].ticket?.card as any)?.id || 1;
        setResult({ winnerCardId: winCard, prizeAmount: g.winners[0].prizeAmount });
        setShowResult(true);
      }
    });

    const pk = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pc = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!pk || !pc) return;

    const pusher = new Pusher(pk, {
      cluster: pc,
      authorizer: ch => ({ authorize: (sid, cb) => pusherAuth(sid, ch.name).then(d => cb(null, d)).catch(e => cb(e, null)) }),
    });
    const ch = pusher.subscribe(`private-game-${gameId}`);
    ch.bind('player-joined', (d: any) => setGame((p: any) => ({ ...p, currentPlayers: d.playerCount })));
    ch.bind('countdown-start', (d: { seconds: number }) => setCountdown(d.seconds));
    ch.bind('spin-result', (d: any) => { setCountdown(null); handleRaffleResult(d); });
    return () => { ch.unbind_all(); pusher.disconnect(); };
  }, [gameId, mounted]);

  const handleRaffleResult = (data: { winnerCardId: number; prizeAmount: string; soldCards: number[] }) => {
    const sold = data.soldCards || [];
    let segs = sold.map((id, i) => ({ label: `${id}`, cardId: id, color: PALETTE[i % PALETTE.length] }));
    while (segs.length < 16 && segs.length > 0)
      segs = [...segs, ...segs.map((s, idx) => ({ ...s, color: PALETTE[(segs.length + idx) % PALETTE.length] }))];
    segs = segs.slice(0, 24);
    setSegments(segs);
    setSpinning(true);

    const SLICE  = 360 / segs.length;
    const winIdx = segs.findIndex(s => s.cardId === data.winnerCardId);
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

  const stake    = game?.room?.ticketPrice || 0;
  const cdText   = countdown !== null ? `${countdown}s` : (spinning ? 'SPINNING' : 'WAIT');

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: '90px', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* ── Coffee Header ── */}
      <div style={{ background: T.header, padding: '12px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `3px solid ${T.gold}` }}>
        <div style={{ color: T.gold, fontWeight: '900', fontSize: '18px', letterSpacing: '1px' }}>☕ BUNA SPIN</div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ background: game?.status === 'RUNNING' ? '#27AE60' : '#E67E22', color: 'white', fontSize: '10px', fontWeight: '900', padding: '3px 10px', borderRadius: '20px' }}>
            {game?.status || 'LOADING'}
          </div>
          <div onClick={() => setSoundOn(!soundOn)} style={{ color: soundOn ? T.gold : '#666', cursor: 'pointer' }}>
            {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', padding: '10px', background: T.statBg, borderBottom: `1px solid ${T.gold}44` }}>
        <StatBox label="GAME"        value={gameId?.slice(-6).toUpperCase() || '--'} />
        <StatBox label="PLAYERS"     value={game?.currentPlayers || '-'} />
        <StatBox label="STAKE"       value={`${stake} ETB`} />
        <StatBox label="WINNER CARD" value={result ? `#${result.winnerCardId}` : '—'} />
      </div>

      {/* ── Countdown Bar ── */}
      <div style={{ display: 'flex', gap: '10px', padding: '10px' }}>
        <div style={{ flex: 1, background: T.header, borderRadius: '14px', padding: '12px', textAlign: 'center', border: `2px solid ${T.gold}` }}>
          <div style={{ color: T.gold, fontSize: '10px', fontWeight: '900', letterSpacing: '1px' }}>COUNT DOWN</div>
          <div style={{ color: 'white', fontSize: '28px', fontWeight: '900', lineHeight: 1 }}>{cdText}</div>
        </div>
        <div style={{ flex: 2, background: T.header, borderRadius: '14px', padding: '12px', textAlign: 'center', border: `2px solid ${T.gold}` }}>
          <div style={{ color: T.gold, fontSize: '10px', fontWeight: '900', letterSpacing: '1px' }}>PRIZE POOL</div>
          <div style={{ color: 'white', fontSize: '24px', fontWeight: '900', lineHeight: 1 }}>{stake * 8} ETB</div>
          <div style={{ color: T.gold, fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>80% of stake × players</div>
        </div>
      </div>

      {/* ── Main 2-Column Layout ── */}
      <div style={{ display: 'flex', gap: '10px', padding: '0 10px 10px' }}>

        {/* LEFT: Wheel */}
        <div style={{ flex: 1.3, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', background: T.statBg, borderRadius: '50%', border: `4px solid ${T.gold}`, boxShadow: `0 0 20px ${T.gold}44`, overflow: 'visible' }}>
            {/* Pointer */}
            <div style={{ position: 'absolute', top: '-18px', left: '50%', transform: 'translateX(-50%)', zIndex: 20 }}>
              <div style={{ width: 0, height: 0, borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderTop: `28px solid ${T.header}`, filter: `drop-shadow(0 2px 4px ${T.gold})` }} />
            </div>
            <div id="wheel-inner" style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
              {segments.length > 0 ? (
                <PrizeWheel segments={segments} sliceDeg={360 / segments.length} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <RefreshCw size={36} color={T.gold} style={{ animation: 'spin 2s linear infinite' }} />
                  <div style={{ color: T.brown, fontSize: '11px', fontWeight: 'bold' }}>WAITING FOR PLAYERS</div>
                </div>
              )}
            </div>
          </div>

          {/* Refresh + Leave */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => window.location.reload()} style={{ flex: 1, background: T.header, color: T.gold, border: `2px solid ${T.gold}`, padding: '10px', borderRadius: '12px', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer' }}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={() => router.push('/')} style={{ flex: 1, background: '#C0392B', color: 'white', border: 'none', padding: '10px', borderRadius: '12px', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer', boxShadow: '0 4px #922B21' }}>
              <LogOut size={14} /> Leave
            </button>
          </div>
        </div>

        {/* RIGHT: Cards */}
        <div style={{ flex: 1, maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ color: T.header, fontWeight: '900', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: T.gold }}>☕</span> YOUR CARTELAS
          </div>
          {tickets.map((t: any) => {
            const cardObj  = t.card as { id: number; rows: any[][] };
            const rows     = cardObj?.rows ?? [];
            const cardId   = cardObj?.id ?? '?';
            const isWinner = result?.winnerCardId === cardId;
            return (
              <div key={t.id} style={{ background: T.card, borderRadius: '12px', overflow: 'hidden', border: isWinner ? `3px solid ${T.gold}` : `1px solid ${T.gold}33`, boxShadow: isWinner ? `0 0 20px ${T.gold}66` : '0 2px 8px rgba(0,0,0,0.08)' }}>
                <div style={{ background: isWinner ? T.gold : T.header, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: isWinner ? T.header : T.gold, fontWeight: '900', fontSize: '12px' }}>
                    {isWinner ? '🏆 WINNER! ' : ''}CARD #{cardId}
                  </div>
                </div>
                <div style={{ padding: '6px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px' }}>
                  {rows.map((row: any[], ri) => row.map((cell: any, ci) => {
                    const isFree = cell === 'FREE' || cell === 0 || cell === null;
                    return (
                      <div key={`${ri}-${ci}`} style={{ height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '5px', fontSize: '11px', fontWeight: '900', background: isFree ? '#27AE60' : T.statBg, color: isFree ? 'white' : T.header }}>
                        {isFree ? '★' : cell}
                      </div>
                    );
                  }))}
                </div>
              </div>
            );
          })}
          {tickets.length === 0 && (
            <div style={{ textAlign: 'center', color: T.brown, padding: '20px', background: T.card, borderRadius: '12px', border: `1px solid ${T.gold}33`, fontSize: '13px' }}>
              Your selected cartelas will appear here
            </div>
          )}
        </div>
      </div>

      {/* ── Win Overlay ── */}
      <AnimatePresence>
        {showResult && result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(61,43,31,0.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ scale: 0.5, y: 40 }} animate={{ scale: 1, y: 0 }}
              style={{ background: T.card, border: `4px solid ${T.gold}`, borderRadius: '28px', padding: '40px 28px', textAlign: 'center', maxWidth: '300px', boxShadow: `0 0 50px ${T.gold}66` }}>
              <div style={{ fontSize: '60px', marginBottom: '8px' }}>🏆</div>
              <h2 style={{ color: T.header, fontSize: '26px', fontWeight: '900', margin: '0 0 8px' }}>WINNER!</h2>
              <div style={{ background: `linear-gradient(135deg, ${T.gold}, ${T.goldDk})`, color: T.header, padding: '10px 20px', borderRadius: '30px', fontWeight: '900', fontSize: '22px', display: 'inline-block', margin: '0 0 12px' }}>
                CARD #{result.winnerCardId}
              </div>
              <div style={{ color: T.brown, fontSize: '13px', marginBottom: '8px' }}>PRIZE AMOUNT</div>
              <div style={{ color: T.header, fontSize: '32px', fontWeight: '900', marginBottom: '28px' }}>
                {Number(result.prizeAmount).toFixed(0)} <span style={{ fontSize: '16px' }}>ETB</span>
              </div>
              <button onClick={() => router.push('/')}
                style={{ width: '100%', background: `linear-gradient(135deg, ${T.gold}, ${T.goldDk})`, color: T.header, border: 'none', padding: '14px', borderRadius: '14px', fontWeight: '900', fontSize: '15px', cursor: 'pointer', boxShadow: `0 4px 0 ${T.goldDk}` }}>
                ☕ BACK TO LOBBY
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SpinPage() {
  return (
    <Suspense fallback={
      <div style={{ background: T.header, height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
        <div style={{ fontSize: '48px' }}>☕</div>
        <div style={{ color: T.gold, fontSize: '18px', fontWeight: '900', letterSpacing: '2px' }}>LOADING BUNA SPIN...</div>
      </div>
    }>
      <SpinContent />
    </Suspense>
  );
}
