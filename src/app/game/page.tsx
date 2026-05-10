'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getGame, getMyCard, pusherAuth, claimBingo } from '../../lib/api';
import Pusher from 'pusher-js';
import { Volume2, VolumeX, RefreshCw, LogOut, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Coffee & Gold Theme ──────────────────────────────────────────────
const T = {
  bg:      '#F5E6BE',   // Cream background
  header:  '#3D2B1F',   // Dark coffee header
  gold:    '#D4AF37',   // Gold accent
  goldDk:  '#8B6B1D',   // Deep gold shadow
  brown:   '#8D6E63',   // Warm brown text
  statBg:  '#EEDCBA',   // Light cream for stat boxes
  card:    '#FFFFFF',   // Card white
};

// BINGO column colors — warm & vibrant
const COL_COLOR: Record<string, string> = {
  B: '#E74C3C', I: '#E67E22', N: '#D4AF37', G: '#27AE60', O: '#8E44AD',
};
const COL_RANGES = [
  { l: 'B', s: 1,  e: 15 },
  { l: 'I', s: 16, e: 30 },
  { l: 'N', s: 31, e: 45 },
  { l: 'G', s: 46, e: 60 },
  { l: 'O', s: 61, e: 75 },
];
function colLabel(n: number) {
  if (n <= 15) return 'B'; if (n <= 30) return 'I';
  if (n <= 45) return 'N'; if (n <= 60) return 'G'; return 'O';
}

function GameContent() {
  const router  = useRouter();
  const sp      = useSearchParams();
  const gameId  = sp.get('id');

  const [game,      setGame]      = useState<any>(null);
  const [tickets,   setTickets]   = useState<any[]>([]);
  const [drawn,     setDrawn]     = useState<number[]>([]);
  const [lastBall,  setLastBall]  = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [soundOn,   setSoundOn]   = useState(true);
  const [hidden,    setHidden]    = useState<Set<string>>(new Set());
  const [winMsg,    setWinMsg]    = useState<string | null>(null);
  const [mounted,   setMounted]   = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!gameId) return;

    Promise.all([getGame(gameId), getMyCard(gameId)]).then(([g, t]) => {
      setGame(g);
      setTickets(t.tickets || []);
      const hist = (g.drawHistory || []).map((d: any) => d.number);
      setDrawn(hist);
      setLastBall(hist.at(-1) ?? null);
      if (g.status === 'COUNTDOWN') setCountdown(g.countdownSeconds);
    }).catch(console.error);

    const pk = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pc = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!pk || !pc) return;
    const pusher = new Pusher(pk, {
      cluster: pc,
      authorizer: ch => ({ authorize: (sid, cb) => pusherAuth(sid, ch.name).then(d => cb(null, d)).catch(e => cb(e, null)) }),
    });
    const ch = pusher.subscribe(`private-game-${gameId}`);
    ch.bind('number-drawn', (d: { number: number }) => {
      setLastBall(d.number);
      setDrawn(p => [...p, d.number]);
      setCountdown(null);
      if (soundOn && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(`${colLabel(d.number)} ${d.number}`);
        u.rate = 0.9; window.speechSynthesis.speak(u);
      }
    });
    ch.bind('countdown-start', (d: { seconds: number }) => setCountdown(d.seconds));
    ch.bind('game-update', (d: any) => {
      if (d.status === 'FINISHED') setWinMsg(d.winners?.[0] ? `Card #${(d.winners[0].ticket?.card as any)?.id} WON! 🏆` : 'Game Over');
      setGame((p: any) => p ? { ...p, ...d } : p);
    });
    return () => { ch.unbind_all(); pusher.disconnect(); };
  }, [gameId, mounted]);

  const isCalled   = (n: number) => drawn.includes(n);
  const hideCard   = (id: string) => setHidden(p => new Set([...p, id]));
  const handleBingo = async (tid: string) => {
    if (!gameId) return;
    try { await claimBingo(gameId); alert('🎉 BINGO CLAIMED!'); }
    catch (e: any) { alert(e.response?.data?.error || 'No Bingo yet! Keep playing.'); }
  };

  if (!mounted) return null;

  const stake   = game?.room?.ticketPrice || 0;
  const prize   = stake * 8;
  const cdText  = countdown !== null ? `${countdown}s` : (game?.status === 'WAITING' ? 'WAIT' : 'LIVE');
  const visible = tickets.filter(t => !hidden.has(t.id));

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: '90px', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* ── Coffee Header ── */}
      <div style={{ background: T.header, padding: '12px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `3px solid ${T.gold}` }}>
        <div style={{ color: T.gold, fontWeight: '900', fontSize: '18px', letterSpacing: '1px' }}>☕ BUNA BINGO</div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ background: game?.status === 'RUNNING' ? '#27AE60' : '#E67E22', color: 'white', fontSize: '10px', fontWeight: '900', padding: '3px 10px', borderRadius: '20px' }}>
            {game?.status || 'LOADING'}
          </div>
          <div onClick={() => setSoundOn(!soundOn)} style={{ color: soundOn ? T.gold : T.brown, cursor: 'pointer' }}>
            {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', padding: '8px', background: T.statBg, borderBottom: `1px solid ${T.gold}44` }}>
        {[['GAME', gameId?.slice(-6).toUpperCase() || '--'], ['PLAYERS', game?.currentPlayers ?? '-'], ['STAKE', `${stake} ETB`], ['CALLS', drawn.length]].map(([l, v]) => (
          <div key={l as string} style={{ background: T.card, border: `1px solid ${T.gold}33`, padding: '6px 4px', textAlign: 'center', borderRadius: '8px' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', color: T.brown }}>{l}</div>
            <div style={{ fontSize: '13px', fontWeight: '900', color: T.header }}>{v}</div>
          </div>
        ))}
      </div>

      {/* ── Main 2-Column Layout ── */}
      <div style={{ display: 'flex', gap: '8px', padding: '8px', alignItems: 'flex-start' }}>

        {/* ═══ LEFT COLUMN ═══ */}
        <div style={{ flex: '0 0 42%', display: 'flex', flexDirection: 'column', gap: '8px' }}>

          {/* Countdown + Last Ball */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <div style={{ flex: 1, background: T.header, borderRadius: '12px', padding: '8px', textAlign: 'center', border: `2px solid ${T.gold}` }}>
              <div style={{ color: T.gold, fontSize: '9px', fontWeight: '900', letterSpacing: '1px' }}>COUNT DOWN</div>
              <div style={{ color: 'white', fontSize: '22px', fontWeight: '900', lineHeight: 1 }}>{cdText}</div>
            </div>
            <motion.div
              key={lastBall}
              initial={{ scale: 0.5, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              style={{ width: '52px', height: '52px', background: lastBall ? COL_COLOR[colLabel(lastBall)] : T.statBg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '20px', border: `3px solid ${T.gold}`, color: lastBall ? 'white' : T.brown, flexShrink: 0, boxShadow: lastBall ? `0 4px 12px ${T.gold}66` : 'none' }}
            >
              {lastBall ?? '•'}
            </motion.div>
          </div>

          {/* Gold divider pill */}
          <div style={{ background: `linear-gradient(90deg, ${T.gold}22, ${T.gold}, ${T.gold}22)`, borderRadius: '20px', height: '3px', margin: '0 4px' }} />

          {/* B I N G O Circles */}
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            {['B','I','N','G','O'].map(l => (
              <div key={l} style={{ width: '32px', height: '32px', background: COL_COLOR[l], borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '15px', color: 'white', boxShadow: '0 3px 8px rgba(0,0,0,0.2)' }}>{l}</div>
            ))}
          </div>

          {/* Master Board 1–75 */}
          <div style={{ background: T.card, borderRadius: '12px', padding: '8px', border: `1px solid ${T.gold}33`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px', marginBottom: '4px' }}>
              {COL_RANGES.map(c => (
                <div key={c.l} style={{ background: COL_COLOR[c.l], color: 'white', textAlign: 'center', fontSize: '11px', fontWeight: '900', borderRadius: '5px', padding: '3px 0' }}>{c.l}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px' }}>
              {COL_RANGES.map(col =>
                Array.from({ length: 15 }, (_, i) => col.s + i).map(n => (
                  <div key={n} style={{
                    background: isCalled(n) ? COL_COLOR[col.l] : T.statBg,
                    color:      isCalled(n) ? 'white' : T.brown,
                    fontSize: '10px', fontWeight: '900', textAlign: 'center',
                    padding: '3px 0', borderRadius: '3px', transition: 'all 0.3s',
                    boxShadow: isCalled(n) ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                  }}>
                    {n}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Refresh + Leave */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => window.location.reload()} style={{ flex: 1, background: T.header, color: T.gold, border: `2px solid ${T.gold}`, padding: '10px', borderRadius: '12px', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer' }}>
              <RefreshCw size={13} /> Refresh
            </button>
            <button onClick={() => router.push('/')} style={{ flex: 1, background: '#C0392B', color: 'white', border: 'none', padding: '10px', borderRadius: '12px', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer', boxShadow: '0 4px #922B21' }}>
              <LogOut size={13} /> Leave
            </button>
          </div>
        </div>

        {/* ═══ RIGHT COLUMN: Cards ═══ */}
        <div style={{ flex: 1, maxHeight: '78vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ color: T.header, fontWeight: '900', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: T.gold }}>☕</span> YOUR CARTELAS ({visible.length})
          </div>

          {visible.map((t: any) => {
            const cardObj  = t.card as { id: number; rows: any[][] };
            const rows     = cardObj?.rows ?? [];
            const cardId   = cardObj?.id ?? '?';
            const matched  = rows.flat().filter((c: any) => c !== 'FREE' && c !== 0 && c !== null && isCalled(Number(c))).length;

            return (
              <div key={t.id} style={{ position: 'relative', background: T.card, borderRadius: '14px', overflow: 'hidden', border: `2px solid ${T.gold}44`, boxShadow: '0 3px 12px rgba(0,0,0,0.08)' }}>
                {/* X button */}
                <button onClick={() => hideCard(t.id)} style={{ position: 'absolute', top: '6px', right: '6px', width: '20px', height: '20px', background: '#C0392B', color: 'white', border: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, padding: 0 }}>
                  <X size={11} />
                </button>

                {/* Card Header */}
                <div style={{ background: T.header, padding: '7px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: '30px' }}>
                  <div style={{ color: T.gold, fontWeight: '900', fontSize: '12px' }}>CARTELA #{cardId}</div>
                  <div style={{ background: T.gold, color: T.header, fontSize: '10px', fontWeight: '900', padding: '2px 8px', borderRadius: '20px' }}>{matched} MATCHED</div>
                </div>

                {/* BINGO Headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px', padding: '5px 5px 0' }}>
                  {COL_RANGES.map(c => (
                    <div key={c.l} style={{ background: COL_COLOR[c.l], color: 'white', textAlign: 'center', fontSize: '11px', fontWeight: '900', padding: '3px 0', borderRadius: '5px' }}>{c.l}</div>
                  ))}
                </div>

                {/* 5×5 Grid */}
                <div style={{ padding: '5px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px' }}>
                  {rows.map((row: any[], ri: number) =>
                    row.map((cell: any, ci: number) => {
                      const isFree   = cell === 'FREE' || cell === 0 || cell === null;
                      const isMarked = !isFree && isCalled(Number(cell));
                      return (
                        <motion.div
                          key={`${ri}-${ci}`}
                          animate={isMarked ? { scale: [1, 1.12, 1] } : {}}
                          transition={{ duration: 0.3 }}
                          style={{
                            height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: '6px', fontSize: '13px', fontWeight: '900',
                            background: isFree ? '#27AE60' : isMarked ? T.gold : T.statBg,
                            color:      isFree ? 'white'   : isMarked ? T.header : T.header,
                            border:     isMarked ? `2px solid ${T.goldDk}` : '2px solid transparent',
                            boxShadow:  isMarked ? `0 2px 6px ${T.gold}88` : 'none',
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
                <div style={{ padding: '6px 5px' }}>
                  <button
                    onClick={() => handleBingo(t.id)}
                    style={{ width: '100%', background: `linear-gradient(135deg, ${T.gold}, ${T.goldDk})`, color: T.header, border: 'none', padding: '11px', borderRadius: '10px', fontWeight: '900', fontSize: '15px', boxShadow: `0 4px 0 ${T.goldDk}`, cursor: 'pointer', letterSpacing: '1px' }}
                  >
                    ☕ BINGO! ({prize} ETB)
                  </button>
                </div>
              </div>
            );
          })}

          {tickets.length === 0 && (
            <div style={{ textAlign: 'center', color: T.brown, padding: '30px', background: T.card, borderRadius: '12px', border: `1px solid ${T.gold}33` }}>
              Waiting for card data...
            </div>
          )}
          <div style={{ height: '8px' }} />
        </div>
      </div>

      {/* ── Floating Add Board ── */}
      <div
        onClick={() => router.push(`/tickets/select?type=${game?.room?.type || 'STANDARD'}&price=${stake}`)}
        style={{ position: 'fixed', bottom: '90px', right: '15px', background: `linear-gradient(135deg, ${T.gold}, ${T.goldDk})`, color: T.header, padding: '12px 18px', borderRadius: '30px', fontWeight: '900', fontSize: '13px', boxShadow: '0 5px 15px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 200, cursor: 'pointer', border: `2px solid ${T.goldDk}` }}
      >
        <Plus size={17} /> Add Board
      </div>

      {/* ── Win Overlay ── */}
      <AnimatePresence>
        {winMsg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(61,43,31,0.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }}
              style={{ background: T.card, border: `4px solid ${T.gold}`, borderRadius: '28px', padding: '40px 28px', textAlign: 'center', maxWidth: '290px', boxShadow: `0 0 50px ${T.gold}55` }}>
              <div style={{ fontSize: '60px' }}>☕</div>
              <div style={{ color: T.header, fontSize: '22px', fontWeight: '900', margin: '10px 0 24px' }}>{winMsg}</div>
              <button onClick={() => router.push('/')}
                style={{ width: '100%', background: `linear-gradient(135deg, ${T.gold}, ${T.goldDk})`, color: T.header, border: 'none', padding: '14px', borderRadius: '14px', fontWeight: '900', fontSize: '15px', cursor: 'pointer', boxShadow: `0 4px 0 ${T.goldDk}` }}>
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
