'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getGame, getMyCard, pusherAuth, claimBingo } from '../../lib/api';
import Pusher from 'pusher-js';
import { Volume2, VolumeX, RefreshCw, LogOut, PlusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Coffee & Gold Theme ────────────────────────────────────────────────
const THEME = {
  bg:         '#F5E6BE',   // Cream background
  card:       '#FFFFFF',   // Card background
  header:     '#3D2B1F',   // Dark coffee header
  gold:       '#D4AF37',   // Gold accent
  goldDark:   '#8B6B1D',   // Deep gold shadow
  brown:      '#8D6E63',   // Warm brown
  marked:     '#D4AF37',   // Called number highlight (gold)
  free:       '#4CAF50',   // Free square green
  text:       '#3D2B1F',   // Dark coffee text
  statBg:     '#EEDCBA',   // Light cream stat box
};

const COLUMNS = [
  { label: 'B', color: '#E74C3C', range: [1, 15] },
  { label: 'I', color: '#E67E22', range: [16, 30] },
  { label: 'N', color: '#D4AF37', range: [31, 45] },
  { label: 'G', color: '#27AE60', range: [46, 60] },
  { label: 'O', color: '#8E44AD', range: [61, 75] },
];

function getColumnColor(num: number) {
  if (num >= 1  && num <= 15) return '#E74C3C';
  if (num >= 16 && num <= 30) return '#E67E22';
  if (num >= 31 && num <= 45) return '#D4AF37';
  if (num >= 46 && num <= 60) return '#27AE60';
  return '#8E44AD';
}

function getColumnLabel(num: number) {
  if (num >= 1  && num <= 15) return 'B';
  if (num >= 16 && num <= 30) return 'I';
  if (num >= 31 && num <= 45) return 'N';
  if (num >= 46 && num <= 60) return 'G';
  return 'O';
}

function StatBox({ label, value, wide = false }: { label: string; value: any; wide?: boolean }) {
  return (
    <div style={{
      background: THEME.card,
      border: `1px solid ${THEME.gold}33`,
      padding: '6px 4px',
      textAlign: 'center',
      borderRadius: '8px',
      gridColumn: wide ? 'span 2' : undefined,
    }}>
      <div style={{ fontSize: '9px', fontWeight: 'bold', color: THEME.brown, letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: '900', color: THEME.text }}>{value}</div>
    </div>
  );
}

function GameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameId = searchParams.get('id');

  const [game,      setGame]      = useState<any>(null);
  const [tickets,   setTickets]   = useState<any[]>([]);
  const [drawn,     setDrawn]     = useState<number[]>([]);
  const [lastBall,  setLastBall]  = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [soundOn,   setSoundOn]   = useState(true);
  const [mounted,   setMounted]   = useState(false);
  const [winMsg,    setWinMsg]    = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!gameId) return;

    Promise.all([getGame(gameId), getMyCard(gameId)]).then(([g, t]) => {
      setGame(g);
      setTickets(t.tickets || []);
      const history = g.drawHistory?.map((d: any) => d.number) || [];
      setDrawn(history);
      setLastBall(history.length ? history[history.length - 1] : null);
      if (g.status === 'COUNTDOWN') setCountdown(g.countdownSeconds);
    }).catch(console.error);

    const pusherKey     = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!pusherKey || !pusherCluster) return;

    const pusher  = new Pusher(pusherKey, {
      cluster: pusherCluster,
      authorizer: (channel) => ({
        authorize: (socketId, cb) =>
          pusherAuth(socketId, channel.name).then(d => cb(null, d)).catch(e => cb(e, null)),
      }),
    });
    const channel = pusher.subscribe(`private-game-${gameId}`);

    channel.bind('number-drawn', (data: { number: number }) => {
      setLastBall(data.number);
      setDrawn(prev => [...prev, data.number]);
      setCountdown(null);
      if (soundOn && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance(`${getColumnLabel(data.number)} ${data.number}`);
        msg.rate = 0.9;
        window.speechSynthesis.speak(msg);
      }
    });

    channel.bind('countdown-start', (data: { seconds: number }) => setCountdown(data.seconds));

    channel.bind('game-update', (data: any) => {
      if (data.status === 'FINISHED') {
        setWinMsg(data.winners?.[0] ? `🏆 Card #${data.winners[0].ticket?.card?.id} WON!` : '🎮 Game Over');
      }
      setGame((prev: any) => prev ? { ...prev, ...data } : prev);
    });

    return () => { pusher.unsubscribe(`private-game-${gameId}`); pusher.disconnect(); };
  }, [gameId, mounted]);

  const handleBingo = async (ticketId: string) => {
    if (!gameId) return;
    try {
      await claimBingo(gameId);
      alert('🎉 BINGO CLAIMED!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'No Bingo yet! Keep playing.');
    }
  };

  const isCalled = (num: number) => drawn.includes(num);

  if (!mounted) return null;

  const statusText = countdown !== null ? `${countdown}s` : (game?.status === 'WAITING' ? 'WAIT' : 'LIVE');

  return (
    <div style={{ background: THEME.bg, minHeight: '100vh', paddingBottom: '100px', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* ── Coffee Header ── */}
      <div style={{ background: THEME.header, padding: '12px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `3px solid ${THEME.gold}` }}>
        <div style={{ color: THEME.gold, fontWeight: '900', fontSize: '18px', letterSpacing: '1px' }}>☕ BUNA BINGO</div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ background: game?.status === 'RUNNING' ? '#27AE60' : '#E67E22', color: 'white', fontSize: '10px', fontWeight: '900', padding: '3px 10px', borderRadius: '20px' }}>
            {game?.status || 'LOADING'}
          </div>
          <div onClick={() => setSoundOn(!soundOn)} style={{ color: soundOn ? THEME.gold : '#666', cursor: 'pointer' }}>
            {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', padding: '10px', background: THEME.statBg, borderBottom: `1px solid ${THEME.gold}44` }}>
        <StatBox label="GAME"    value={gameId?.slice(-6).toUpperCase() || '--'} />
        <StatBox label="PLAYERS" value={game?.currentPlayers || '-'} />
        <StatBox label="STAKE"   value={`${game?.room?.ticketPrice || 0} ETB`} />
        <StatBox label="CALLS"   value={drawn.length} />
      </div>

      {/* ── Countdown + Last Ball ── */}
      <div style={{ display: 'flex', gap: '10px', padding: '10px' }}>
        <div style={{ flex: 1, background: THEME.header, borderRadius: '14px', padding: '12px', textAlign: 'center', border: `2px solid ${THEME.gold}` }}>
          <div style={{ color: THEME.gold, fontSize: '10px', fontWeight: '900', letterSpacing: '1px' }}>COUNT DOWN</div>
          <div style={{ color: 'white', fontSize: '28px', fontWeight: '900', lineHeight: 1 }}>{statusText}</div>
        </div>
        <div style={{ flex: 1, background: THEME.header, borderRadius: '14px', padding: '12px', textAlign: 'center', border: `2px solid ${THEME.gold}` }}>
          <div style={{ color: THEME.gold, fontSize: '10px', fontWeight: '900', letterSpacing: '1px' }}>LAST CALL</div>
          {lastBall ? (
            <motion.div
              key={lastBall}
              initial={{ scale: 0.5, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              style={{ width: '50px', height: '50px', background: getColumnColor(lastBall), borderRadius: '50%', border: `3px solid ${THEME.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontWeight: '900', fontSize: '22px', color: 'white', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}
            >
              {lastBall}
            </motion.div>
          ) : <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '28px' }}>•</div>}
        </div>

        {/* BINGO Letters */}
        <div style={{ flex: 1.2, display: 'flex', gap: '3px', alignItems: 'center', justifyContent: 'center' }}>
          {COLUMNS.map(c => (
            <div key={c.label} style={{ width: '32px', height: '32px', background: c.color, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '14px', color: 'white', boxShadow: '0 3px 6px rgba(0,0,0,0.2)' }}>
              {c.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Master Calling Board (1–75) ── */}
      <div style={{ margin: '0 10px 10px', background: THEME.card, borderRadius: '16px', padding: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', border: `1px solid ${THEME.gold}33` }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px', marginBottom: '4px' }}>
          {COLUMNS.map(c => (
            <div key={c.label} style={{ background: c.color, color: 'white', textAlign: 'center', fontSize: '13px', fontWeight: '900', padding: '3px 0', borderRadius: '6px' }}>{c.label}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)', gap: '2px' }}>
          {Array.from({ length: 75 }, (_, i) => i + 1).map(n => {
            const called = isCalled(n);
            return (
              <div key={n} style={{
                background: called ? getColumnColor(n) : THEME.statBg,
                color: called ? 'white' : THEME.brown,
                fontSize: '9px', fontWeight: '900', textAlign: 'center',
                padding: '3px 0', borderRadius: '3px',
                transition: 'all 0.3s',
                boxShadow: called ? '0 2px 4px rgba(0,0,0,0.2)' : 'none',
              }}>{n}</div>
            );
          })}
        </div>
      </div>

      {/* ── Player's Selected Cards ── */}
      <div style={{ padding: '0 10px' }}>
        <div style={{ color: THEME.text, fontWeight: '900', fontSize: '13px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ color: THEME.gold }}>☕</span> YOUR CARTELAS ({tickets.length})
        </div>

        {tickets.length === 0 && (
          <div style={{ textAlign: 'center', color: THEME.brown, padding: '20px', background: THEME.card, borderRadius: '12px' }}>
            No cards found. Please reload.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {tickets.map((t: any) => {
            const rows: any[][] = Array.isArray(t.card) ? t.card : (t.card?.rows || []);
            const cardId = t.cardId || t.card?.id || '?';
            const markedCount = rows.flat().filter((cell: any) => cell !== 0 && cell !== 'FREE' && isCalled(Number(cell))).length;

            return (
              <div key={t.id} style={{ background: THEME.card, borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: `2px solid ${THEME.gold}44` }}>
                {/* Card Header */}
                <div style={{ background: THEME.header, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: THEME.gold, fontWeight: '900', fontSize: '14px' }}>CARTELA #{cardId}</div>
                  <div style={{ background: THEME.gold, color: THEME.text, fontSize: '11px', fontWeight: '900', padding: '2px 10px', borderRadius: '20px' }}>
                    {markedCount} MATCHED
                  </div>
                </div>

                {/* BINGO Column Headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px', padding: '6px 6px 0' }}>
                  {COLUMNS.map(c => (
                    <div key={c.label} style={{ background: c.color, color: 'white', textAlign: 'center', fontSize: '12px', fontWeight: '900', padding: '4px 0', borderRadius: '6px' }}>{c.label}</div>
                  ))}
                </div>

                {/* Card Grid */}
                <div style={{ padding: '6px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                  {rows.map((row: any[], ri: number) =>
                    row.map((cell: any, ci: number) => {
                      const isFree   = cell === 0 || cell === 'FREE';
                      const isMarked = !isFree && isCalled(Number(cell));
                      return (
                        <motion.div
                          key={`${ri}-${ci}`}
                          animate={isMarked ? { scale: [1, 1.15, 1] } : {}}
                          transition={{ duration: 0.3 }}
                          style={{
                            height: '40px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: '8px', fontSize: '15px', fontWeight: '900',
                            background: isFree ? THEME.free : isMarked ? THEME.gold : THEME.statBg,
                            color:      isFree ? 'white'  : isMarked ? '#3D2B1F' : THEME.text,
                            border:     isMarked ? `2px solid ${THEME.goldDark}` : '2px solid transparent',
                            boxShadow:  isMarked ? `0 2px 8px ${THEME.gold}88` : 'none',
                            transition: 'all 0.3s ease',
                          }}
                        >
                          {isFree ? '★' : cell}
                        </motion.div>
                      );
                    })
                  )}
                </div>

                {/* BINGO! Button */}
                <div style={{ padding: '8px 6px' }}>
                  <button
                    onClick={() => handleBingo(t.id)}
                    style={{ width: '100%', background: `linear-gradient(135deg, ${THEME.gold}, ${THEME.goldDark})`, color: THEME.header, border: 'none', padding: '12px', borderRadius: '12px', fontWeight: '900', fontSize: '16px', boxShadow: `0 4px 0 ${THEME.goldDark}`, cursor: 'pointer', letterSpacing: '1px' }}
                  >
                    ☕ BINGO! ({(game?.room?.ticketPrice || 0) * 8} ETB)
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div style={{ display: 'flex', gap: '10px', padding: '15px 10px 5px' }}>
        <button onClick={() => window.location.reload()} style={{ flex: 1, background: '#3498DB', color: 'white', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px #2980B9' }}>
          <RefreshCw size={16} /> Refresh
        </button>
        <button onClick={() => router.push('/')} style={{ flex: 1, background: '#E74C3C', color: 'white', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px #C0392B' }}>
          <LogOut size={16} /> Leave
        </button>
      </div>

      {/* ── Floating Add Board ── */}
      <div
        onClick={() => router.push(`/tickets/select?type=${game?.room?.type || 'STANDARD'}&price=${game?.room?.ticketPrice || 10}`)}
        style={{ position: 'fixed', bottom: '90px', right: '15px', background: `linear-gradient(135deg, ${THEME.gold}, ${THEME.goldDark})`, color: THEME.header, padding: '12px 20px', borderRadius: '30px', fontWeight: '900', fontSize: '13px', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 200, cursor: 'pointer', border: `2px solid ${THEME.goldDark}` }}
      >
        <PlusCircle size={18} /> Add Board
      </div>

      {/* ── Win Overlay ── */}
      <AnimatePresence>
        {winMsg && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <motion.div
              initial={{ scale: 0.5 }} animate={{ scale: 1 }}
              style={{ background: THEME.card, border: `3px solid ${THEME.gold}`, borderRadius: '24px', padding: '40px 30px', textAlign: 'center', maxWidth: '300px', boxShadow: `0 0 40px ${THEME.gold}55` }}
            >
              <div style={{ fontSize: '60px', marginBottom: '10px' }}>☕</div>
              <div style={{ color: THEME.text, fontSize: '22px', fontWeight: '900', marginBottom: '20px' }}>{winMsg}</div>
              <button onClick={() => router.push('/')} style={{ background: THEME.header, color: THEME.gold, border: `2px solid ${THEME.gold}`, padding: '12px 30px', borderRadius: '12px', fontWeight: '900', fontSize: '14px', cursor: 'pointer' }}>
                BACK TO LOBBY
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={
      <div style={{ background: '#3D2B1F', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
        <div style={{ fontSize: '48px' }}>☕</div>
        <div style={{ color: '#D4AF37', fontSize: '18px', fontWeight: '900', letterSpacing: '2px' }}>LOADING BUNA BINGO...</div>
      </div>
    }>
      <GameContent />
    </Suspense>
  );
}
