'use client';
import { useEffect, useState, useRef, Suspense, useCallback, Fragment } from 'react';
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
  const [tickets,   setTickets]   = useState<any[]>([]);

  // Hydrate from cache only on client to avoid Next.js SSR mismatch
  useEffect(() => {
    if (typeof window !== 'undefined' && gameId) {
      try {
        const cached = sessionStorage.getItem(`game_tickets_${gameId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          setTickets(parsed.sort((a: any, b: any) => (a.card?.id || 0) - (b.card?.id || 0)));
        }
      } catch (e) {}
    }
  }, [gameId]);

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
  const [gameFinished, setGameFinished] = useState<{ winnerName: string; prize: number; mode: string; isWinner: boolean; card?: any; cardNo?: number; isCurrentUserWinner?: boolean; hasAnyWinner?: boolean; isBot?: boolean; drawnNumbers?: number[] } | null>(null);
  const [redirectSecs, setRedirectSecs] = useState(5);
  const redirectTimerRef = useRef<any>(null);
  const redirectCountdownRef = useRef<any>(null);
  const [toast,     setToast]     = useState<string | null>(null);
  const [mounted,   setMounted]   = useState(false);
  const [endTime,   setEndTime]   = useState<number | null>(null);
  const [serverOff, setServerOff] = useState(0);
  const [marked,    setMarked]    = useState<Set<number>>(new Set());
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [claiming,      setClaiming]      = useState(false);
  const [calledHistory, setCalledHistory] = useState<number[]>([]);

  const toastTimer           = useRef<any>(null);
  const lastStartAudioPlayed = useRef<number>(0);
  // soundOn ref so socket handlers always see latest value (no stale closure)
  const soundOnRef = useRef(true);
  // Track last drawn number to avoid duplicate sounds
  const lastDrawnRef = useRef<number>(0);

  // Audio queue refs to manage sequential ball announcements without overlaps
  const audioQueueRef = useRef<number[]>([]);
  const isPlayingQueueRef = useRef<boolean>(false);
  const isFirstLoadRef = useRef<boolean>(true);
  const playNextTimeoutRef = useRef<any>(null);
  const isGameFinishedRef = useRef<boolean>(false);
  // Ref for precisely scheduling start.mp3 so all devices play it at the same server-time moment
  const startAudioScheduled = useRef<any>(null);


  const ticketsRef = useRef<any[]>([]);
  useEffect(() => {
    ticketsRef.current = tickets;
  }, [tickets]);

  // ─── Audio helpers ────────────────────────────────────────────────────────────
  // ballAudioRef: single persistent element for B1-O75 ball calls.
  //   Must be unlocked by a user gesture before socket/polling can trigger it.
  // start.mp3 / stop.mp3: use new Audio() — works in Telegram WebApp trusted
  //   context without requiring an explicit user gesture unlock.
  const ballAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !ballAudioRef.current) {
      ballAudioRef.current = new Audio();
    }
  }, []);

  const playBallSound = useCallback((num: number, onComplete?: () => void) => {
    let completed = false;
    const safeComplete = () => {
      if (!completed) {
        completed = true;
        if (onComplete) onComplete();
      }
    };

    if (!soundOnRef.current) {
      if (onComplete) setTimeout(safeComplete, 100); // Simulate gap if muted
      return;
    }

    const col = colLabel(num);
    try {
      const el = ballAudioRef.current;
      if (el) {
        el.pause();
        el.currentTime = 0;
        el.src = `/audio/${col}${num}.mp3`;
        el.onended = safeComplete;
        el.onerror = safeComplete;
        el.play().catch(() => {
          // Fallback: fresh Audio element in case ref is locked
          try { 
            const fallbackEl = new Audio(`/audio/${col}${num}.mp3`);
            fallbackEl.onended = safeComplete;
            fallbackEl.onerror = safeComplete;
            fallbackEl.play().catch(safeComplete); 
          } catch (_) { safeComplete(); }
        });
      } else {
        const fallbackEl = new Audio(`/audio/${col}${num}.mp3`);
        fallbackEl.onended = safeComplete;
        fallbackEl.onerror = safeComplete;
        fallbackEl.play().catch(safeComplete);
      }
    } catch (e) {
      safeComplete();
    }

    // Safety timeout in case audio hangs indefinitely
    setTimeout(safeComplete, 4500);
  }, []);

  const processAudioQueue = useCallback((setLastBallFn: (n: number) => void) => {
    if (isGameFinishedRef.current || audioQueueRef.current.length === 0) {
      isPlayingQueueRef.current = false;
      return;
    }
    isPlayingQueueRef.current = true;
    const nextBall = audioQueueRef.current.shift();
    if (nextBall) {
      console.log('[AudioQueue] Playing ball:', nextBall);
      lastDrawnRef.current = nextBall;
      // ── Synchronize visual BIG BALL and RECENT BALLS with the audio ──
      setLastBallFn(nextBall);
      setCalledHistory(prev => prev.includes(nextBall) ? prev : [...prev, nextBall]);
      
      // Wait for ball audio to ACTUALLY finish before playing next
      playBallSound(nextBall, () => {
        playNextTimeoutRef.current = setTimeout(() => {
          processAudioQueue(setLastBallFn);
        }, 200); // 200ms natural gap after audio finishes
      });
    } else {
      isPlayingQueueRef.current = false;
    }
  }, [playBallSound, setCalledHistory]);

  const queueBallSounds = useCallback((numbers: number[], setLastBallFn: (n: number) => void) => {
    if (isGameFinishedRef.current) return;

    const currentQueue = audioQueueRef.current;
    // Avoid queueing any balls already in the queue or already played
    const toAdd = numbers.filter(n => !currentQueue.includes(n) && n !== lastDrawnRef.current);
    if (toAdd.length === 0) return;
    console.log('[AudioQueue] Adding to queue:', toAdd);

    // Combine and limit queue size to prevent backlog lag
    let newQueue = [...currentQueue, ...toAdd];
    if (newQueue.length > 2) {
      // Keep only the latest 2 balls to play audio for, skip the rest to prevent lag accumulation
      newQueue = newQueue.slice(-2);
    }
    audioQueueRef.current = newQueue;

    if (!isPlayingQueueRef.current) {
      console.log('[AudioQueue] Starting queue processor');
      processAudioQueue(setLastBallFn);
    }
  }, [processAudioQueue]);

  const playStartAudio = useCallback(() => {
    if (!soundOnRef.current) return;
    const now = Date.now();
    if (now - lastStartAudioPlayed.current < 2500) return;
    lastStartAudioPlayed.current = now;
    try { new Audio('/audio/start.mp3').play().catch(() => {}); } catch (e) {}
  }, []);

  const playStopAudio = useCallback(() => {
    if (!soundOnRef.current) return;
    try { new Audio('/audio/stop.mp3').play().catch(() => {}); } catch (e) {}
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
    Promise.all([
      getGame(gameId), 
      getMyCard(gameId).catch(() => ({ tickets: [] }))
    ]).then(([g, t]) => {
      setGame(g);

      // Cache in sessionStorage for instant re-open without flicker
      try {
        sessionStorage.setItem(`game_state_${gameId}`, JSON.stringify({
          status: g.status, totalPrize: g.totalPrize, room: g.room,
          drawHistory: g.drawHistory, currentPlayers: g.currentPlayers,
        }));
      } catch (e) {}

      if (g.serverTime) {
        setServerOff(g.serverTime - Date.now());
      }

      if (g.status === 'RUNNING' || g.status === 'FINISHED') {
        setCountdown(null);
        setEndTime(null);
      } else if (g.endTime) {
        // ── Server-provided endTime: derive remaining from absolute epoch ──────
        setEndTime(g.endTime);
        if (g.status === 'COUNTDOWN') {
          const offset = g.serverTime ? (g.serverTime - Date.now()) : 0;
          const rem = Math.max(0, Math.ceil((g.endTime - Date.now() - offset) / 1000));
          if (rem > 0) setCountdown(rem);
        }
      } else if (g.status === 'COUNTDOWN' && g.countdownSeconds) {
        // Last-resort fallback: no endTime from server (rare, state not yet in memory)
        setCountdown((prev) => {
          if (prev !== null && prev >= 0) return prev;
          return g.countdownSeconds;
        });
      }
      const sorted = (t.tickets || []).sort((a: any, b: any) => (a.card?.id || 0) - (b.card?.id || 0));
      setTickets(sorted);
      try { sessionStorage.setItem(`game_tickets_${gameId}`, JSON.stringify(sorted)); } catch (e) {}

      const hist = (g.drawHistory || []).map((d: any) => d.number);
      // Sync UI drawn states immediately (board highlights)
      setDrawn(hist);
      const latestBall = hist.at(-1);

      // ── Polling audio fallback: queue ball sounds if polling found new numbers ──
      // This fires when socket misses the event (mobile network drop, proxy issues).
      const isFirstLoad = isFirstLoadRef.current;
      if (isFirstLoad) {
        isFirstLoadRef.current = false;
        // On first load / mid-game join: show full history immediately, no audio
        if (latestBall) {
          lastDrawnRef.current = latestBall;
          setLastBall(latestBall);
          setCalledHistory(hist); // Show all previously called balls in recent history
        }
      } else {
        // During active game: board highlights sync from server history immediately.
        // calledHistory (Recent Balls) and Big Ball Display are driven by audio queue
        // together inside processAudioQueue — so they always match in order.

        // Queue audio only for NEW balls not yet played
        let newBalls: number[] = [];
        if (lastDrawnRef.current === 0) {
          newBalls = hist;
        } else {
          const playedIndex = hist.indexOf(lastDrawnRef.current);
          if (playedIndex !== -1) {
            newBalls = hist.slice(playedIndex + 1);
          } else {
            // Fallback: last played ball not in history — queue latest if new
            if (latestBall && latestBall !== lastDrawnRef.current) {
              newBalls = [latestBall];
            }
          }
        }

        if (newBalls.length > 0) {
          // processAudioQueue will update both setLastBall + calledHistory together
          queueBallSounds(newBalls, setLastBall);
        }
      }
    }).catch(console.error);
  }, [gameId, queueBallSounds]);

  // Keep soundOnRef in sync with soundOn state
  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  // Reset refs/states on gameId change
  useEffect(() => {
    isFirstLoadRef.current = true;
    lastDrawnRef.current = 0;
    audioQueueRef.current = [];
    isPlayingQueueRef.current = false;
    setCalledHistory([]);
  }, [gameId]);

  // Reset/clear audio queue when game is not actively running
  useEffect(() => {
    const status = game?.status;
    isGameFinishedRef.current = status === 'FINISHED' || !!gameFinished;
    if (status === 'WAITING' || status === 'COUNTDOWN' || status === 'FINISHED') {
      lastDrawnRef.current = 0;
      audioQueueRef.current = [];
      isPlayingQueueRef.current = false;
      clearTimeout(playNextTimeoutRef.current);
      if (ballAudioRef.current) {
        ballAudioRef.current.pause();
        ballAudioRef.current.currentTime = 0;
      }
      if (status !== 'FINISHED') {
        setCalledHistory([]);
      }
    }
  }, [game?.status, gameFinished]);

  // ─── Initial Mount: load data + sound prefs ───────────────────────────────
  useEffect(() => {
    setMounted(true);
    
    // Load local sound preference
    const savedSound = localStorage.getItem('game_sound');
    if (savedSound !== null) {
      const val = savedSound === 'true';
      setSoundOn(val);
      soundOnRef.current = val;
    }

    if (!gameId) return;

    loadData();
    // One retry at 1.5s to catch any state that was mid-update on first load
    const retryTimer = setTimeout(loadData, 1500);

    return () => {
      clearTimeout(retryTimer);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [gameId]); // intentionally only on gameId — loadData is stable via useCallback

  // ─── Socket.io Handlers — run whenever socket becomes available ──────────
  // This is a SEPARATE effect from mount so it re-runs as soon as the
  // async socket init finishes (fixes: numbers not arriving without refresh).
  useEffect(() => {
    if (!socket || !gameId) return;

    // Join the game room immediately
    socket.emit('join-game', gameId);

    socket.on('number-drawn', (d: { number: number }) => {
      const num = Number(d.number);
      // Board highlights update immediately (so card numbers are marked)
      setDrawn(p => p.includes(num) ? p : [...p, num]);
      // Big ball display + Recent Balls: driven by audio queue together
      // (calledHistory is updated inside processAudioQueue with setLastBall)
      queueBallSounds([num], setLastBall);
    });

    socket.on('countdown-start', (d: any) => {
      if (d.endTime) {
        const offset = d.serverTime ? (d.serverTime - Date.now()) : 0;
        setServerOff(offset);
        setEndTime(d.endTime);
        // Derive the display value immediately from the absolute server epoch
        // so every device shows the same number regardless of network latency
        const remMs = d.endTime - Date.now() - offset;
        const rem = Math.max(0, Math.ceil(remMs / 1000));
        setCountdown(rem > 0 ? rem : null);
        // Schedule start.mp3 to play at the exact server endTime (cross-device sync)
        if (startAudioScheduled.current) clearTimeout(startAudioScheduled.current);
        const msUntilStart = Math.max(0, remMs);
        startAudioScheduled.current = setTimeout(() => playStartAudio(), msUntilStart);
      } else {
        setCountdown(d.seconds);
      }
      if (d.seconds === 0) {
        setCountdown(null);
        setEndTime(null);
        setTimeout(loadData, 300);
      }
    });

    socket.on('countdown-tick', (d: any) => {
      if (d.endTime) {
        const offset = d.serverTime ? (d.serverTime - Date.now()) : 0;
        setServerOff(offset);
        setEndTime(d.endTime);
        // Re-derive display value from absolute server epoch on every tick
        const remMs = d.endTime - Date.now() - offset;
        const rem = Math.max(0, Math.ceil(remMs / 1000));
        setCountdown(rem > 0 ? rem : null);
        // Re-schedule start.mp3 on every tick for accuracy
        if (startAudioScheduled.current) clearTimeout(startAudioScheduled.current);
        const msUntilStart = Math.max(0, remMs);
        startAudioScheduled.current = setTimeout(() => playStartAudio(), msUntilStart);
      } else {
        setCountdown(d.secondsRemaining);
      }
      const offset = d.serverTime ? (d.serverTime - Date.now()) : 0;
      if (d.secondsRemaining === 0 || (d.endTime && d.endTime - offset <= Date.now())) {
        setEndTime(null);
        setTimeout(loadData, 300);
      }
    });

    socket.on('game-started', () => {
      // Clear countdown immediately — don't wait for async loadData() to finish
      setCountdown(null);
      setEndTime(null);
      loadData();
      // Fallback: only plays if scheduled timeout hasn't fired yet (debounce prevents double-play)
      playStartAudio();
    });

    socket.on('game-finished', (d: any) => {
      loadData();
      playStopAudio();
      const tgUserId = typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id
        ? String((window as any).Telegram.WebApp.initDataUnsafe.user.id)
        : '';
      // Match by telegramId (reliable) OR userId (fallback) OR ticketId
      const myWinnerObj = (d.winners || []).find((winner: any) => 
        (tgUserId && winner.telegramId && String(winner.telegramId) === tgUserId) ||
        (tgUserId && String(winner.userId) === tgUserId) ||
        ticketsRef.current.some(t => String(t.id) === String(winner.ticketId) || String(t.userId) === String(winner.userId))
      );
      const isCurrentUserWinner = !!myWinnerObj;
      const w = myWinnerObj || d.winners?.[0];
      const isBot = w?.isBot ?? w?.user?.isBot ?? false; // default false = show real name
      // Fallback Ethiopian names for when there's no winner data
      const ETHIOPIAN_FALLBACKS = ['Abebe', 'Kebede', 'Selam', 'Tesfaye', 'Girma', 'Dawit', 'Bereket', 'Yonas'];
      const fallbackName = ETHIOPIAN_FALLBACKS[Math.floor(Math.random() * ETHIOPIAN_FALLBACKS.length)];
      // For real player wins: show actual name. For bot wins: show Ethiopian name (already set by backend).
      const name = isCurrentUserWinner
        ? ((window as any).Telegram?.WebApp?.initDataUnsafe?.user?.first_name || w?.user?.firstName || 'You')
        : (w ? (w.user?.firstName || fallbackName) : fallbackName);
      // Normalize card
      let rawCard = w?.card || w?.ticket?.card;
      if (typeof rawCard === 'string') {
        try { rawCard = JSON.parse(rawCard); } catch(e) {}
      }
      if (typeof rawCard === 'string') {
        try { rawCard = JSON.parse(rawCard); } catch(e) {}
      }
      const cardNo: number | undefined = rawCard?.id ?? w?.cardId ?? undefined;
      let cardRows = rawCard
        ? (Array.isArray(rawCard) ? rawCard : (rawCard.rows ?? null))
        : null;
      if (typeof cardRows === 'string') {
        try { cardRows = JSON.parse(cardRows); } catch(e) {}
      }
      if (cardRows && !Array.isArray(cardRows)) cardRows = null;
      if (cardRows && (!Array.isArray(cardRows[0]) || cardRows.length !== 5)) cardRows = null;
      setGameFinished({
        winnerName: name,
        prize: parseFloat(String(w?.prizeAmount ?? 0)) || parseFloat(String(d?.gamePrize ?? 0)) || (Number(stake) * 31 * 0.75),
        mode: w?.winMode || 'ROW',
        isWinner: !!w,
        hasAnyWinner: true,
        card: cardRows || null,
        cardNo: cardNo || undefined,
        isCurrentUserWinner,
        isBot,
        drawnNumbers: d.drawnNumbers || drawn || [],
      });
      // Start 5-second countdown then redirect to cartela selection
      setRedirectSecs(8);
      redirectCountdownRef.current = setInterval(() => {
        setRedirectSecs(s => {
          if (s <= 1) {
            clearInterval(redirectCountdownRef.current);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
      redirectTimerRef.current = setTimeout(() => {
        router.push(`/tickets/select?type=${game?.room?.type || spType}&price=${stake}`);
      }, 8000);
    });

    socket.on('game-update', (d: any) => {
      setGame((p: any) => p ? { ...p, ...d } : p);
    });

    // Re-join and reload after reconnect (handles VPS socket drops)
    socket.on('connect', () => {
      socket.emit('join-game', gameId);
      loadData();
    });

    return () => {
      socket.emit('leave-game', gameId);
      socket.off('number-drawn');
      socket.off('countdown-start');
      socket.off('countdown-tick');
      socket.off('game-started');
      socket.off('game-finished');
      socket.off('game-update');
      socket.off('connect');
      // Cancel any pending start-audio schedule on unmount / game change
      if (startAudioScheduled.current) clearTimeout(startAudioScheduled.current);
    };
  }, [socket, gameId, loadData, queueBallSounds, playStartAudio, playStopAudio]);


  // ── Server-time-anchored local countdown tick ─────────────────────────────
  // Uses endTime (absolute UTC epoch from server) and serverOff clock-skew correction.
  // All devices compute the same value because they all subtract from the same fixed epoch.
  useEffect(() => {
    if (endTime === null) return;
    const timer = setInterval(() => {
      const now = Date.now() + serverOff;
      const rem = Math.max(0, Math.ceil((endTime - now) / 1000));
      setCountdown((prev) => {
        if (prev === rem) return prev;
        return rem;
      });
      if (rem <= 0) {
        setEndTime(null);
        setTimeout(loadData, 300);
      }
    }, 200);  // 200ms ticks — smooth display, all devices identical
    return () => clearInterval(timer);
  }, [endTime, serverOff, loadData]);

  // ─── Polling fallback: syncs state when socket events are missed ─────────
  // RUNNING uses 2s poll = catches missed number-drawn events within 1 draw cycle.
  // WAITING/COUNTDOWN use 3s poll = detects game start quickly.
  // FINISHED: show popup & redirect to cartela selection (socket may have been missed).
  useEffect(() => {
    const status = game?.status;
    if (status === 'FINISHED') {
      // Socket may have missed game-finished — show popup and redirect as fallback
      if (!gameFinished) {
        const winners = game?.winners || [];
        // Polling fallback
        const tgUserId2 = typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id
          ? String((window as any).Telegram.WebApp.initDataUnsafe.user.id)
          : '';
        const myWinnerObj = winners.find((winner: any) => 
          (tgUserId2 && winner.telegramId && String(winner.telegramId) === tgUserId2) ||
          (tgUserId2 && String(winner.userId) === tgUserId2) ||
          tickets.some(t => String(t.id) === String(winner.ticketId) || String(t.userId) === String(winner.userId))
        );
        const isCurrentUserWinner = !!myWinnerObj;
        const w = myWinnerObj || winners[0];
        const isBot = w?.isBot ?? w?.user?.isBot ?? false;
        const ETHIOPIAN_FALLBACKS = ['Abebe', 'Kebede', 'Selam', 'Tesfaye', 'Girma', 'Dawit', 'Bereket', 'Yonas'];
        const fallbackName = ETHIOPIAN_FALLBACKS[Math.floor(Math.random() * ETHIOPIAN_FALLBACKS.length)];
        const name = isCurrentUserWinner
          ? ((window as any).Telegram?.WebApp?.initDataUnsafe?.user?.first_name || w?.user?.firstName || 'You')
          : (w ? (w.user?.firstName || fallbackName) : fallbackName);
        let rawCard2 = w?.card || w?.ticket?.card;
        if (typeof rawCard2 === 'string') {
          try { rawCard2 = JSON.parse(rawCard2); } catch(e) {}
        }
        if (typeof rawCard2 === 'string') {
          try { rawCard2 = JSON.parse(rawCard2); } catch(e) {}
        }
        const cardNo2: number | undefined = rawCard2?.id ?? w?.cardId ?? undefined;
        let cardRows2 = rawCard2
          ? (Array.isArray(rawCard2) ? rawCard2 : (rawCard2.rows ?? null))
          : null;
        if (typeof cardRows2 === 'string') {
          try { cardRows2 = JSON.parse(cardRows2); } catch(e) {}
        }
        if (cardRows2 && !Array.isArray(cardRows2)) cardRows2 = null;
        if (cardRows2 && (!Array.isArray(cardRows2[0]) || cardRows2.length !== 5)) cardRows2 = null;
        setGameFinished({
          winnerName: name,
          prize: parseFloat(String(w?.prizeAmount ?? 0)) || parseFloat(String(game?.totalPrize ?? 0)) || (Number(stake) * 31 * 0.75),
          mode: w?.winMode || 'ROW',
          isWinner: !!w,
          hasAnyWinner: true,
          card: cardRows2 || null,
          cardNo: cardNo2 || undefined,
          isCurrentUserWinner,
          isBot,
          drawnNumbers: game?.drawHistory?.length
            ? (game.drawHistory as any[]).map((d: any) => d.number)
            : (drawn || []),
        });
        playStopAudio();
        setRedirectSecs(8);
        redirectCountdownRef.current = setInterval(() => {
          setRedirectSecs(s => {
            if (s <= 1) { clearInterval(redirectCountdownRef.current); return 0; }
            return s - 1;
          });
        }, 1000);
        redirectTimerRef.current = setTimeout(() => {
          router.push(`/tickets/select?type=${game?.room?.type || spType}&price=${stake}`);
        }, 8000);
      }
      return;
    }
    
    let intervalMs = 2000;
    if (!status) intervalMs = 2000;
    else if (status === 'WAITING') intervalMs = 3000;
    else if (status === 'COUNTDOWN') intervalMs = 3000;
    
    const poll = setInterval(() => {
      loadData();
    }, intervalMs);
    return () => clearInterval(poll);
  }, [game?.status, loadData, router, gameFinished, playStopAudio]);

  // ── Card-patch effect: if socket gave gameFinished with null card, fix it from API winners ──
  // Triggered when loadData() completes and populates game.winners after the socket event.
  useEffect(() => {
    if (!gameId || !gameFinished || gameFinished.card) return;
    const winners = (game as any)?.winners;
    if (!winners?.length) return;
    const tgUid = typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id
      ? String((window as any).Telegram.WebApp.initDataUnsafe.user.id) : '';
    const myW = winners.find((ww: any) =>
      (tgUid && ww.telegramId && String(ww.telegramId) === tgUid) ||
      (tgUid && String(ww.userId) === tgUid) ||
      tickets.some((t: any) => String(t.id) === String(ww.ticketId) || String(t.userId) === String(ww.userId))
    );
    const ww = myW || winners[0];
    if (!ww) return;
    let rawC: any = ww?.card || ww?.ticket?.card;
    if (typeof rawC === 'string') { try { rawC = JSON.parse(rawC); } catch(e) {} }
    if (typeof rawC === 'string') { try { rawC = JSON.parse(rawC); } catch(e) {} }
    let cardR: any[] | null = rawC ? (Array.isArray(rawC) ? rawC : (rawC.rows ?? null)) : null;
    if (typeof cardR === 'string') { try { cardR = JSON.parse(cardR); } catch(e) {} }
    if (cardR && !Array.isArray(cardR)) cardR = null;
    if (cardR && (!Array.isArray(cardR[0]) || cardR.length !== 5)) cardR = null;
    if (!cardR) return;
    const apiDrawn: number[] | null = (game as any)?.drawHistory?.length
      ? ((game as any).drawHistory as any[]).map((d: any) => d.number) : null;
    // Patch: update only card, cardNo, and drawnNumbers — preserve all other state (timer intact)
    setGameFinished(prev => prev && !prev.card ? {
      ...prev,
      card: cardR,
      cardNo: rawC?.id ?? ww?.cardId ?? prev.cardNo,
      drawnNumbers: (apiDrawn && apiDrawn.length > 0) ? apiDrawn : (prev.drawnNumbers || drawn),
    } : prev);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameFinished?.card, (game as any)?.winners?.length, (game as any)?.drawHistory?.length, gameId]);

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
    setAudioUnlocked(true);
    // Unlock ballAudioRef with a silent play on first user gesture
    const unlock = (el: HTMLAudioElement | null, src: string) => {
      if (!el) return;
      el.volume = 0;
      el.src = src;
      const p = el.play();
      if (p !== undefined) {
        p.then(() => { el.pause(); el.currentTime = 0; el.volume = 1; }).catch(() => {});
      }
    };
    try { unlock(ballAudioRef.current, '/audio/B1.mp3'); } catch (e) {}
  };

  const hideCard   = (id: string) => setHidden(p => new Set([...p, id]));
  const handleBingo = async () => {
    if (!gameId || claiming) return;
    setClaiming(true);
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
    } finally {
      setClaiming(false);
    }
  };

  if (!mounted) return null;

  // ─── Prize / Stake / Commission calculation ─────────────────────────────
  // Prize pool = 75% of ALL sold cards (real + bots), set by backend in game.totalPrize.
  // Fallback estimate uses bot counts while game data is loading.
  const BOT_COUNTS_FRONTEND: Record<string, number> = { CASUAL: 30, STANDARD: 30, PRO: 30, JACKPOT: 10, VIP: 10 };
  const roomTypeName = game?.room?.type || spType || 'STANDARD';
  const botCount     = BOT_COUNTS_FRONTEND[roomTypeName] ?? 30;
  
  const fallbackPrize = Math.round((botCount + tickets.length) * stake * 0.75);
  const prize = isDemo
    ? (game?.totalPrize ? Number(game.totalPrize) : 100)
    : Math.max(
        game?.totalPrize && Number(game.totalPrize) > 0 ? Number(game.totalPrize) : 0,
        fallbackPrize
      );

  const fallbackHouseComm = Math.round((botCount + tickets.length) * stake * 0.25);
  const houseComm = isDemo
    ? 0
    : Math.max(
        game?.houseEdge && Number(game.houseEdge) > 0 ? Number(game.houseEdge) : 0,
        fallbackHouseComm
      );

  const fallbackCards = botCount + tickets.length;
  const allCards = Math.max(game?.currentPlayers || 0, fallbackCards) || 1;
  const totalStake = isDemo ? 0 : allCards * stake;
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
        // Win detection requires manual tap (marked) — green hint shows which to tap
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
      onTouchStart={unlockAudio}
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
          {/* Auto / Manual Mode Toggle Removed */}

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
          ['GAME ID',   gameId?.slice(-6).toUpperCase() || '--'],
          ['CARDS',     `${allCards}`],
          ['STAKE/CARD',`${stake} ETB`],
          ['PRIZE 75%', `${prize.toFixed ? prize.toFixed(0) : prize} ETB`]
        ].map(([l, v]) => {
          const isPrize = l === 'PRIZE 75%';
          return (
            <div key={l as string} style={{ 
              background: isVip 
                ? (isPrize ? 'linear-gradient(90deg, #FFD700, #FFA500)' : 'rgba(255, 255, 255, 0.05)') 
                : (isPrize ? T.gold : T.card), 
              border: isVip 
                ? (isPrize ? 'none' : '1px solid rgba(255, 215, 0, 0.25)') 
                : `1px solid ${T.gold}33`, 
              padding: '6px 4px', 
              textAlign: 'center', 
              borderRadius: '8px',
              backdropFilter: isVip && !isPrize ? 'blur(10px)' : 'none',
              boxShadow: isVip && isPrize ? '0 4px 15px rgba(255, 215, 0, 0.3)' : 'none',
            }}>
              <div style={{ 
                fontSize: '8px', 
                fontWeight: 'bold', 
                color: isVip 
                  ? (isPrize ? 'rgba(28, 10, 53, 0.8)' : '#FFD700') 
                  : (isPrize ? T.header : T.brown)
              }}>{l}</div>
              <div style={{ 
                fontSize: '12px', 
                fontWeight: '900', 
                color: isVip 
                  ? (isPrize ? '#1C0A35' : 'white') 
                  : (isPrize ? T.header : T.text)
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
              {calledHistory.slice(-4).reverse().map((ball) => {
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
                    <span style={{ fontSize: '8px', lineHeight: 1, opacity: 0.8 }}>{label}</span>
                    <span style={{ fontSize: '13px', lineHeight: 1, marginTop: '-1px' }}>{ball}</span>
                  </motion.div>
                );
              })}
              {calledHistory.length === 0 && <span style={{ color: isVip ? 'rgba(255,255,255,0.4)' : T.brown, fontSize: '9px', fontWeight: '800', opacity: 0.6 }}>Waiting for draw...</span>}
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

          {/* ── BINGO DETECTED ALERT — only shown when player daubed a full pattern ── */}
          {hasBingo && game?.status === 'RUNNING' && (
            <motion.div
              animate={{
                scale: [1, 1.04, 1],
                boxShadow: ['0 0 10px #FFD70066', '0 0 30px #FFD700cc', '0 0 10px #FFD70066'],
              }}
              transition={{ duration: 0.8, repeat: Infinity }}
              style={{
                background: 'linear-gradient(135deg, #FFD700, #FF6B00)',
                borderRadius: '14px',
                padding: '10px 14px',
                textAlign: 'center',
                margin: '0 4px',
                cursor: 'pointer',
              }}
              onClick={handleBingo}
            >
              <div style={{ fontSize: '20px', lineHeight: 1 }}>🎊</div>
              <div style={{ color: '#1a0a00', fontWeight: '900', fontSize: '14px', letterSpacing: 1 }}>
                BINGO PATTERN FOUND!
              </div>
              <div style={{ color: '#1a0a00', fontSize: '11px', fontWeight: '700', opacity: 0.8, marginTop: '2px' }}>
                👆 TAP HERE or press BINGO! button NOW!
              </div>
            </motion.div>
          )}
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
                {/* Card header */}
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

                {/* 5×5 grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px', padding: '5px' }}>
                  {rows.map((row: any[], ri: number) => row.map((cell: any, ci: number) => {
                    const numVal  = Number(cell);
                    const isFree  = cell === 'FREE' || cell === 0 || cell === null;
                    const isBallCalled = !isFree && drawn.includes(numVal);
                    const userDaubed   = !isFree && marked.has(numVal);
                    const colClr  = COL_COLOR[colLabel(numVal)] || '#888';

                    // ── 4 visual states ─────────────────────────────────────
                    // 1. FREE cell (green star)
                    // 2. User daubed (gold — manually tapped)
                    // 3. Ball called but not yet tapped (pulsing green hint)
                    // 4. Not called (plain)
                    let bg: string, txtClr: string, bdr: string, shd: string;

                    if (isFree) {
                      bg = '#27AE60'; txtClr = 'white'; bdr = 'none'; shd = `0 0 8px #27AE6055`;
                    } else if (userDaubed) {
                      // Player manually daubed this number — gold confirmed
                      bg = isVip ? 'linear-gradient(135deg, #FFD700, #C471ED)' : T.gold;
                      txtClr = isVip ? '#1C0A35' : T.header;
                      bdr = `2px solid ${isVip ? '#FFD700' : 'white'}`;
                      shd = `0 0 10px ${isVip ? '#FFD70099' : T.gold + '88'}`;
                    } else if (isBallCalled) {
                      // Ball was called — hint: tap this number!
                      bg = isVip ? 'rgba(46,204,113,0.28)' : 'rgba(39,174,96,0.22)';
                      txtClr = '#2ECC71';
                      bdr = '2px solid #2ECC71';
                      shd = '0 0 8px rgba(46,204,113,0.5)';
                    } else {
                      // Not called — plain card colour
                      bg = isVip ? 'rgba(255,255,255,0.06)' : T.statBg;
                      txtClr = isVip ? 'rgba(255,255,255,0.55)' : T.text;
                      bdr = 'none'; shd = 'none';
                    }

                    return (
                      <motion.div
                        key={`${ri}-${ci}`}
                        onClick={(e) => { e.stopPropagation(); if (!isFree) toggleMark(numVal); }}
                        animate={
                          isBallCalled && !userDaubed && !isFree
                            ? { scale: [1, 1.07, 1], boxShadow: ['0 0 4px #2ECC7155', '0 0 12px #2ECC71cc', '0 0 4px #2ECC7155'] }
                            : userDaubed
                              ? { scale: [1, 1.08, 1] }
                              : { scale: 1 }
                        }
                        transition={
                          isBallCalled && !userDaubed && !isFree
                            ? { duration: 0.8, repeat: Infinity }
                            : userDaubed
                              ? { duration: 1.0, repeat: Infinity, repeatDelay: 1.5 }
                              : {}
                        }
                        style={{
                          height: '26px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: '4px', fontSize: '11px', fontWeight: '900',
                          background: bg, color: txtClr, border: bdr, boxShadow: shd,
                          position: 'relative', overflow: 'hidden',
                          cursor: isFree ? 'default' : 'pointer',
                          transition: 'background 0.25s, box-shadow 0.25s, border 0.25s',
                          userSelect: 'none',
                        }}
                      >
                        {isFree ? '★' : cell}

                        {/* Ripple on manually daubed number */}
                        {userDaubed && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0.7 }}
                            animate={{ scale: 2.4, opacity: 0 }}
                            transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 1.5 }}
                            style={{ position: 'absolute', width: '50%', height: '50%', border: `2px solid ${isVip ? '#FFD700' : T.gold}`, borderRadius: '50%', pointerEvents: 'none' }}
                          />
                        )}
                      </motion.div>
                    );
                  }))}
                </div>

                {/* Per-card BINGO! Action Claim Button */}
                <div style={{ padding: '0 5px 6px 5px' }}>
                  <motion.button
                    whileTap={game?.status === 'RUNNING' && !claiming ? { scale: 0.94 } : {}}
                    animate={hasBingo && game?.status === 'RUNNING' && !claiming
                      ? { scale: [1, 1.06, 1], boxShadow: ['0 0 8px #FFD70066', '0 0 24px #FFD700cc', '0 0 8px #FFD70066'] }
                      : { scale: 1, boxShadow: game?.status === 'RUNNING' && !claiming ? '0 4px 10px rgba(230,126,34,0.3)' : 'none' }
                    }
                    transition={hasBingo && game?.status === 'RUNNING' ? { duration: 0.7, repeat: Infinity } : {}}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (game?.status === 'RUNNING' && !claiming) handleBingo();
                    }}
                    disabled={game?.status !== 'RUNNING' || claiming}
                    style={{
                      width: '100%',
                      background: game?.status === 'RUNNING'
                        ? (claiming
                            ? '#7F8C8D'
                            : hasBingo
                              ? 'linear-gradient(135deg, #FFD700, #FF6B00)'
                              : (isVip ? 'linear-gradient(135deg, #FFD700, #C471ED)' : 'linear-gradient(135deg, #F39C12, #E67E22)'))
                        : (isVip ? 'rgba(255,255,255,0.05)' : 'rgba(150,150,150,0.1)'),
                      color: game?.status === 'RUNNING'
                        ? (hasBingo ? '#1a0a00' : (isVip ? '#1C0A35' : 'white'))
                        : (isVip ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)'),
                      border: hasBingo && game?.status === 'RUNNING' ? '2px solid #fff' : (isVip && game?.status === 'RUNNING' && !claiming ? '2px solid #FFFFFF' : 'none'),
                      borderRadius: '12px',
                      height: hasBingo && game?.status === 'RUNNING' ? '42px' : '36px',
                      fontWeight: '900',
                      fontSize: hasBingo && game?.status === 'RUNNING' ? '15px' : '13px',
                      cursor: game?.status === 'RUNNING' && !claiming ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'height 0.2s, font-size 0.2s',
                    }}
                  >
                    {claiming
                      ? '⏳ CLAIMING...'
                      : hasBingo && game?.status === 'RUNNING'
                        ? `🎊 BINGO! CLAIM NOW! (${cardId})`
                        : `☕ BINGO! (${cardId})`}
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
        {gameFinished && (
          <motion.div
            key="game-finished-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(5,2,0,0.97)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', overflowY: 'auto' }}
          >
            {/* Confetti — always visible */}
            {['🎉','⭐','🌟','✨','🎊','💫','🎉','⭐'].map((e, i) => (
              <motion.div key={i}
                initial={{ y: -20, opacity: 0, x: (i - 4) * 40 }}
                animate={{ y: [0, -55, 0], opacity: [0, 1, 0] }}
                transition={{ delay: i * 0.15, duration: 1.4, repeat: Infinity, repeatDelay: 2.5 }}
                style={{ position: 'absolute', top: '4%', fontSize: '20px', left: `${8 + i * 11}%`, pointerEvents: 'none' }}
              >{e}</motion.div>
            ))}

            <motion.div
              initial={{ scale: 0.3, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 230, damping: 18, delay: 0.08 }}
              style={{
                background: 'linear-gradient(160deg, #1c1000 0%, #080400 100%)',
                border: `2.5px solid ${gameFinished.isCurrentUserWinner ? T.gold : 'rgba(255,255,255,0.18)'}`,
                borderRadius: '20px',
                padding: '14px 12px 12px',
                textAlign: 'center',
                maxWidth: '310px',
                width: '97%',
                boxShadow: `0 0 60px ${gameFinished.isCurrentUserWinner ? T.gold + '44' : 'rgba(0,0,0,0.8)'}`,
                position: 'relative',
                maxHeight: '94vh',
                overflowY: 'auto',
                margin: 'auto',
              }}
              className="custom-scroll"
            >
              {/* Top emoji */}
              <motion.div
                animate={gameFinished.isCurrentUserWinner
                  ? { scale: [1, 1.18, 1], rotate: [0, -8, 8, 0] }
                  : { scale: 1 }
                }
                transition={{ duration: 1.3, repeat: Infinity, repeatDelay: 1.5 }}
                style={{ fontSize: '38px', lineHeight: 1, marginBottom: '3px' }}
              >
                {gameFinished.isCurrentUserWinner ? '🏆' : '🎯'}
              </motion.div>

              {/* Status header */}
              <motion.div
                animate={gameFinished.isCurrentUserWinner
                  ? { textShadow: [`0 0 8px ${T.gold}44`, `0 0 28px ${T.gold}cc`, `0 0 8px ${T.gold}44`] }
                  : {}
                }
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{
                  fontSize: '16px', fontWeight: '900',
                  color: gameFinished.isCurrentUserWinner ? T.gold : '#E74C3C',
                  letterSpacing: '2.5px', textTransform: 'uppercase',
                  marginBottom: '10px',
                }}
              >
                {gameFinished.isCurrentUserWinner ? '🎉 YOU WON!' : 'GAME OVER'}
              </motion.div>

              {/* ── Compact winner info card ── */}
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${T.gold}33`,
                borderRadius: '12px',
                padding: '8px 10px',
                marginBottom: '8px',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '8px',
                alignItems: 'center',
                textAlign: 'left',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1px' }}>
                    {gameFinished.hasAnyWinner ? (gameFinished.isCurrentUserWinner ? '✅ Winner' : '🏅 Winner') : 'Result'}
                  </div>
                  <div style={{
                    fontSize: '17px', fontWeight: '900',
                    color: gameFinished.hasAnyWinner ? T.gold : '#aaa',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {gameFinished.winnerName}
                  </div>
                  {gameFinished.cardNo && (
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginTop: '1px' }}>
                      Cartela <span style={{ color: T.gold, fontWeight: '800' }}>#{gameFinished.cardNo}</span>
                    </div>
                  )}
                  {!gameFinished.hasAnyWinner && (
                    <div style={{ color: '#E74C3C', fontWeight: '900', fontSize: '11px', marginTop: '2px' }}>HOUSE WINS</div>
                  )}
                </div>
                {/* Prize — right column */}
                {gameFinished.hasAnyWinner && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Prize</div>
                    <motion.div
                      animate={{ color: ['#F59E0B', '#FFD700', '#F59E0B'] }}
                      transition={{ duration: 1.6, repeat: Infinity }}
                      style={{ fontSize: '18px', fontWeight: '900', lineHeight: 1.1 }}
                    >
                      {Number(gameFinished.prize).toFixed(2)}
                    </motion.div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.55)', fontWeight: '700', letterSpacing: '0.5px' }}>ETB</div>
                  </div>
                )}
              </div>

              {/* Win mode badge */}
              {gameFinished.mode && (() => {
                const patternColors: Record<string, string> = {
                  FULL_HOUSE: '#FF6B35', FOUR_CORNERS: '#8B5CF6',
                  DIAGONAL: '#06B6D4', COLUMN: '#10B981', ROW: '#F59E0B',
                };
                const patternIcons: Record<string, string> = {
                  FULL_HOUSE: '🃏', FOUR_CORNERS: '🔷', DIAGONAL: '✕', COLUMN: '▌', ROW: '━',
                };
                const patternLabels: Record<string, string> = {
                  FULL_HOUSE: 'FULL HOUSE', FOUR_CORNERS: 'FOUR CORNERS',
                  DIAGONAL: 'DIAGONAL', COLUMN: 'COLUMN', ROW: 'ROW',
                };
                const pc = patternColors[gameFinished.mode] || '#2ECC71';
                return (
                  <motion.div
                    animate={{ boxShadow: [`0 0 0px ${pc}00`, `0 0 18px ${pc}99`, `0 0 0px ${pc}00`] }}
                    transition={{ duration: 1.7, repeat: Infinity }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      background: `${pc}22`, border: `1.5px solid ${pc}88`,
                      borderRadius: '20px', padding: '4px 14px', marginBottom: '8px',
                      fontSize: '11px', fontWeight: '900', color: pc,
                      letterSpacing: '1px', textTransform: 'uppercase',
                    }}
                  >
                    <span>{patternIcons[gameFinished.mode] || '🎯'}</span>
                    <span>{patternLabels[gameFinished.mode] || gameFinished.mode}</span>
                  </motion.div>
                );
              })()}



              {/* ── Winner's cartela — full 5×5 with highlighted winning pattern ── */}
              {gameFinished.card && (() => {
                const rawCard = gameFinished.card;
                const rows: any[][] = Array.isArray(rawCard)
                  ? rawCard
                  : (rawCard as any).rows ?? rawCard;
                if (!rows || !Array.isArray(rows) || rows.length === 0) return null;
                const safeRows = rows.slice(0, 5);

                // Build numeric grid (0 = FREE center)
                const grid: number[][] = safeRows.map((row: any[]) =>
                  (Array.isArray(row) ? row : []).map((cell: any) =>
                    (cell === 'FREE' || cell === 'free' || cell === null ? 0 : Number(cell))
                  )
                );

                const calledSet = new Set(gameFinished.drawnNumbers || drawn);
                // A cell counts as "marked" if it's the free center OR its number was called
                const isMarked = (r: number, c: number) =>
                  grid[r]?.[c] === 0 || calledSet.has(grid[r]?.[c]);

                // ── Determine winning pattern cells by position only ──
                // Don't rely on calledSet for pattern detection — winner already confirmed by server
                const patternCells = new Set<string>();
                const mode = gameFinished.mode;
                let winningRow = -1;
                let winningCol = -1;

                if (mode === 'FULL_HOUSE') {
                  for (let r = 0; r < 5; r++)
                    for (let c = 0; c < 5; c++)
                      patternCells.add(`${r}-${c}`);
                } else if (mode === 'FOUR_CORNERS') {
                  [[0,0],[0,4],[4,0],[4,4]].forEach(([r,c]) => patternCells.add(`${r}-${c}`));
                } else if (mode === 'DIAGONAL') {
                  // Show BOTH diagonals if both won, else just the one
                  // Always highlight main diagonal; check anti too
                  [0,1,2,3,4].forEach(i => patternCells.add(`${i}-${i}`));       // main ↘
                  [0,1,2,3,4].forEach(i => patternCells.add(`${i}-${4-i}`));    // anti ↗
                } else if (mode === 'COLUMN') {
                  // Find which column is fully marked
                  for (let c = 0; c < 5; c++) {
                    if ([0,1,2,3,4].every(r => isMarked(r, c))) {
                      winningCol = c;
                      [0,1,2,3,4].forEach(r => patternCells.add(`${r}-${c}`));
                      break;
                    }
                  }
                  // Fallback: if no column detected (drawn state mismatch), pick first col with most marks
                  if (patternCells.size === 0) {
                    let best = 0, bestCount = -1;
                    for (let c = 0; c < 5; c++) {
                      const cnt = [0,1,2,3,4].filter(r => isMarked(r, c)).length;
                      if (cnt > bestCount) { bestCount = cnt; best = c; }
                    }
                    winningCol = best;
                    [0,1,2,3,4].forEach(r => patternCells.add(`${r}-${best}`));
                  }
                } else if (mode === 'ROW') {
                  // Find which row is fully marked
                  for (let r = 0; r < 5; r++) {
                    if ([0,1,2,3,4].every(c => isMarked(r, c))) {
                      winningRow = r;
                      [0,1,2,3,4].forEach(c => patternCells.add(`${r}-${c}`));
                      break;
                    }
                  }
                  // Fallback: pick row with most marks
                  if (patternCells.size === 0) {
                    let best = 0, bestCount = -1;
                    for (let r = 0; r < 5; r++) {
                      const cnt = [0,1,2,3,4].filter(c => isMarked(r, c)).length;
                      if (cnt > bestCount) { bestCount = cnt; best = r; }
                    }
                    winningRow = best;
                    [0,1,2,3,4].forEach(c => patternCells.add(`${best}-${c}`));
                  }
                }

                const patternColors: Record<string, string> = {
                  FULL_HOUSE: '#FF6B35', FOUR_CORNERS: '#8B5CF6',
                  DIAGONAL: '#06B6D4', COLUMN: '#10B981', ROW: '#F59E0B',
                };
                const patternColor = patternColors[mode] || '#2ECC71';
                const COL_LABELS = ['B','I','N','G','O'];
                const COL_COLORS: Record<string, string> = {
                  B:'#E74C3C', I:'#E67E22', N:'#D4AF37', G:'#27AE60', O:'#8E44AD'
                };

                return (
                  <div style={{ marginBottom: '4px' }}>
                    <div style={{
                      fontSize: '8px', fontWeight: '800',
                      color: 'rgba(255,255,255,0.5)', marginBottom: '4px',
                      letterSpacing: '1px', textTransform: 'uppercase',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                    }}>
                      <span>📋</span>
                      <span>{gameFinished.isCurrentUserWinner ? 'Your Winning Cartela' : `${gameFinished.winnerName}'s Cartela`}</span>
                    </div>

                    {/* B-I-N-G-O column headers */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gap: '2px', marginBottom: '2px', padding: '0 2px'
                    }}>
                      {COL_LABELS.map((lbl, ci) => {
                        const isWinCol = winningCol === ci;
                        return (
                          <div key={lbl} style={{
                            fontSize: '11px', fontWeight: '900',
                            color: isWinCol ? '#fff' : COL_COLORS[lbl],
                            textAlign: 'center',
                            background: isWinCol ? `${patternColor}dd` : 'transparent',
                            borderRadius: '3px', padding: '0',
                            boxShadow: isWinCol ? `0 0 10px ${patternColor}` : 'none',
                            textShadow: isWinCol ? `0 0 8px #fff` : `0 0 6px ${COL_COLORS[lbl]}88`,
                          }}>{lbl}</div>
                        );
                      })}
                    </div>

                    {/* Full 5×5 grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gap: '2px',
                      background: 'rgba(0,0,0,0.55)',
                      padding: '3px',
                      borderRadius: '8px',
                      border: `2px solid ${patternColor}88`,
                      boxShadow: `inset 0 1px 10px rgba(0,0,0,0.6), 0 0 18px ${patternColor}33`,
                    }}>
                      {grid.map((row, ri) => (
                        <Fragment key={ri}>
                          {/* Row label for ROW mode */}
                          {mode === 'ROW' && ri === winningRow && (
                            <div style={{
                              gridColumn: '1 / -1',
                              height: '2px',
                              background: `linear-gradient(90deg, transparent, ${patternColor}, transparent)`,
                              margin: '0 -5px',
                              opacity: 0.6,
                            }} />
                          )}
                          {row.map((cell, ci) => {
                            const key = `${ri}-${ci}`;
                            const isFree = cell === 0;
                            const called = isFree || calledSet.has(cell);
                            const isWinCell = patternCells.has(key);
                            const colColor = COL_COLORS[COL_LABELS[ci]];

                            // Layered styling: winning > called > uncalled
                            let bg = 'rgba(255,255,255,0.04)';
                            let textColor = 'rgba(255,255,255,0.18)';
                            let shadow = 'none';
                            let border = '1px solid rgba(255,255,255,0.06)';
                            let fontSize = '9px';

                            if (isWinCell) {
                              bg = `linear-gradient(135deg, ${patternColor}ff, ${patternColor}cc)`;
                              textColor = '#fff';
                              shadow = `0 0 12px ${patternColor}cc, 0 2px 4px rgba(0,0,0,0.5)`;
                              border = `2px solid ${patternColor}`;
                              fontSize = '10px';
                            } else if (called) {
                              bg = `${colColor}22`;
                              textColor = colColor;
                              shadow = `0 0 5px ${colColor}44`;
                              border = `1px solid ${colColor}44`;
                            }

                            return (
                              <motion.div
                                key={key}
                                initial={{ opacity: 0, scale: 0.6 }}
                                animate={isWinCell
                                  ? { opacity: 1, scale: [1, 1.12, 1], boxShadow: [`0 0 8px ${patternColor}66`, `0 0 20px ${patternColor}dd`, `0 0 8px ${patternColor}66`] }
                                  : { opacity: 1, scale: 1 }
                                }
                                transition={isWinCell
                                  ? { duration: 1.0, repeat: Infinity, repeatDelay: 0.8, delay: (ri * 5 + ci) * 0.04 }
                                  : { delay: (ri * 5 + ci) * 0.015, duration: 0.3 }
                                }
                                style={{
                                  aspectRatio: '1',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize,
                                  fontWeight: '900',
                                  background: bg,
                                  color: textColor,
                                  borderRadius: '4px',
                                  boxShadow: shadow,
                                  border,
                                  position: 'relative',
                                }}
                              >
                                {isFree ? (
                                  <span style={{ fontSize: '12px', filter: isWinCell ? 'drop-shadow(0 0 4px #fff)' : 'none' }}>★</span>
                                ) : cell}
                                {isWinCell && (
                                  <div style={{
                                    position: 'absolute', inset: 0,
                                    borderRadius: '4px',
                                    background: `radial-gradient(circle at center, ${patternColor}33 0%, transparent 70%)`,
                                    pointerEvents: 'none',
                                  }} />
                                )}
                              </motion.div>
                            );
                          })}
                        </Fragment>
                      ))}
                    </div>

                    {/* Legend */}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px', color: 'rgba(255,255,255,0.55)' }}>
                        <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: patternColor, boxShadow: `0 0 4px ${patternColor}` }} />
                        Winning
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px', color: 'rgba(255,255,255,0.55)' }}>
                        <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: 'rgba(231,76,60,0.25)', border: '1px solid #E74C3C77' }} />
                        Called
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px', color: 'rgba(255,255,255,0.55)' }}>
                        <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
                        Uncalled
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.42)', margin: '8px 0 6px' }}>
                Redirecting in <span style={{ color: T.gold, fontWeight: '900' }}>{redirectSecs}s</span>...
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    clearTimeout(redirectTimerRef.current);
                    clearInterval(redirectCountdownRef.current);
                    router.push(`/tickets/select?type=${game?.room?.type || spType || 'STANDARD'}&price=${stake}`);
                  }}
                  style={{
                    flex: 1,
                    background: `linear-gradient(135deg, ${T.gold}, #c47a1e)`,
                    color: '#1a0a00',
                    padding: '13px 8px',
                    borderRadius: '14px',
                    fontWeight: '900',
                    fontSize: '13px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: `0 4px 16px ${T.gold}55`,
                  }}
                >
                  🎮 PLAY AGAIN
                </button>
                <button
                  onClick={() => {
                    clearTimeout(redirectTimerRef.current);
                    clearInterval(redirectCountdownRef.current);
                    router.push('/');
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.07)',
                    color: T.header,
                    padding: '13px 8px',
                    borderRadius: '14px',
                    fontWeight: '700',
                    fontSize: '13px',
                    border: `1px solid ${T.gold}44`,
                    cursor: 'pointer',
                  }}
                >
                  🏠 LOBBY
                </button>
              </div>
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
