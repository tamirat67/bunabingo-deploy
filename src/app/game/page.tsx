'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getGame, getMyCard, pusherAuth, claimBingo } from '../../lib/api';
import Pusher from 'pusher-js';
import { Volume2, VolumeX, RefreshCw, LogOut, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PURPLE   = '#7B5EA7';
const PURPLE_L = '#9B7FCC';
const PURPLE_D = '#5A3E8A';
const BG       = '#8B6BB1';

const BINGO_COLORS: Record<string, string> = {
  B: '#F4D03F', I: '#2ECC71', N: '#5DADE2', G: '#E74C3C', O: '#9B59B6',
};
const COL_RANGES = [
  { l: 'B', s: 1,  e: 15  },
  { l: 'I', s: 16, e: 30  },
  { l: 'N', s: 31, e: 45  },
  { l: 'G', s: 46, e: 60  },
  { l: 'O', s: 61, e: 75  },
];
function colLabel(n: number) {
  if (n <= 15) return 'B'; if (n <= 30) return 'I';
  if (n <= 45) return 'N'; if (n <= 60) return 'G'; return 'O';
}

function GameContent() {
  const router      = useRouter();
  const sp          = useSearchParams();
  const gameId      = sp.get('id');

  const [game,      setGame]      = useState<any>(null);
  const [tickets,   setTickets]   = useState<any[]>([]);
  const [drawn,     setDrawn]     = useState<number[]>([]);
  const [lastBall,  setLastBall]  = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [soundOn,   setSoundOn]   = useState(false);   // default muted like screenshot
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
    const pusher  = new Pusher(pk, {
      cluster: pc,
      authorizer: ch => ({ authorize: (sid, cb) => pusherAuth(sid, ch.name).then(d => cb(null, d)).catch(e => cb(e, null)) }),
    });
    const ch = pusher.subscribe(`private-game-${gameId}`);

    ch.bind('number-drawn', (d: { number: number }) => {
      setLastBall(d.number);
      setDrawn(p => [...p, d.number]);
      setCountdown(null);
      if (soundOn && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(`${colLabel(d.number)} ${d.number}`); u.rate = 0.9;
        window.speechSynthesis.speak(u);
      }
    });
    ch.bind('countdown-start', (d: { seconds: number }) => setCountdown(d.seconds));
    ch.bind('game-update', (d: any) => {
      if (d.status === 'FINISHED') setWinMsg(d.winners?.[0] ? `Card #${d.winners[0].ticket?.card?.id} WON!` : 'Game Over');
      setGame((p: any) => p ? { ...p, ...d } : p);
    });

    return () => { ch.unbind_all(); pusher.disconnect(); };
  }, [gameId, mounted]);

  const isCalled  = (n: number) => drawn.includes(n);
  const hideCard  = (id: string) => setHidden(p => new Set([...p, id]));
  const handleBingo = async (tid: string, prize: number) => {
    if (!gameId) return;
    try {
      await claimBingo(gameId);
      alert('🎉 BINGO CLAIMED!');
    } catch (e: any) {
      alert(e.response?.data?.error || 'No Bingo yet! Keep playing.');
    }
  };

  if (!mounted) return null;

  const stake  = game?.room?.ticketPrice || 0;
  const cdText = countdown !== null ? countdown : (game?.status === 'WAITING' ? 'Wait' : 'Live');
  const visibleTickets = tickets.filter(t => !hidden.has(t.id));

  return (
    <div style={{ background: BG, minHeight: '100vh', paddingBottom: '80px', fontFamily: 'sans-serif', color: 'white' }}>

      {/* ── Top Stats Bar ── */}
      <div style={{ display: 'flex', gap: '2px', padding: '4px', background: 'rgba(0,0,0,0.15)', overflowX: 'auto' }}>
        {[
          ['Game', gameId?.slice(-6).toUpperCase() || '--'],
          ['Derash', '-'],
          ['Bonus', 'Off'],
          ['Players', game?.currentPlayers ?? '-'],
          ['Stake', stake],
          ['Call', drawn.length],
        ].map(([l, v]) => (
          <div key={l as string} style={{ flex: '0 0 auto', background: 'rgba(255,255,255,0.15)', borderRadius: '6px', padding: '4px 8px', textAlign: 'center', minWidth: '52px' }}>
            <div style={{ fontSize: '8px', opacity: 0.7, fontWeight: 'bold' }}>{l}</div>
            <div style={{ fontSize: '11px', fontWeight: '900' }}>{v}</div>
          </div>
        ))}
        <div onClick={() => setSoundOn(p => !p)} style={{ flex: '0 0 auto', background: 'rgba(255,255,255,0.15)', borderRadius: '6px', padding: '4px 8px', textAlign: 'center', minWidth: '48px', cursor: 'pointer' }}>
          <div style={{ fontSize: '8px', opacity: 0.7, fontWeight: 'bold' }}>Sound</div>
          <div style={{ fontSize: '11px' }}>{soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}</div>
        </div>
      </div>

      {/* ── Main 2-Column Layout ── */}
      <div style={{ display: 'flex', gap: '6px', padding: '6px', alignItems: 'flex-start' }}>

        {/* ═══ LEFT COLUMN ═══ */}
        <div style={{ flex: '0 0 42%', display: 'flex', flexDirection: 'column', gap: '6px' }}>

          {/* Count Down + Last Ball */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch' }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.2)', borderRadius: '10px', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', fontWeight: 'bold', opacity: 0.8 }}>Count Down</div>
              <div style={{ fontSize: '22px', fontWeight: '900' }}>{cdText}</div>
            </div>
            <div style={{ width: '52px', height: '52px', background: lastBall ? BINGO_COLORS[colLabel(lastBall)] : 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '20px', border: '3px solid white', flexShrink: 0, alignSelf: 'center', transition: 'all 0.3s' }}>
              {lastBall ?? '-'}
            </div>
          </div>

          {/* Pill indicator */}
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '20px', height: '10px', margin: '0 10px' }} />

          {/* B I N G O Circles */}
          <div style={{ display: 'flex', justifyContent: 'space-around', padding: '2px 0' }}>
            {['B','I','N','G','O'].map(l => (
              <div key={l} style={{ width: '34px', height: '34px', background: BINGO_COLORS[l], borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '16px', boxShadow: '0 3px 6px rgba(0,0,0,0.3)' }}>{l}</div>
            ))}
          </div>

          {/* Master Board 1-75 */}
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '10px', padding: '6px', overflow: 'hidden' }}>
            {/* column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px', marginBottom: '4px' }}>
              {COL_RANGES.map(c => (
                <div key={c.l} style={{ background: BINGO_COLORS[c.l], color: 'white', textAlign: 'center', fontSize: '11px', fontWeight: '900', borderRadius: '4px', padding: '2px 0' }}>{c.l}</div>
              ))}
            </div>
            {/* numbers — 15 rows × 5 cols */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px' }}>
              {COL_RANGES.map(col =>
                Array.from({ length: 15 }, (_, i) => col.s + i).map(n => (
                  <div key={n} style={{
                    background: isCalled(n) ? BINGO_COLORS[col.l] : 'rgba(255,255,255,0.15)',
                    color: isCalled(n) ? 'white' : 'rgba(255,255,255,0.5)',
                    fontSize: '10px', fontWeight: '900', textAlign: 'center', padding: '3px 0', borderRadius: '3px',
                    transition: 'all 0.3s',
                  }}>
                    {n}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Refresh + Leave */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => window.location.reload()} style={{ flex: 1, background: '#5DADE2', color: 'white', border: 'none', padding: '10px', borderRadius: '25px', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer' }}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={() => router.push('/')} style={{ flex: 1, background: '#E74C3C', color: 'white', border: 'none', padding: '10px', borderRadius: '25px', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer' }}>
              <LogOut size={14} /> Leave
            </button>
          </div>
        </div>

        {/* ═══ RIGHT COLUMN: Scrollable Cards ═══ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '80vh', overflowY: 'auto', paddingRight: '2px' }}>
          {visibleTickets.map((t: any) => {
            const rows: any[][] = Array.isArray(t.card) ? t.card : (t.card?.rows ?? []);
            const cardId = t.cardId ?? t.card?.id ?? '?';
            const prize  = stake * 8;

            return (
              <div key={t.id} style={{ position: 'relative' }}>
                {/* Remove Card X button */}
                <button onClick={() => hideCard(t.id)} style={{ position: 'absolute', top: '-6px', right: '-6px', width: '22px', height: '22px', background: '#E74C3C', color: 'white', border: '2px solid white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, padding: 0 }}>
                  <X size={12} />
                </button>

                {/* 5×5 Card Grid */}
                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '12px', padding: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                    {rows.map((row: any[], ri: number) =>
                      row.map((cell: any, ci: number) => {
                        const isFree   = cell === 0 || cell === 'FREE';
                        const isMarked = !isFree && isCalled(Number(cell));
                        return (
                          <motion.div
                            key={`${ri}-${ci}`}
                            animate={isMarked ? { scale: [1, 1.1, 1] } : {}}
                            style={{
                              height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              borderRadius: '6px', fontSize: '14px', fontWeight: '900',
                              background: isFree ? '#2E7D32' : isMarked ? '#1B5E20' : 'white',
                              color:      isFree ? 'white'   : isMarked ? 'white'   : '#333',
                              boxShadow:  isMarked ? 'inset 0 0 0 2px #4CAF50' : 'none',
                              transition: 'background 0.3s',
                            }}
                          >
                            {isFree ? '★' : cell}
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* BINGO Button */}
                <button onClick={() => handleBingo(t.id, prize)} style={{ width: '100%', marginTop: '6px', background: '#FF6B35', color: 'white', border: 'none', padding: '12px', borderRadius: '25px', fontWeight: '900', fontSize: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', cursor: 'pointer', letterSpacing: '1px' }}>
                  BINGO! ({prize})
                </button>
              </div>
            );
          })}

          {tickets.length === 0 && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '30px', fontSize: '14px' }}>Waiting for card data...</div>
          )}

          {/* Add Board button at bottom of cards list */}
          <div style={{ height: '10px' }} />
        </div>
      </div>

      {/* Floating Add Board */}
      <div
        onClick={() => router.push(`/tickets/select?type=${game?.room?.type || 'STANDARD'}&price=${stake}`)}
        style={{ position: 'fixed', bottom: '90px', right: '15px', background: '#FF6B35', color: 'white', padding: '12px 20px', borderRadius: '30px', fontWeight: '900', fontSize: '14px', boxShadow: '0 5px 15px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 200, cursor: 'pointer' }}
      >
        Add Board <Plus size={18} />
      </div>

      {/* Win Overlay */}
      <AnimatePresence>
        {winMsg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} style={{ background: 'white', borderRadius: '24px', padding: '40px 30px', textAlign: 'center', maxWidth: '280px' }}>
              <div style={{ fontSize: '60px' }}>🏆</div>
              <div style={{ color: PURPLE_D, fontSize: '22px', fontWeight: '900', margin: '10px 0 20px' }}>{winMsg}</div>
              <button onClick={() => router.push('/')} style={{ background: PURPLE, color: 'white', border: 'none', padding: '12px 30px', borderRadius: '12px', fontWeight: '900', fontSize: '14px', cursor: 'pointer' }}>BACK TO LOBBY</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div style={{ background: BG, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '18px', fontWeight: 900 }}>Loading...</div>}>
      <GameContent />
    </Suspense>
  );
}
