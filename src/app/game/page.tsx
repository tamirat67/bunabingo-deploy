'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getGame, getMyCard, claimBingo } from '../../lib/api';
import { useSocket } from '../../context/SocketContext';
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
  const { T, activeThemeKey } = useTheme();
  const sp      = useSearchParams();
  const gameId  = sp.get('id');
  const { socket } = useSocket();

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
  const [endTime,   setEndTime]   = useState<number | null>(null);
  const [serverOff, setServerOff] = useState(0);
  const [marked,    setMarked]    = useState<Set<number>>(new Set());
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const toastTimer = useRef<any>(null);

  useEffect(() => {
    setMounted(true);
    
    // Load local sound preference
    const savedSound = localStorage.getItem('game_sound');
    if (savedSound !== null) setSoundOn(savedSound === 'true');

    if (!gameId) return;

    const loadData = () => {
      Promise.all([getGame(gameId), getMyCard(gameId)]).then(([g, t]) => {
        setGame(g);
        if (g.endTime && g.serverTime) {
          setServerOff(g.serverTime - Date.now());
          setEndTime(g.endTime);
        }
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

    // ─── Socket.io Handlers (VPS) ───
    if (socket) {
      socket.emit('join-game', gameId);
      
      socket.on('number-drawn', (d: { number: number }) => {
        const num = Number(d.number);
        setDrawn(p => p.includes(num) ? p : [...p, num]);
        setLastBall(num);
        setToast(`${colLabel(num)} ${num}`);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 2500);
        if (localStorage.getItem('game_sound') !== 'false') {
          new Audio(`/audio/${colLabel(num)}${num}.mp3`).play().catch(() => {});
        }
      });

      socket.on('countdown-start', (d: any) => {
        setCountdown(d.seconds);
        if (d.endTime && d.serverTime) {
          setServerOff(d.serverTime - Date.now());
          setEndTime(d.endTime);
        }
      });

      socket.on('countdown-tick', (d: any) => {
        setCountdown(d.secondsRemaining);
      });

      socket.on('game-update', (d: any) => {
        setGame((p: any) => p ? { ...p, ...d } : p);
      });
    }

    return () => { 
      if (socket) {
        socket.emit('leave-game', gameId);
        socket.off('number-drawn');
        socket.off('countdown-start');
        socket.off('countdown-tick');
        socket.off('game-update');
      }
      if (toastTimer.current) clearTimeout(toastTimer.current); 
    };
  }, [gameId, mounted, soundOn]);

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

  const isCalled   = (n: number) => drawn.includes(n);
  const isMarkedLocal = (n: number) => marked.has(n);
  
  const toggleMark = (n: number) => {
    if (typeof n !== 'number' || n === 0) return;
    setMarked(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  const hideCard   = (id: string) => setHidden(p => new Set([...p, id]));
  const handleBingo = async () => {
    if (!gameId) return;
    try { 
      const res = await claimBingo(gameId);
      if (res.won) {
        if (localStorage.getItem('game_sound') !== 'false') {
          const audio = new Audio('/audio/stop.mp3');
          audio.play().catch(e => console.warn('Bingo win audio play failed:', e));
        }
        setToast(`🎊 BINGO! ${res.mode} (+${res.prize} ETB)`);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 4000);
      } else {
        alert(res.error || 'No Bingo detected yet! Check your patterns.');
      }
    }
    catch (e: any) { 
      alert(e.response?.data?.error || 'No Bingo yet! Keep playing.'); 
    }
  };

  if (!mounted) return null;

  const isSpin  = game?.room?.type?.startsWith('SPIN_');
  const stake   = Number(game?.room?.ticketPrice || 10);
  const prize   = (game?.totalPrize && Number(game.totalPrize) > 0) 
                  ? Number(game.totalPrize) 
                  : Math.max(80, (tickets.length || 1) * stake * 0.8);
  const cdText  = countdown !== null ? `${countdown}s` : (game?.status === 'WAITING' ? 'WAIT' : 'LIVE');
  const visible = tickets.filter(t => !hidden.has(t.id));

  const checkAnyBingo = () => {
    if (drawn.length === 0) return false;
    const drawnSet = new Set(drawn);
    for (const t of tickets) {
      if (hidden.has(t.id)) continue;
      const rows = t.card?.rows ?? [];
      if (rows.length === 0) continue;
      
      const isMarked = (r: number, c: number) => {
        const val = rows[r][c];
        const numVal = Number(val);
        return val === 'FREE' || val === 0 || val === null || (drawnSet.has(numVal) && marked.has(numVal));
      };

      for (let r = 0; r < 5; r++) if ([0,1,2,3,4].every(c => isMarked(r, c))) return true;
      for (let c = 0; c < 5; c++) if ([0,1,2,3,4].every(r => isMarked(r, c))) return true;
      if ([0,1,2,3,4].every(i => isMarked(i, i))) return true;
      if ([0,1,2,3,4].every(i => isMarked(i, 4-i))) return true;
      if (isMarked(0,0) && isMarked(0,4) && isMarked(4,0) && isMarked(4,4)) return true;
    }
    return false;
  };

  const hasBingo = checkAnyBingo();

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: '180px', fontFamily: "'Segoe UI', sans-serif", overflowX: 'hidden' }}>

      {/* ── Buna Game Zone Header ── */}
      <div style={{ background: T.header, padding: '12px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `3px solid ${T.gold}`, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ color: T.gold, fontWeight: '900', fontSize: '18px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={20} /> BUNA GAME ZONE
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ background: game?.status === 'RUNNING' ? '#27AE60' : '#E67E22', color: 'white', fontSize: '10px', fontWeight: '900', padding: '3px 10px', borderRadius: '20px' }}>
            {game?.status || 'LOADING'}
          </div>
          <div onClick={() => {
            const next = !soundOn;
            setSoundOn(next);
            localStorage.setItem('game_sound', String(next));
          }} style={{ color: soundOn ? T.gold : T.brown, cursor: 'pointer' }}>
            {soundOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', padding: '8px', background: T.statBg, borderBottom: `1px solid ${T.gold}44` }}>
        {[
          ['GAME ID', gameId?.slice(-6).toUpperCase() || '--'],
          ['PLAYERS', game?.currentPlayers || game?.tickets?.length || (tickets.length > 0 ? tickets.length : '-')],
          ['STAKE', `${stake} ETB`],
          ['POOL', `${prize} ETB`]
        ].map(([l, v]) => (
          <div key={l as string} style={{ background: T.card, border: `1px solid ${T.gold}33`, padding: '6px 4px', textAlign: 'center', borderRadius: '8px' }}>
            <div style={{ fontSize: '8px', fontWeight: 'bold', color: T.brown }}>{l}</div>
            <div style={{ fontSize: '12px', fontWeight: '900', color: T.header }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', padding: '10px', alignItems: 'flex-start' }}>
        {/* Master Board (Left) */}
        <div style={{ flex: '0 0 52%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1, background: game?.status === 'RUNNING' ? '#27AE60' : T.header, borderRadius: '14px', padding: '10px', textAlign: 'center', border: `2px solid ${T.gold}`, transition: 'background 0.3s' }}>
              <div style={{ color: T.gold, fontSize: '9px', fontWeight: '900' }}>COUNT DOWN</div>
              <div style={{ color: 'white', fontSize: '24px', fontWeight: '900' }}>{cdText}</div>
            </div>
            <motion.div key={lastBall} initial={{ scale: 0.5 }} animate={{ scale: 1 }} style={{ width: '65px', height: '65px', background: lastBall ? COL_COLOR[colLabel(lastBall)] : T.statBg, borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: '900', border: `4px solid ${T.gold}`, color: lastBall ? 'white' : T.brown }}>
              {lastBall ? (
                <>
                  <div style={{ fontSize: '14px', lineHeight: 1 }}>{colLabel(lastBall)}</div>
                  <div style={{ fontSize: '24px', lineHeight: 1 }}>{lastBall}</div>
                </>
              ) : '•'}
            </motion.div>
          </div>

          <div style={{ background: T.card, borderRadius: '14px', padding: '10px', border: `1px solid ${T.gold}44` }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px', marginBottom: '6px' }}>
              {['B','I','N','G','O'].map(l => (
                <div key={l} style={{ background: COL_COLOR[l], color: 'white', textAlign: 'center', fontSize: '13px', fontWeight: '900', borderRadius: '6px', padding: '4px 0' }}>{l}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px' }}>
              {Array.from({ length: 15 }, (_, i) => COL_RANGES.map(col => {
                const n = col.s + i;
                return (
                  <div key={n} style={{
                    background: isCalled(n) ? COL_COLOR[col.l] : T.statBg,
                    color:      isCalled(n) ? 'white' : T.text,
                    fontSize: '10px', fontWeight: '900', textAlign: 'center', padding: '5.5px 0', borderRadius: '4px'
                  }}>{n}</div>
                );
              }))}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ color: T.header, fontWeight: '900', fontSize: '13px', padding: '0 5px' }}>
            🏆 YOUR CARTELAS ({visible.length})
          </div>
          {visible.map((t: any) => {
            const cardObj = t.card as { id: number; rows: any[][] };
            const rows = cardObj?.rows ?? [];
            const cardId = cardObj?.id ?? '?';
            const isSelected = selectedTicketId === t.id;
            
            return (
              <motion.div 
                layout 
                key={t.id} 
                onClick={() => setSelectedTicketId(t.id)}
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1, scale: isSelected ? 1.02 : 1 }} 
                style={{ 
                  position: 'relative', 
                  background: T.card, 
                  borderRadius: '16px', 
                  overflow: 'hidden', 
                  border: isSelected ? `3px solid ${T.gold}` : `2px solid ${T.gold}55`, 
                  boxShadow: isSelected ? `0 8px 20px ${T.gold}44` : '0 4px 10px rgba(0,0,0,0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <button onClick={(e) => { e.stopPropagation(); hideCard(t.id); }} style={{ position: 'absolute', top: '4px', right: '5px', width: '20px', height: '20px', background: '#C0392B', color: 'white', border: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}><X size={10} /></button>
                <div style={{ background: isSelected ? T.gold : T.header, padding: '4px 10px', color: isSelected ? T.header : T.gold, fontWeight: '900', fontSize: '11px' }}>
                   Cartela #{cardId} {isSelected ? '(SELECTED)' : ''}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px', padding: '5px' }}>
                  {['B','I','N','G','O'].map(l => (
                    <div key={l} style={{ background: COL_COLOR[l], color: 'white', textAlign: 'center', fontSize: '10px', fontWeight: '900', padding: '2px 0', borderRadius: '4px' }}>{l}</div>
                  ))}
                  {rows.map((row: any[], ri: number) => row.map((cell: any, ci: number) => {
                      const numVal = Number(cell);
                      const isFree = cell === 'FREE' || cell === 0 || cell === null;
                      const userMarked = !isFree && marked.has(numVal);
                      const callMarked = !isFree && isCalled(numVal);
                      const isHinted   = callMarked && !userMarked;
                      const colKey     = colLabel(numVal);
                      
                      return (
                        <div 
                          key={`${ri}-${ci}`} 
                          onClick={(e) => { e.stopPropagation(); if (!isFree) toggleMark(numVal); }}
                          style={{ 
                            height: '26px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            borderRadius: '4px', 
                            fontSize: '11px', 
                            fontWeight: '900', 
                            background: isFree ? '#27AE60' : userMarked ? T.gold : (isHinted ? '#E67E22' : T.statBg), 
                            color: (isFree || isHinted) ? 'white' : (userMarked ? T.header : T.text), 
                            border: userMarked ? `3px solid white` : (isHinted ? `2px solid white` : 'none'),
                            position: 'relative',
                            overflow: 'hidden',
                            boxShadow: isHinted ? `0 0 10px rgba(230, 126, 34, 0.6)` : 'none',
                            transition: 'all 0.3s ease'
                          }}
                        >
                          {isFree ? '★' : cell}
                          
                          {/* Animated hint indicator for new balls */}
                          {isHinted && lastBall === numVal && (
                            <motion.div 
                              initial={{ scale: 0, opacity: 0 }} 
                              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }} 
                              transition={{ repeat: Infinity, duration: 1.5 }}
                              style={{ 
                                position: 'absolute', 
                                width: '100%', 
                                height: '100%', 
                                background: COL_COLOR[colKey], 
                                borderRadius: '4px',
                                zIndex: 0
                              }} 
                            />
                          )}

                          {userMarked && (
                             <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ position: 'absolute', width: '80%', height: '80%', border: `2px solid ${T.header}`, borderRadius: '50%', opacity: 0.5 }} />
                          )}
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

      {/* ── Fixed Footer Action Bar (Floating above Navbar) ── */}
      {(game?.status === 'RUNNING' || game?.status === 'COUNTDOWN' || game?.status === 'WAITING') && (
        <div style={{ position: 'fixed', bottom: '95px', left: '16px', right: '16px', background: T.card, padding: '10px', borderRadius: '24px', border: `1px solid ${T.gold}44`, zIndex: 1000, boxShadow: '0 10px 30px rgba(0,0,0,0.3)', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => window.location.reload()} style={{ width: '45px', height: '45px', background: T.header, color: T.gold, border: `1px solid ${T.gold}55`, borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><RefreshCw size={20} /></button>
          
          <motion.button
            whileTap={game?.status === 'RUNNING' ? { scale: 0.95 } : {}}
            animate={hasBingo ? { scale: [1, 1.03, 1], boxShadow: ['0 0 0px #FFD700', '0 0 20px #FFD700', '0 0 0px #FFD700'] } : {}}
            transition={hasBingo ? { repeat: Infinity, duration: 1.5 } : {}}
            onClick={handleBingo}
            disabled={game?.status !== 'RUNNING'}
            style={{ 
              flex: 1,
              background: game?.status === 'RUNNING' ? (hasBingo ? 'linear-gradient(135deg, #F1C40F, #E67E22)' : `linear-gradient(135deg, ${T.gold}, ${T.goldDk})`) : 'rgba(150,150,150,0.08)', 
              color: game?.status === 'RUNNING' ? T.header : (activeThemeKey === 'GOLDEN' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.25)'), 
              height: '45px', 
              borderRadius: '15px', 
              fontWeight: '900', 
              fontSize: '18px', 
              textAlign: 'center', 
              cursor: game?.status === 'RUNNING' ? 'pointer' : 'not-allowed', 
              border: game?.status === 'RUNNING' ? `1px solid ${T.goldDk}` : 'none', 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            ☕ BINGO! <span style={{ fontSize: '11px', opacity: (activeThemeKey === 'GOLDEN' ? 0.3 : 0.5) }}>({prize} ETB)</span>
          </motion.button>

          <button onClick={() => router.push('/')} style={{ width: '45px', height: '45px', background: '#C0392B', color: 'white', border: 'none', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LogOut size={20} /></button>
        </div>
      )}

      {/* ── Add Board FAB (Shifted up to avoid footer) ── */}
      <motion.div whileTap={{ scale: 0.9 }} onClick={() => router.push(`/tickets/select?type=${game?.room?.type || 'STANDARD'}&price=${stake}`)} style={{ position: 'fixed', bottom: '100px', right: '15px', background: T.header, color: T.gold, padding: '12px 18px', borderRadius: '30px', fontWeight: '900', fontSize: '13px', boxShadow: '0 8px 20px rgba(0,0,0,0.2)', zIndex: 200, cursor: 'pointer', border: `2px solid ${T.gold}` }}>
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

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #D4AF3744; border-radius: 10px; }
      `}} />
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
