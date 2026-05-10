'use client';
import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, LogOut, Home, Trophy, History, Wallet, User, Volume2, VolumeX, PlusCircle } from 'lucide-react';
import { getMe, getGame, pusherAuth, getMyCard } from '../../../lib/api';
import Pusher from 'pusher-js';

const PALETTE = ['#F1C40F', '#E67E22', '#E74C3C', '#9B59B6', '#3498DB', '#1ABC9C', '#2ECC71', '#F39C12'];

function PrizeWheel({ segments, sliceDeg }: { segments: any[], sliceDeg: number }) {
  const cx = 200, cy = 200, r = 190, labelR = 145;
  return (
    <svg viewBox="0 0 400 400" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.5))' }}>
      <defs>
        <radialGradient id="hubGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2D1B14" />
          <stop offset="100%" stopColor="#D4AF37" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r + 5} fill="#1a1a1a" stroke="#D4AF37" strokeWidth={4} />
      {Array.from({ length: 32 }).map((_, i) => {
        const deg = (i / 32) * 360;
        const x = cx + (r + 1) * Math.cos((deg * Math.PI) / 180);
        const y = cy + (r + 1) * Math.sin((deg * Math.PI) / 180);
        return <circle key={i} cx={x} cy={y} r={3} fill={i % 2 === 0 ? "#ffd700" : "#fff"} />;
      })}
      {segments.map((seg, i) => {
        const start = i * sliceDeg - 90;
        const end = start + sliceDeg;
        const midDeg = start + sliceDeg / 2;
        const midRad = (midDeg * Math.PI) / 180;
        const lx = cx + labelR * Math.cos(midRad);
        const ly = cy + labelR * Math.sin(midRad);
        const textAngle = midDeg + 90;
        return (
          <g key={i}>
            <path d={slicePath(cx, cy, r, start, end)} fill={seg.color} stroke="rgba(0,0,0,0.2)" strokeWidth={1} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontSize={16} fontWeight="900" transform={`rotate(${textAngle}, ${lx}, ${ly})`} style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
              {seg.label}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={55} fill="url(#hubGrad)" stroke="#ffd700" strokeWidth={3} />
      <g transform={`translate(${cx - 35}, ${cy - 35}) scale(0.7)`}>
         <text x="50" y="40" textAnchor="middle" fill="#D4AF37" fontSize="14" fontWeight="bold">BUNA BINGO</text>
         <text x="50" y="65" textAnchor="middle" fill="#ffffff" fontSize="24" fontWeight="black">SPIN</text>
         <text x="50" y="85" textAnchor="middle" fill="#D4AF37" fontSize="12">ቡና ቢንጎ</text>
      </g>
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
  const gameId = searchParams.get('id');

  const [user, setUser] = useState<any>(null);
  const [game, setGame] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<null | { winnerCardId: number; prizeAmount: string }>(null);
  const [showResult, setShowResult] = useState(false);
  const [dynamicSegments, setDynamicSegments] = useState<any[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [mounted, setMounted] = useState(false);
  const totalSpun = useRef(0);

  useEffect(() => {
    setMounted(true);
    if (!gameId) return;

    getMe().then(setUser);
    Promise.all([getGame(gameId), getMyCard(gameId)]).then(([g, t]) => {
      setGame(g);
      setTickets(t.tickets || []);
      if (g.status === 'COUNTDOWN') setCountdown(g.countdownSeconds);
      if (g.status === 'FINISHED' && g.winners?.length) {
         setResult({ winnerCardId: g.winners[0].ticket?.card?.id || 1, prizeAmount: g.winners[0].prizeAmount });
         setShowResult(true);
      }
    });

    let pusher: Pusher | null = null;
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (pusherKey && pusherCluster) {
      pusher = new Pusher(pusherKey, {
        cluster: pusherCluster,
        authorizer: (channel) => ({
          authorize: (socketId, cb) => {
            pusherAuth(socketId, channel.name).then(data => cb(null, data)).catch(err => cb(err, null));
          }
        })
      });
      const channel = pusher.subscribe(`private-game-${gameId}`);
      channel.bind('player-joined', (data: any) => setGame((prev: any) => ({ ...prev, currentPlayers: data.playerCount })));
      channel.bind('countdown-start', (data: { seconds: number }) => setCountdown(data.seconds));
      channel.bind('spin-result', (data: any) => { setCountdown(null); handleRaffleResult(data); });
    }
    return () => { if (pusher) { pusher.unsubscribe(`private-game-${gameId}`); pusher.disconnect(); } };
  }, [gameId, mounted]);

  const handleRaffleResult = (data: { winnerCardId: number; prizeAmount: string; soldCards: number[] }) => {
    const sold = data.soldCards || [];
    let segs = sold.map((id, i) => ({ label: `${id}`, cardId: id, color: PALETTE[i % PALETTE.length] }));
    while (segs.length < 16 && segs.length > 0) segs = [...segs, ...segs.map((s, idx) => ({ ...s, color: PALETTE[(segs.length + idx) % PALETTE.length] }))];
    segs = segs.slice(0, 24);
    setDynamicSegments(segs);
    setSpinning(true);
    const SLICE = 360 / segs.length;
    const winIdx = segs.findIndex(s => s.cardId === data.winnerCardId);
    if (winIdx !== -1) {
      const segCenter = winIdx * SLICE + SLICE / 2;
      const extraSpins = 360 * (12 + Math.floor(Math.random() * 5)); 
      const targetAngle = totalSpun.current - segCenter - 90 + extraSpins;
      totalSpun.current = targetAngle % 360;
      const wheelEl = document.getElementById('wheel-inner');
      if (wheelEl) {
        wheelEl.style.transition = 'transform 7s cubic-bezier(0.15, 0.8, 0.1, 1)';
        wheelEl.style.transform = `rotate(${targetAngle}deg)`;
      }
      setTimeout(() => {
        setResult({ winnerCardId: data.winnerCardId, prizeAmount: data.prizeAmount });
        setSpinning(false);
        setShowResult(true);
        getMe().then(setUser);
      }, 7500);
    }
  };

  if (!mounted) return null;

  return (
    <div className="spin-tournament-container" style={{ background: '#7D5BA6', minHeight: '100vh', paddingBottom: '100px', fontFamily: 'sans-serif', color: 'white' }}>
      
      {/* ── Dashboard Header ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px', padding: '5px', background: 'rgba(0,0,0,0.1)' }}>
         <div style={{ background: 'white', color: '#333', padding: '5px', textAlign: 'center', borderRadius: '4px' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', opacity: 0.6 }}>Game</div>
            <div style={{ fontSize: '11px', fontWeight: '900' }}>{gameId?.slice(-6).toUpperCase() || '--'}</div>
         </div>
         <div style={{ background: 'white', color: '#333', padding: '5px', textAlign: 'center', borderRadius: '4px' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', opacity: 0.6 }}>Derash</div>
            <div style={{ fontSize: '11px', fontWeight: '900' }}>-</div>
         </div>
         <div style={{ background: 'white', color: '#333', padding: '5px', textAlign: 'center', borderRadius: '4px' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', opacity: 0.6 }}>Players</div>
            <div style={{ fontSize: '11px', fontWeight: '900' }}>{game?.currentPlayers || '-'}</div>
         </div>
         <div style={{ background: 'white', color: '#333', padding: '5px', textAlign: 'center', borderRadius: '4px' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', opacity: 0.6 }}>Stake</div>
            <div style={{ fontSize: '11px', fontWeight: '900' }}>{game?.room?.ticketPrice || 0}</div>
         </div>
         <div style={{ background: 'white', color: '#333', padding: '5px', textAlign: 'center', borderRadius: '4px', gridColumn: 'span 2' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', opacity: 0.6 }}>WINNER CARD</div>
            <div style={{ fontSize: '11px', fontWeight: '900', color: '#E67E22' }}>{result ? `#${result.winnerCardId}` : 'WAITING...'}</div>
         </div>
         <div onClick={() => setSoundOn(!soundOn)} style={{ background: 'white', color: '#333', padding: '5px', textAlign: 'center', borderRadius: '4px', cursor: 'pointer', gridColumn: 'span 2' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', opacity: 0.6 }}>Sound</div>
            <div style={{ fontSize: '11px', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
               {soundOn ? <Volume2 size={12} /> : <VolumeX size={12} color="red" />} {soundOn ? 'ON' : 'OFF'}
            </div>
         </div>
      </div>

      <div style={{ display: 'flex', padding: '10px', gap: '10px' }}>
        
        {/* ── Left Column: Wheel ── */}
        <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ background: '#E0D4F0', color: '#3D2B1F', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', opacity: 0.7 }}>COUNTDOWN</div>
                <div style={{ fontSize: '24px', fontWeight: '900' }}>{countdown !== null ? countdown : (spinning ? 'ROULING' : 'WAIT')}</div>
            </div>

            <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', background: '#E0D4F0', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
               <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                  <div style={{ width: '0', height: '0', borderLeft: '15px solid transparent', borderRight: '15px solid transparent', borderTop: '25px solid #E74C3C' }}></div>
               </div>
               <div id="wheel-inner" style={{ width: '90%', height: '90%' }}>
                  {dynamicSegments.length > 0 ? (
                    <PrizeWheel segments={dynamicSegments} sliceDeg={360 / dynamicSegments.length} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '8px dashed rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <RefreshCw className="animate-spin" size={40} color="#7D5BA6" />
                    </div>
                  )}
               </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
               <button onClick={() => window.location.reload()} style={{ flex: 1, background: '#3498DB', color: 'white', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', boxShadow: '0 4px #2980B9' }}>
                  <RefreshCw size={16} /> Refresh
               </button>
               <button onClick={() => router.push('/')} style={{ flex: 1, background: '#E74C3C', color: 'white', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', boxShadow: '0 4px #C0392B' }}>
                  <LogOut size={16} /> Leave
               </button>
            </div>
        </div>

        {/* ── Right Column: Player Cards ── */}
        <div style={{ flex: 1, height: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }} className="cards-scroll">
           {tickets.map((t: any) => (
              <div key={t.id} style={{ background: '#E0D4F0', borderRadius: '12px', padding: '8px' }}>
                  <div style={{ color: '#3D2B1F', fontSize: '10px', fontWeight: '900', marginBottom: '5px', textAlign: 'center' }}>CARD #{t.card?.id || '?' }</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px' }}>
                     {(Array.isArray(t.card) ? t.card : t.card.rows).map((row: any[], ri: number) => row.map((cell: any, ci: number) => (
                        <div key={`${ri}-${ci}`} style={{ background: 'white', color: (cell === 0 || cell === 'FREE') ? '#27AE60' : '#333', height: '25px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', fontSize: '10px', fontWeight: '900' }}>
                           {cell === 0 || cell === 'FREE' ? '★' : cell}
                        </div>
                     )))}
                  </div>
              </div>
           ))}
        </div>
      </div>

      <AnimatePresence>
        {showResult && result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
             <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} style={{ background: 'white', color: '#3D2B1F', borderRadius: '24px', padding: '30px', textAlign: 'center', maxWidth: '300px', boxShadow: '0 0 30px rgba(0,0,0,0.5)' }}>
                <div style={{ fontSize: '50px' }}>🏆</div>
                <h2 style={{ fontSize: '24px', fontWeight: '900', margin: '10px 0' }}>WINNER!</h2>
                <div style={{ background: '#F1C40F', color: 'black', padding: '10px', borderRadius: '12px', fontWeight: '900', fontSize: '20px' }}>CARD #{result.winnerCardId}</div>
                <div style={{ marginTop: '20px', fontSize: '14px', fontWeight: 'bold', color: '#7D5BA6' }}>PRIZE: {Number(result.prizeAmount).toFixed(0)} ETB</div>
                <button onClick={() => router.push('/')} style={{ marginTop: '25px', width: '100%', background: '#7D5BA6', color: 'white', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: '900' }}>BACK TO LOBBY</button>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}

export default function SpinPage() {
  return (
    <Suspense fallback={<div style={{background:'#7D5BA6',height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:'18px',fontWeight:900}}>Loading Spin...</div>}>
      <SpinContent />
    </Suspense>
  );
}
