'use client';
import { useEffect, useState, useRef, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getGame, getMyCard, claimBingo } from '../../lib/api';
import { useSocket } from '../../context/SocketContext';
import BunaModal from '../../components/BunaModal';
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
  const [tickets,   setTickets]   = useState<any[]>(() => {
    if (typeof window !== 'undefined' && gameId) {
      const cached = sessionStorage.getItem(`game_tickets_${gameId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          return parsed.sort((a: any, b: any) => (a.card?.id || 0) - (b.card?.id || 0));
        } catch (e) {}
      }
    }
    return [];
  });

  const spType  = sp.get('type') || '';
  const spPrice = sp.get('price');

  const isDemo  = game ? (game?.room?.type === 'DEMO') : (spType === 'DEMO');
  const isSpin  = game ? (game?.room?.type?.startsWith('SPIN_')) : (spType.startsWith('SPIN_'));
  const stake   = game 
    ? (isDemo ? 0 : Number(game?.room?.ticketPrice || 10)) 
    : (spPrice ? Number(spPrice) : 10);
  const isVip   = game 
    ? (game?.room?.type === 'VIP' || game?.room?.type === 'JACKPOT' || stake >= 100)
    : (spType === 'VIP' || spType === 'JACKPOT' || stake >= 100);

  const fabBg = isVip 
    ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #C471ED 100%)' 
    : 'radial-gradient(circle at 35% 35%, #34c759 0%, #248a3d 70%, #155224 130%)';
  const fabBorder = isVip ? '#FFD700' : '#155224';
  const fabInnerRing = isVip ? 'rgba(255, 255, 255, 0.6)' : '#34c75988';
  const fabPlusColor = isVip ? '#1C0A35' : '#ffffff';
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
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(true);

  const toastTimer = useRef<any>(null);
  const lastStartAudioPlayed = useRef<number>(0);

  const playStartAudio = useCallback(() => {
    if (localStorage.getItem('game_sound') === 'false') return;
    const now = Date.now();
    if (now - lastStartAudioPlayed.current < 2500) return;
    lastStartAudioPlayed.current = now;
    
    const startAudio = document.getElementById('audio-start') as HTMLAudioElement;
    if (startAudio) {
      startAudio.currentTime = 0;
      startAudio.play().catch(e => console.warn('Start sound blocked:', e));
    }
  }, []);

  // Modal State
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'error' | 'success' | 'confirm' | 'balance';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showAlert = (title: string, message: string, type: any = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  const loadData = useCallback(() => {
    if (!gameId) return;
    Promise.all([getGame(gameId), getMyCard(gameId)]).then(([g, t]) => {
      setGame(g);
      if (g.endTime && g.serverTime) {
        const offset = g.serverTime - Date.now();
        setServerOff(offset);
        setEndTime(g.endTime);
        // Also set a direct countdown as backup
        if (g.status === 'COUNTDOWN') {
          const rem = Math.max(0, Math.ceil((g.endTime - Date.now() - offset) / 1000));
          if (rem > 0) setCountdown(rem);
        }
      } else if (g.status === 'COUNTDOWN' && g.countdownSeconds) {
        const estimatedEnd = Date.now() + (g.countdownSeconds * 1000);
        setEndTime(estimatedEnd);
        setServerOff(0);
        setCountdown(g.countdownSeconds);
      }
      const sorted = (t.tickets || []).sort((a: any, b: any) => (a.card?.id || 0) - (b.card?.id || 0));
      setTickets(sorted);
      const hist = (g.drawHistory || []).map((d: any) => d.number);
      setDrawn(hist);
      setLastBall(hist.at(-1) ?? null);
    }).catch(console.error);
  }, [gameId]);

  useEffect(() => {
    setMounted(true);
    
    // Load local sound preference
    const savedSound = localStorage.getItem('game_sound');
    if (savedSound !== null) setSoundOn(savedSound === 'true');

    if (!gameId) return;

    loadData();
    // Retry after 1.5s to catch countdown state that may not be set yet
    // when the server's startCountdown() runs after joinGame() returns
    const retryTimer = setTimeout(loadData, 1500);

    // ─── Socket.io Handlers (VPS) ───
    if (socket) {
      socket.emit('join-game', gameId);
      
      socket.on('number-drawn', (d: { number: number }) => {
        const num = Number(d.number);
        setDrawn(p => p.includes(num) ? p : [...p, num]);
        setLastBall(num);
        if (soundOn) {
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
        // Play start sound exactly when countdown hits 0
        if (d.secondsRemaining === 0) {
          playStartAudio();
        }
      });

      socket.on('game-started', () => {
        loadData();
        playStartAudio();
      });

      socket.on('game-finished', (d: any) => {
        loadData();
        if (d.winners && d.winners.length > 0) {
          const w = d.winners[0];
          const name = w.user?.firstName || w.user?.telegramUsername || 'A player';
          setWinMsg(`${name} won ${w.prizeAmount} ETB! (${w.winMode})`);
          if (localStorage.getItem('game_sound') !== 'false') {
            const stopAudio = document.getElementById('audio-stop') as HTMLAudioElement;
            if (stopAudio) stopAudio.play().catch(e => console.warn('Stop sound blocked:', e));
          }
        }
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
        socket.off('game-started');
        socket.off('game-finished');
        socket.off('game-update');
      }
      if (toastTimer.current) clearTimeout(toastTimer.current);
      clearTimeout(retryTimer);
    };
  }, [gameId, mounted, soundOn, loadData, socket]);

  // Local countdown fallback for smoothness
  useEffect(() => {
    if (endTime === null) return;
    const timer = setInterval(() => {
      const now = Date.now() + serverOff;
      const rem = Math.max(0, Math.ceil((endTime - now) / 1000));
      setCountdown(rem);
      if (rem <= 0) {
        playStartAudio();
        setEndTime(null);
        setTimeout(loadData, 500);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [endTime, serverOff, loadData]);

  // ─── Polling: re-fetch state while waiting for game to start ───────────────
  // Catches countdown events missed due to race between joinGame() returning
  // and startCountdown() completing on the backend.
  useEffect(() => {
    const status = game?.status;
    if (status !== 'WAITING' && status !== 'COUNTDOWN') return;
    // Poll every 2s until game is RUNNING
    const poll = setInterval(() => {
      loadData();
    }, 2000);
    return () => clearInterval(poll);
  }, [game?.status, loadData]);

  const isCalled   = (n: number) => drawn.includes(n);
  const isMarkedLocal = (n: number) => marked.has(n);
  
  const toggleMark = (n: number) => {
    if (!audioUnlocked) unlockAudio();
    if (typeof n !== 'number' || n === 0) return;
    setMarked(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  const unlockAudio = () => {
    if (audioUnlocked) return;
    try {
      const startAudio = document.getElementById('audio-start') as HTMLAudioElement;
      const stopAudio = document.getElementById('audio-stop') as HTMLAudioElement;
      
      if (startAudio) {
        startAudio.play().then(() => {
          startAudio.pause();
          startAudio.currentTime = 0;
        }).catch(() => {});
      }
      if (stopAudio) {
        stopAudio.play().then(() => {
          stopAudio.pause();
          stopAudio.currentTime = 0;
        }).catch(() => {});
      }
      setAudioUnlocked(true);
      console.log('DOM Audio explicitly unlocked for mobile');
    } catch (e) {
      console.warn('Audio unlock failed:', e);
    }
  };

  const hideCard   = (id: string) => setHidden(p => new Set([...p, id]));
  const handleBingo = async () => {
    if (!gameId) return;
    try { 
      const res = await claimBingo(gameId);
      if (res.won) {
        setToast(`🎊 BINGO! ${res.mode} (+${res.prize} ETB)`);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 4000);
      } else {
        showAlert('Bingo Claim', res.error || 'No Bingo detected yet! Check your patterns.', 'info');
      }
    }
    catch (e: any) { 
      showAlert('Error', e.response?.data?.error || 'No Bingo yet! Keep playing.', 'error'); 
    }
  };

  if (!mounted) return null;

  const prize   = isDemo 
                  ? (game?.totalPrize ? Number(game.totalPrize) : 100) 
                  : ((game?.totalPrize && Number(game.totalPrize) > 0) 
                      ? Number(game.totalPrize) 
                      : Math.max(80, (tickets.length || 1) * stake * 0.75));
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
    <div 
      onClick={unlockAudio}
      style={{
        background: isVip ? 'radial-gradient(circle at top, #2D1442 0%, #1C0A35 60%, #0F041A 100%)' : T.bg,
        minHeight: '100vh',
        paddingBottom: '180px',
        fontFamily: "'Segoe UI', sans-serif",
        overflowX: 'hidden',
        color: isVip ? '#FFFFFF' : T.text
      }}
    >
      <audio id="audio-start" src="/audio/start.mp3" preload="auto" />
      <audio id="audio-stop" src="/audio/stop.mp3" preload="auto" />

      {/* ── Buna Game Zone Header ── */}
      <div style={{ background: isVip ? '#1C0A35' : T.header, padding: '12px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: isVip ? `3px solid #FFD700` : `3px solid ${T.gold}`, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ color: isVip ? '#C471ED' : T.gold, fontWeight: '900', fontSize: '18px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <ShieldCheck size={20} color={isVip ? '#C471ED' : T.gold} /> BUNA GAME ZONE
          {isVip && (
            <span style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#1C0A35', fontSize: '9px', fontWeight: '900', padding: '2px 8px', borderRadius: '12px', boxShadow: '0 0 10px rgba(255, 215, 0, 0.6)', display: 'inline-flex', alignItems: 'center', gap: '3px', border: '1.5px solid #FFF', letterSpacing: '0.5px' }}>
              👑 BOSS VIP
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ background: game?.status === 'RUNNING' ? '#27AE60' : '#E67E22', color: 'white', fontSize: '10px', fontWeight: '900', padding: '3px 10px', borderRadius: '20px' }}>
            {game?.status || 'LOADING'}
          </div>
          {/* Auto / Manual Mode Toggle */}
          <motion.div 
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsAutoMode(!isAutoMode)}
            style={{
              background: isAutoMode ? 'linear-gradient(135deg, #27AE60, #2ECC71)' : '#7F8C8D',
              color: 'white',
              fontSize: '10px',
              fontWeight: '900',
              padding: '4.5px 12px',
              borderRadius: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
              userSelect: 'none'
            }}
          >
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white' }}></div>
            <span>{isAutoMode ? 'AUTO' : 'MAN'}</span>
          </motion.div>
          <motion.div 
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              const next = !soundOn;
              setSoundOn(next);
              localStorage.setItem('game_sound', String(next));
              if (!audioUnlocked) unlockAudio();
            }} 
            style={{ 
              background: 'rgba(0,0,0,0.2)', 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: soundOn ? (isVip ? '#FFD700' : T.gold) : '#7F8C8D', 
              cursor: 'pointer',
              border: `1px solid ${soundOn ? (isVip ? '#FFD700' : T.gold) : '#7F8C8D'}44`
            }}
          >
            {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </motion.div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', padding: '8px', background: isVip ? 'rgba(255,255,255,0.02)' : T.statBg, borderBottom: isVip ? '1px solid rgba(255,215,0,0.2)' : `1px solid ${T.gold}44` }}>
        {[
          ['GAME ID', gameId?.slice(-6).toUpperCase() || '--'],
          ['PLAYERS', game?.currentPlayers || game?.tickets?.length || (tickets.length > 0 ? tickets.length : '-')],
          ['STAKE', `${stake} ETB`],
          ['POOL', `${prize} ETB`]
        ].map(([l, v]) => {
          const isStake = l === 'STAKE';
          return (
            <div key={l as string} style={{ 
              background: isVip 
                ? (isStake ? 'linear-gradient(90deg, #FFD700, #FFA500)' : 'rgba(255, 255, 255, 0.05)') 
                : T.card, 
              border: isVip 
                ? (isStake ? 'none' : '1px solid rgba(255, 215, 0, 0.25)') 
                : `1px solid ${T.gold}33`, 
              padding: '6px 4px', 
              textAlign: 'center', 
              borderRadius: '8px',
              backdropFilter: isVip && !isStake ? 'blur(10px)' : 'none',
              boxShadow: isVip && isStake ? '0 4px 15px rgba(255, 215, 0, 0.3)' : 'none',
            }}>
              <div style={{ 
                fontSize: '8px', 
                fontWeight: 'bold', 
                color: isVip 
                  ? (isStake ? 'rgba(28, 10, 53, 0.7)' : '#FFD700') 
                  : T.brown 
              }}>{l}</div>
              <div style={{ 
                fontSize: '12px', 
                fontWeight: '900', 
                color: isVip 
                  ? (isStake ? '#1C0A35' : 'white') 
                  : T.text 
              }}>{v}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '10px', padding: '10px', alignItems: 'flex-start' }}>
        {/* Master Board (Left) */}
        <div style={{ flex: '0 0 52%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ 
              flex: 1, 
              background: game?.status === 'RUNNING' ? '#27AE60' : (isVip ? 'rgba(255,255,255,0.05)' : T.header), 
              borderRadius: '14px', 
              padding: '10px', 
              textAlign: 'center', 
              border: isVip ? '2px solid #FFD700' : `2px solid ${T.gold}`, 
              transition: 'background 0.3s',
              boxShadow: isVip ? '0 0 10px rgba(255, 215, 0, 0.2)' : 'none'
            }}>
              <div style={{ color: isVip ? '#FFD700' : T.gold, fontSize: '9px', fontWeight: '900' }}>COUNT DOWN</div>
              <div style={{ color: game?.status === 'RUNNING' ? 'white' : (isVip ? 'white' : (activeThemeKey === 'LIGHT' ? '#333' : 'white')), fontSize: '24px', fontWeight: '900' }}>{cdText}</div>
            </div>
            <motion.div 
              key={lastBall} 
              initial={{ scale: 0.5 }} 
              animate={{ scale: 1 }} 
              style={{ 
                width: '65px', 
                height: '65px', 
                background: lastBall 
                  ? (isVip ? 'linear-gradient(135deg, #FFD700 0%, #C471ED 100%)' : COL_COLOR[colLabel(lastBall)]) 
                  : (isVip ? 'rgba(255,255,255,0.05)' : T.statBg), 
                borderRadius: '50%', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontWeight: '900', 
                border: isVip ? '4px solid #FFD700' : `4px solid ${T.gold}`, 
                color: lastBall ? (isVip ? '#1C0A35' : 'white') : (isVip ? '#FFD700' : T.brown),
                boxShadow: isVip ? '0 0 15px rgba(255, 215, 0, 0.6)' : 'none'
              }}
            >
              {lastBall ? (
                <>
                  <div style={{ fontSize: '14px', lineHeight: 1 }}>{colLabel(lastBall)}</div>
                  <div style={{ fontSize: '24px', lineHeight: 1 }}>{lastBall}</div>
                </>
              ) : '•'}
            </motion.div>
          </div>

          {/* Current Called Balls (Last 4 Recent Balls) Row - Placed Under Countdown / Last Ball and next to simulation */}
          <div style={{ background: isVip ? 'rgba(255,255,255,0.02)' : T.statBg, borderRadius: '12px', padding: '6px 10px', border: isVip ? '1px solid rgba(255,215,0,0.2)' : `1px solid ${T.gold}33`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: isVip ? '#FFD700' : T.brown, fontSize: '9px', fontWeight: '900', letterSpacing: '0.5px' }}>RECENT BALLS</span>
            <div style={{ display: 'flex', gap: '5px' }}>
              {drawn.slice(-4).reverse().map((ball) => {
                const label = colLabel(ball);
                const color = isVip ? 'linear-gradient(135deg, #FFD700, #C471ED)' : COL_COLOR[label];
                return (
                  <motion.div
                    key={ball}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    style={{
                      background: color,
                      color: isVip ? '#1C0A35' : 'white',
                      fontWeight: '900',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: isVip ? '1.5px solid #FFD700' : '1.5px solid white',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                    }}
                  >
                    <span style={{ fontSize: '6px', lineHeight: 1 }}>{label}</span>
                    <span style={{ fontSize: '10px', lineHeight: 1 }}>{ball}</span>
                  </motion.div>
                );
              })}
              {drawn.length === 0 && <span style={{ color: isVip ? 'rgba(255,255,255,0.4)' : T.brown, fontSize: '9px', fontWeight: '800', opacity: 0.6 }}>Waiting for draw...</span>}
            </div>
          </div>

          <div style={{ background: isVip ? 'rgba(255,255,255,0.05)' : T.card, borderRadius: '14px', padding: '10px', border: isVip ? '1px solid rgba(255, 215, 0, 0.25)' : `1px solid ${T.gold}44`, backdropFilter: isVip ? 'blur(10px)' : 'none' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px', marginBottom: '6px' }}>
              {['B','I','N','G','O'].map(l => (
                <div key={l} style={{ 
                  background: isVip ? 'linear-gradient(135deg, #FFD700, #C471ED)' : COL_COLOR[l], 
                  color: isVip ? '#1C0A35' : 'white', 
                  textAlign: 'center', 
                  fontSize: '13px', 
                  fontWeight: '900', 
                  borderRadius: '6px', 
                  padding: '4px 0',
                  boxShadow: isVip ? '0 2px 5px rgba(0,0,0,0.15)' : 'none'
                }}>{l}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px' }}>
              {Array.from({ length: 15 }, (_, i) => COL_RANGES.map(col => {
                const n = col.s + i;
                return (
                  <div key={n} style={{
                    background: isCalled(n) 
                      ? (isVip ? 'linear-gradient(135deg, #FFD700, #C471ED)' : COL_COLOR[col.l]) 
                      : (isVip ? 'rgba(255,255,255,0.05)' : T.statBg),
                    color:      isCalled(n) ? '#1C0A35' : (isVip ? 'rgba(255,255,255,0.6)' : T.text),
                    border:     isVip && isCalled(n) ? '1px solid #FFD700' : 'none',
                    fontSize: '10px', fontWeight: '900', textAlign: 'center', padding: '5.5px 0', borderRadius: '4px'
                  }}>{n}</div>
                );
              }))}
            </div>
          </div>

          {/* Refresh and Leave buttons side-by-side right under calling grid */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => window.location.reload()}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                height: '42px',
                background: '#00A8E8',
                color: 'white',
                border: 'none',
                borderRadius: '16px',
                fontWeight: '900',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(0,168,232,0.2)'
              }}
            >
              <RefreshCw size={14} /> Refresh
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push('/')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                height: '42px',
                background: '#E74C3C',
                color: 'white',
                border: 'none',
                borderRadius: '16px',
                fontWeight: '900',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(231,76,60,0.2)'
              }}
            >
              <LogOut size={14} /> Leave
            </motion.button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ color: isVip ? 'white' : T.text, fontWeight: '900', fontSize: '13px', padding: '0 5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🏆 YOUR CARTELAS ({visible.length})</span>
          </div>

          {/* Single Shared B-I-N-G-O Header for all cards to save space */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', padding: '0 5px' }}>
            {['B','I','N','G','O'].map(l => (
              <div 
                key={l} 
                style={{ 
                  background: isVip ? 'linear-gradient(135deg, #FFD700, #C471ED)' : COL_COLOR[l], 
                  color: isVip ? '#1C0A35' : 'white', 
                  textAlign: 'center', 
                  fontSize: '12px', 
                  fontWeight: '900', 
                  borderRadius: '50%', 
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                }}
              >
                {l}
              </div>
            ))}
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
                  background: isVip ? 'rgba(255,255,255,0.04)' : T.card, 
                  borderRadius: '16px', 
                  overflow: 'hidden', 
                  border: isSelected 
                    ? (isVip ? '3px solid #FFD700' : `3px solid ${T.gold}`) 
                    : (isVip ? '2px solid rgba(255, 215, 0, 0.2)' : `2px solid ${T.gold}55`), 
                  boxShadow: isSelected 
                    ? (isVip ? '0 8px 25px rgba(255, 215, 0, 0.3)' : `0 8px 20px ${T.gold}44`) 
                    : '0 4px 10px rgba(0,0,0,0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backdropFilter: isVip ? 'blur(10px)' : 'none'
                }}
              >
                <button onClick={(e) => { e.stopPropagation(); hideCard(t.id); }} style={{ position: 'absolute', top: '4px', right: '5px', width: '20px', height: '20px', background: '#C0392B', color: 'white', border: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}><X size={10} /></button>
                <div style={{ 
                  background: isSelected 
                    ? (isVip ? 'linear-gradient(90deg, #FFD700, #C471ED)' : T.gold) 
                    : (isVip ? '#1C0A35' : T.header), 
                  padding: '4px 10px', 
                  color: isSelected 
                    ? (isVip ? '#1C0A35' : T.header) 
                    : (isVip ? '#FFD700' : T.gold), 
                  fontWeight: '900', 
                  fontSize: '11px' 
                }}>
                   Cartela #{cardId} {isSelected ? '(SELECTED)' : ''}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px', padding: '5px' }}>
                  {rows.map((row: any[], ri: number) => row.map((cell: any, ci: number) => {
                      const numVal = Number(cell);
                      const isFree = cell === 'FREE' || cell === 0 || cell === null;
                      const userMarked = !isFree && marked.has(numVal);
                      const callMarked = !isFree && isCalled(numVal);
                      const isHinted   = isAutoMode && callMarked && !userMarked;
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
                            background: isFree 
                              ? '#27AE60' 
                              : userMarked 
                                ? (isVip ? 'linear-gradient(135deg, #FFD700, #C471ED)' : T.gold) 
                                : (isHinted ? '#E67E22' : (isVip ? 'rgba(255,255,255,0.06)' : T.statBg)), 
                            color: (isFree || isHinted) 
                              ? 'white' 
                              : userMarked 
                                ? (isVip ? '#1C0A35' : T.header) 
                                : (isVip ? 'white' : T.text), 
                            border: userMarked 
                              ? (isVip ? '3px solid #FFD700' : '3px solid white') 
                              : (isHinted ? '2px solid white' : 'none'),
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

                {/* Per-card BINGO! Action Claim Button */}
                <div style={{ padding: '0 5px 6px 5px' }}>
                  <motion.button
                    whileTap={game?.status === 'RUNNING' ? { scale: 0.96 } : {}}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (game?.status === 'RUNNING') handleBingo();
                    }}
                    disabled={game?.status !== 'RUNNING'}
                    style={{
                      width: '100%',
                      background: game?.status === 'RUNNING' 
                        ? (isVip ? 'linear-gradient(135deg, #FFD700, #C471ED)' : 'linear-gradient(135deg, #F39C12, #E67E22)') 
                        : (isVip ? 'rgba(255,255,255,0.05)' : 'rgba(150,150,150,0.1)'),
                      color: game?.status === 'RUNNING' 
                        ? (isVip ? '#1C0A35' : 'white') 
                        : (isVip ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)'),
                      border: isVip && game?.status === 'RUNNING' ? '2px solid #FFFFFF' : 'none',
                      borderRadius: '12px',
                      height: '36px',
                      fontWeight: '900',
                      fontSize: '13px',
                      cursor: game?.status === 'RUNNING' ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: game?.status === 'RUNNING' 
                        ? (isVip ? '0 4px 15px rgba(255,215,0,0.4)' : '0 4px 10px rgba(230,126,34,0.3)') 
                        : 'none'
                    }}
                  >
                    ☕ BINGO! ({cardId})
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
          {tickets.length === 0 && <div style={{ textAlign: 'center', color: isVip ? 'white' : T.brown, padding: '40px' }}>Fetching cards...</div>}
        </div>
      </div>



      {/* ── FAB 'Add Board' button with plus icon (+) ── */}
      <motion.div 
        whileTap={{ scale: 0.85 }} 
        whileHover={{ scale: 1.05 }}
        className="premium-fab"
        onClick={() => router.push(`/tickets/select?type=${game?.room?.type || spType || 'STANDARD'}&price=${stake}&gameId=${gameId || ''}`)} 
        style={{ 
          position: 'fixed', 
          bottom: '100px', 
          right: '20px', 
          width: '64px',
          height: '64px',
          background: fabBg, 
          borderRadius: '50%', 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999, 
          cursor: 'pointer', 
          border: `2px solid ${fabBorder}`,
          boxShadow: `0 10px 28px rgba(0, 0, 0, 0.4), inset 0 3px 6px rgba(255, 255, 255, 0.5), inset 0 -3px 8px rgba(0, 0, 0, 0.5)`,
          userSelect: 'none'
        }}
      >
        {/* Inner concentric ring matching the image */}
        <div style={{
          width: '82%',
          height: '82%',
          borderRadius: '50%',
          border: `1.5px solid ${fabInnerRing}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `inset 0 3px 4px rgba(255, 255, 255, 0.35), inset 0 -3px 4px rgba(0, 0, 0, 0.3)`,
          position: 'relative'
        }}>
          {/* Central Plus Icon (using Lucide Plus) */}
          <Plus 
            size={28} 
            strokeWidth={4.2} 
            style={{ 
              color: fabPlusColor, 
              filter: 'drop-shadow(0px 2.5px 2px rgba(0,0,0,0.35))' 
            }} 
          />
        </div>
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
        .custom-scroll::-webkit-scrollbar-thumb { background: ${T.gold}44; border-radius: 10px; }
        @keyframes pulse-fab {
          0% { 
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35), inset 0 2px 5px rgba(255, 255, 255, 0.45), inset 0 -3px 8px rgba(0, 0, 0, 0.45), 0 0 5px ${T.gold}44; 
          }
          50% { 
            box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45), inset 0 2px 5px rgba(255, 255, 255, 0.55), inset 0 -3px 8px rgba(0, 0, 0, 0.55), 0 0 22px ${T.gold}cc; 
          }
          100% { 
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35), inset 0 2px 5px rgba(255, 255, 255, 0.45), inset 0 -3px 8px rgba(0, 0, 0, 0.45), 0 0 5px ${T.gold}44; 
          }
        }
        .premium-fab {
          animation: pulse-fab 2.5s infinite ease-in-out;
        }
      `}} />

      <BunaModal 
        isOpen={modal.isOpen}
        onClose={() => setModal(p => ({ ...p, isOpen: false }))}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
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
