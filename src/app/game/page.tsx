'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getGame, getMyCard, pusherAuth, claimBingo } from '../../lib/api';
import Pusher from 'pusher-js';
import { Volume2, VolumeX, RefreshCw, LogOut, Plus, X, Bell, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useTheme } from '../../context/ThemeContext';

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
  const { T } = useTheme();
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
  const [toast,     setToast]     = useState<string | null>(null);
  const [mounted,   setMounted]   = useState(false);

  const toastTimer = useRef<any>(null);

  useEffect(() => {
    setMounted(true);
    if (!gameId) return;

    const loadData = () => {
      Promise.all([getGame(gameId), getMyCard(gameId)]).then(([g, t]) => {
        setGame(g);
        // Sort tickets by card ID for better UX
        const sorted = (t.tickets || []).sort((a: any, b: any) => (a.card?.id || 0) - (b.card?.id || 0));
        setTickets(sorted);
        const hist = (g.drawHistory || []).map((d: any) => d.number);
        setDrawn(hist);
        setLastBall(hist.at(-1) ?? null);
        if (g.status === 'COUNTDOWN') setCountdown(g.countdownSeconds);
      }).catch(console.error);
    };

    loadData();

    const pk = process.env.NEXT_PUBLIC_PUSHER_KEY, pc = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!pk || !pc) return;
    const pusher = new Pusher(pk, {
      cluster: pc,
      authorizer: ch => ({ authorize: (sid, cb) => pusherAuth(sid, ch.name).then(d => cb(null, d)).catch(e => cb(e, null)) }),
    });
    const ch = pusher.subscribe(`private-game-${gameId}`);
    
    ch.bind('number-drawn', (d: { number: number }) => {
      const num = Number(d.number);
      setLastBall(num);
      setDrawn(p => [...p, num]);
      setCountdown(null);
      setToast(`${colLabel(num)} ${num}`);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 2500);

      if (soundOn && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(`${colLabel(num)} ${num}`);
        u.rate = 1.0; window.speechSynthesis.speak(u);
      }
    });

    ch.bind('countdown-start', (d: { seconds: number }) => setCountdown(d.seconds));
    ch.bind('game-update', (d: any) => {
      if (d.status === 'FINISHED') setWinMsg(d.winners?.[0] ? `Card #${(d.winners[0].ticket?.card as any)?.id} WON! 🏆` : 'Game Over');
      setGame((p: any) => p ? { ...p, ...d } : p);
    });

    return () => { ch.unbind_all(); pusher.disconnect(); if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, [gameId, mounted, soundOn]);

  const isCalled   = (n: number) => drawn.includes(n);
  const hideCard   = (id: string) => setHidden(p => new Set([...p, id]));
  const handleBingo = async () => {
    if (!gameId) return;
    try { await claimBingo(gameId); }
    catch (e: any) { alert(e.response?.data?.error || 'No Bingo yet! Keep playing.'); }
  };

  if (!mounted) return null;

  const stake   = game?.room?.ticketPrice || 0;
  const prize   = stake * 8;
  const cdText  = countdown !== null ? `${countdown}s` : (game?.status === 'WAITING' ? 'WAIT' : 'LIVE');
  const visible = tickets.filter(t => !hidden.has(t.id));

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: '90px', fontFamily: "'Segoe UI', sans-serif", overflowX: 'hidden' }}>

      {/* ── Buna Game Zone Header ── */}
      <div style={{ background: T.header, padding: '12px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `3px solid ${T.gold}`, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ color: T.gold, fontWeight: '900', fontSize: '18px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={20} /> BUNA GAME ZONE
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ background: game?.status === 'RUNNING' ? '#27AE60' : '#E67E22', color: 'white', fontSize: '10px', fontWeight: '900', padding: '3px 10px', borderRadius: '20px' }}>
            {game?.status || 'LOADING'}
          </div>
          <div onClick={() => setSoundOn(!soundOn)} style={{ color: soundOn ? T.gold : T.brown, cursor: 'pointer' }}>
            {soundOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', padding: '8px', background: T.statBg, borderBottom: `1px solid ${T.gold}44` }}>
        {[
          ['GAME ID', gameId?.slice(-6).toUpperCase() || '--'],
          ['PLAYERS', game?.currentPlayers ?? '-'],
          ['STAKE', `${stake} ETB`],
          ['POOL', `${prize} ETB`]
        ].map(([l, v]) => (
          <div key={l as string} style={{ background: T.card, border: `1px solid ${T.gold}33`, padding: '6px 4px', textAlign: 'center', borderRadius: '8px' }}>
            <div style={{ fontSize: '8px', fontWeight: 'bold', color: T.brown }}>{l}</div>
            <div style={{ fontSize: '12px', fontWeight: '900', color: T.header }}>{v}</div>
          </div>
        ))}
      </div>

      {/* ── Main Layout ── */}
      <div style={{ display: 'flex', gap: '10px', padding: '10px', alignItems: 'flex-start' }}>

        {/* Master Board (Left) */}
        <div style={{ flex: '0 0 52%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1, background: T.header, borderRadius: '14px', padding: '10px', textAlign: 'center', border: `2px solid ${T.gold}` }}>
              <div style={{ color: T.gold, fontSize: '9px', fontWeight: '900' }}>COUNT DOWN</div>
              <div style={{ color: 'white', fontSize: '24px', fontWeight: '900' }}>{cdText}</div>
            </div>
            <motion.div key={lastBall} initial={{ scale: 0.5 }} animate={{ scale: 1 }} style={{ width: '56px', height: '56px', background: lastBall ? COL_COLOR[colLabel(lastBall)] : T.statBg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '22px', border: `4px solid ${T.gold}`, color: lastBall ? 'white' : T.brown }}>
              {lastBall ?? '•'}
            </motion.div>
          </div>

          <div style={{ background: T.card, borderRadius: '14px', padding: '10px', border: `1px solid ${T.gold}44` }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px', marginBottom: '6px' }}>
              {['B','I','N','G','O'].map(l => (
                <div key={l} style={{ background: COL_COLOR[l], color: 'white', textAlign: 'center', fontSize: '13px', fontWeight: '900', borderRadius: '6px', padding: '4px 0' }}>{l}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px' }}>
              {COL_RANGES.map(col => Array.from({ length: 15 }, (_, i) => col.s + i).map(n => (
                <div key={n} style={{
                  background: isCalled(n) ? COL_COLOR[col.l] : T.statBg,
                  color:      isCalled(n) ? 'white' : T.brown,
                  fontSize: '10px', fontWeight: '900', textAlign: 'center', padding: '3.5px 0', borderRadius: '4px'
                }}>{n}</div>
              )))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => window.location.reload()} style={{ flex: 1, background: T.header, color: T.gold, border: `2px solid ${T.gold}`, padding: '12px', borderRadius: '14px', fontWeight: 'bold' }}>Refresh</button>
            <button onClick={() => router.push('/')} style={{ flex: 1, background: '#C0392B', color: 'white', border: 'none', padding: '12px', borderRadius: '14px', fontWeight: 'bold' }}>Leave</button>
          </div>
        </div>

        {/* My Cartelas (Right) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ color: T.header, fontWeight: '900', fontSize: '13px', padding: '0 5px' }}>
            🏆 YOUR CARTELAS ({visible.length})
          </div>

          {visible.map((t: any) => {
            const cardObj = t.card as { id: number; rows: any[][] };
            const rows = cardObj?.rows ?? [];
            const cardId = cardObj?.id ?? '?';
            const matched = rows.flat().filter((c: any) => c !== 'FREE' && c !== 0 && c !== null && isCalled(Number(c))).length;

            return (
              <motion.div layout key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'relative', background: T.card, borderRadius: '16px', overflow: 'hidden', border: `2px solid ${T.gold}55`, boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                <button onClick={() => hideCard(t.id)} style={{ position: 'absolute', top: '4px', right: '5px', width: '20px', height: '20px', background: '#C0392B', color: 'white', border: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}><X size={10} /></button>
                <div style={{ background: T.header, padding: '4px 10px', color: T.gold, fontWeight: '900', fontSize: '11px' }}>
                   Cartela #{cardId}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px', padding: '5px' }}>
                  {['B','I','N','G','O'].map(l => (
                    <div key={l} style={{ background: COL_COLOR[l], color: 'white', textAlign: 'center', fontSize: '10px', fontWeight: '900', padding: '2px 0', borderRadius: '4px' }}>{l}</div>
                  ))}
                  {rows.map((row: any[], ri: number) => row.map((cell: any, ci: number) => {
                      const isFree = cell === 'FREE' || cell === 0 || cell === null;
                      const isMarked = !isFree && isCalled(Number(cell));
                      return (
                        <div key={`${ri}-${ci}`} style={{ height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', fontSize: '11px', fontWeight: '900', background: isFree ? '#27AE60' : isMarked ? T.gold : T.statBg, color: isFree ? 'white' : T.header, border: isMarked ? `1px solid ${T.goldDk}` : 'none' }}>
                          {isFree ? '★' : cell}
                        </div>
                      );
                    }))}
                </div>

              </motion.div>
            );
          })}
          {tickets.length === 0 && <div style={{ textAlign: 'center', color: T.brown, padding: '40px' }}>Fetching cards...</div>}
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: -50 }} animate={{ y: 20 }} exit={{ y: -50 }} style={{ position: 'fixed', top: '70px', left: '50%', transform: 'translateX(-50%)', background: T.header, color: T.gold, padding: '10px 25px', borderRadius: '30px', fontWeight: '900', fontSize: '20px', border: `2px solid ${T.gold}`, zIndex: 2000 }}>
            <Bell size={20} style={{ display: 'inline', marginRight: '8px' }} /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Single BINGO button for all cards ── */}
      {visible.length > 0 && game?.status === 'RUNNING' && (
        <motion.div
          whileTap={{ scale: 0.95 }}
          onClick={handleBingo}
          style={{ position: 'fixed', bottom: '15px', left: '15px', right: '15px', background: `linear-gradient(135deg, ${T.gold}, ${T.goldDk})`, color: T.header, padding: '16px', borderRadius: '18px', fontWeight: '900', fontSize: '20px', textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 300, cursor: 'pointer', border: `2px solid ${T.goldDk}`, letterSpacing: '1px' }}
        >
          ☕ BINGO! &nbsp;<span style={{ fontSize: '13px', opacity: 0.75 }}>({visible.length} card{visible.length > 1 ? 's' : ''} · {prize} ETB)</span>
        </motion.div>
      )}

      {/* ── Add Board FAB ── */}
      <motion.div whileTap={{ scale: 0.9 }} onClick={() => router.push(`/tickets/select?type=${game?.room?.type || 'STANDARD'}&price=${stake}`)} style={{ position: 'fixed', bottom: '80px', right: '15px', background: T.header, color: T.gold, padding: '12px 18px', borderRadius: '30px', fontWeight: '900', fontSize: '13px', boxShadow: '0 8px 20px rgba(0,0,0,0.2)', zIndex: 200, cursor: 'pointer', border: `2px solid ${T.gold}` }}>
        <Plus size={18} style={{ display: 'inline', marginRight: '5px' }} /> ADD BOARD
      </motion.div>

      <AnimatePresence>
        {winMsg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'fixed', inset: 0, background: 'rgba(61,43,31,0.95)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} style={{ background: T.card, border: `5px solid ${T.gold}`, borderRadius: '32px', padding: '45px 30px', textAlign: 'center', maxWidth: '320px' }}>
              <div style={{ fontSize: '70px' }}>🏆</div>
              <h2 style={{ color: T.header, fontSize: '28px', fontWeight: '900' }}>WINNER!</h2>
              <div style={{ color: T.header, fontSize: '18px', margin: '10px 0 30px' }}>{winMsg}</div>
              <button onClick={() => router.push('/')} style={{ width: '100%', background: T.gold, color: T.header, padding: '16px', borderRadius: '16px', fontWeight: '900', border: 'none' }}>BACK TO LOBBY</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #D4AF3744; border-radius: 10px; }
      `}</style>
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GameContent />
    </Suspense>
  );
}
