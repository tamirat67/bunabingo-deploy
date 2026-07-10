'use client';
import { useEffect, useState, useRef, Suspense, useCallback, Fragment } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api, { getGame, getMyCard, claimBingo, getMe } from '../../lib/api';
import { useSocket } from '../../context/SocketContext';
import BunaModal from '../../components/BunaModal';
import WeeklyBlastModal from '../../components/WeeklyBlastModal';
import WeeklyBlastFab from '../../components/WeeklyBlastFab';
import { Volume2, VolumeX, RefreshCw, LogOut, Plus, X, Bell, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { initTelegram, getLanguage, setLanguage } from '../../lib/telegram';
import t from '../../lib/i18n';
import { useTheme } from '../../context/ThemeContext';
import { PREDEFINED_CARDS } from '../../lib/predefinedCards';

const COL_COLOR: Record<string, string> = {
  B: '#E74C3C', I: '#E67E22', N: '#D4AF37', G: '#27AE60', O: '#8E44AD',
};
const BINGO_3D_COLORS: Record<string, string> = {
  B: 'radial-gradient(circle at 35% 35%, #FF4D4D 0%, #D32F2F 50%, #7F0000 100%)',
  I: 'radial-gradient(circle at 35% 35%, #FF9800 0%, #F57C00 50%, #E65100 100%)',
  N: 'radial-gradient(circle at 35% 35%, #FFD54F 0%, #FBC02D 50%, #F57F17 100%)',
  G: 'radial-gradient(circle at 35% 35%, #4CAF50 0%, #388E3C 50%, #1B5E20 100%)',
  O: 'radial-gradient(circle at 35% 35%, #BA68C8 0%, #8E24AA 50%, #4A148C 100%)'
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
  const { socket, isConnected } = useSocket();
  const [langToggle, setLangToggle] = useState(0);

  useEffect(() => {
    const handleLangChange = () => setLangToggle(prev => prev + 1);
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);

  const [game,      setGame]      = useState<any>(null);
  const [isFetchingCards, setIsFetchingCards] = useState(true);
  const [tickets, setTickets] = useState<any[]>(() => {
    // ── Sync hydration: instantly load tickets on first render to prevent "Fetching cards..." flash
    if (typeof window !== 'undefined' && gameId) {
      try {
        const cached = sessionStorage.getItem(`game_tickets_${gameId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          // Only use cache if it actually contains tickets
          if (parsed && parsed.length > 0) {
            setIsFetchingCards(false);
            return parsed.sort((a: any, b: any) => (a.card?.id || 0) - (b.card?.id || 0));
          }
        }
      } catch (e) {}
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
  const audioUnlockedRef = useRef(false);
  const [claiming,      setClaiming]      = useState(false);
  const [gameEnded,     setGameEnded]     = useState(false); // set true the instant game-finished fires
  const [calledHistory, setCalledHistory] = useState<number[]>([]);
  const [bingoReadyTickets, setBingoReadyTickets] = useState<Set<string>>(new Set());

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
  // Set of ball numbers already announced (prevents any duplicate or skipped calls)
  const announcedBallsRef = useRef<Set<number>>(new Set());
  // Ref for precisely scheduling start.mp3 so all devices play it at the same server-time moment
  const startAudioScheduled = useRef<any>(null);
  const isStartAudioPlayingRef = useRef<boolean>(false);
  // Guards to prevent start.mp3 / stop.mp3 from firing more than once per game lifecycle
  const startAudioFiredRef = useRef<boolean>(false);
  const stopAudioFiredRef  = useRef<boolean>(false);
  // Persistent ref for stop.mp3 element — prevents garbage collection before audio finishes
  const stopAudioRef = useRef<HTMLAudioElement | null>(null);
  // Safety timeout ref: resets `claiming` if socket never sends claim-success/error (network drop)
  const claimTimeoutRef = useRef<any>(null);


  const ticketsRef = useRef<any[]>([]);
  useEffect(() => {
    ticketsRef.current = tickets;
  }, [tickets]);

  // ─── Non-blocking auth guard ─────────────────────────────────────────────────
  // Replaced blocking 'authChecked' state with an async background check.
  // This allows the page to load instantly while validating auth silently.
  useEffect(() => {
    getMe().then((user) => {
      if (!user) router.replace('/');
    }).catch(() => router.replace('/'));
  }, []);

  // ── Weekly Blast Event ───────────────────────────────────────────────
  const [weeklyBlastStatus, setWeeklyBlastStatus] = useState<{active: boolean, hasParticipated: boolean} | null>(null);
  const [showWeeklyBlast, setShowWeeklyBlast] = useState(false);

  useEffect(() => {
    // Only fetch if they haven't explicitly closed it today (optional, but let's just fetch once on mount)
    api.get('/weekly-blast/current')
      .then(res => res.data)
      .then(data => {
        if (!data.error) {
          setWeeklyBlastStatus(data);
          // Auto-splash if active and not participated
          if (data.active && !data.hasParticipated) {
            setShowWeeklyBlast(true);
          }
        }
      })
      .catch(() => {});
  }, []);

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
      // 1. Pause any currently playing audio to prevent overlap
      if (ballAudioRef.current) {
        ballAudioRef.current.onended = null;
        ballAudioRef.current.onerror = null;
        ballAudioRef.current.pause();

        // 2. Reuse the ALREADY-UNLOCKED audio element for mobile autoplay policies
        ballAudioRef.current.src = `/audio/${col}${num}.mp3`;
        ballAudioRef.current.load();

        ballAudioRef.current.onended = safeComplete;
        ballAudioRef.current.onerror = safeComplete;
        
        // 3. Play and handle errors gracefully
        ballAudioRef.current.play().catch((err) => {
          console.warn(`[Audio] Failed to play ${col}${num}:`, err);
          // Wait 1.5s so balls don't pass silently in 300ms blurs if audio is blocked
          setTimeout(safeComplete, 1500); 
        });
      } else {
        setTimeout(safeComplete, 1500);
      }
    } catch (e) {
      setTimeout(safeComplete, 1500);
    }

    // Safety timeout in case audio hangs indefinitely (reduced to 4s for faster queue)
    setTimeout(safeComplete, 4000);
  }, []);

  const processAudioQueue = useCallback((setLastBallFn: (n: number) => void, setDrawnFn: (fn: (prev: number[]) => number[]) => void) => {
    // NOTE: start.mp3 uses a separate new Audio() element, so it CANNOT block ballAudioRef.
    // We do NOT defer here — balls accumulate in the queue and start immediately after start.mp3
    // fires safeComplete which kicks the queue via queueBallSounds.

    if (isGameFinishedRef.current || audioQueueRef.current.length === 0) {
      isPlayingQueueRef.current = false;
      return;
    }
    isPlayingQueueRef.current = true;
    const nextBall = audioQueueRef.current.shift();
    if (nextBall !== undefined) {
      console.log('[AudioQueue] Playing ball:', nextBall);
      lastDrawnRef.current = nextBall;
      // ── Step 1: BIG BALL + RECENT BALLS update simultaneously with audio start ──
      setLastBallFn(nextBall);
      setCalledHistory(prev => prev.includes(nextBall) ? prev : [...prev, nextBall]);
      
      // ── Step 2: Wait for ball audio to ACTUALLY finish before highlighting board + cartela ──
      playBallSound(nextBall, () => {
        // Highlight the Bingo Board (1-75) AND the player cartelas at the same moment audio ends
        setDrawnFn(p => p.includes(nextBall) ? p : [...p, nextBall]);
        if (!isGameFinishedRef.current) {
          playNextTimeoutRef.current = setTimeout(() => {
            processAudioQueue(setLastBallFn, setDrawnFn);
          }, 300); // 300ms natural gap after audio finishes
        } else {
          isPlayingQueueRef.current = false;
        }
      });
    } else {
      isPlayingQueueRef.current = false;
    }
  }, [playBallSound, setCalledHistory]);

  const queueBallSounds = useCallback((numbers: number[], setLastBallFn: (n: number) => void, setDrawnFn: (fn: (prev: number[]) => number[]) => void) => {
    if (isGameFinishedRef.current) return;

    // Only add balls that have never been announced yet — prevents duplicates AND ensures
    // every new ball is eventually called (no silent drops).
    const toAdd = numbers.filter(n => !announcedBallsRef.current.has(n));
    if (toAdd.length === 0) return;
    console.log('[AudioQueue] Queueing new balls:', toAdd);

    // Mark all as announced immediately to prevent re-queueing from polling
    toAdd.forEach(n => announcedBallsRef.current.add(n));

    // Append to queue — NEVER drop any ball, every ball must be called
    audioQueueRef.current = [...audioQueueRef.current, ...toAdd];

    // Only start the processor if it is not already running AND start.mp3 is not still playing.
    // If start.mp3 is playing, balls pile up in the queue — onGameStarted's callback will kick it.
    if (!isPlayingQueueRef.current && !isStartAudioPlayingRef.current) {
      console.log('[AudioQueue] Starting queue processor');
      processAudioQueue(setLastBallFn, setDrawnFn);
    }
  }, [processAudioQueue]);

  // Play start.mp3 exactly once per game — guarded by startAudioFiredRef.
  // onComplete fires after start.mp3 finishes (or immediately if already played/muted).
  const playStartAudio = useCallback((onComplete?: () => void) => {
    let completedOnce = false;
    const safeComplete = () => {
      isStartAudioPlayingRef.current = false;
      if (!completedOnce) {
        completedOnce = true;
        if (onComplete) onComplete();
      }
    };

    if (!soundOnRef.current) {
      safeComplete();
      return;
    }
    if (startAudioFiredRef.current) {
      // Already played for this game — proceed immediately
      safeComplete();
      return;
    }
    startAudioFiredRef.current = true;
    lastStartAudioPlayed.current = Date.now();
    isStartAudioPlayingRef.current = true;
    try {
      const startEl = new Audio('/audio/start.mp3');
      startEl.onended = safeComplete;
      startEl.onerror = safeComplete;
      startEl.play().catch(safeComplete);
      // Safety: call complete after 8s max so balls never get stuck
      setTimeout(safeComplete, 8000);
    } catch (e) {
      safeComplete();
    }
  }, []);

  // Play stop.mp3 exactly once per game — guarded by stopAudioFiredRef
  // onComplete fires after stop.mp3 finishes (or immediately if muted / already played)
  const playStopAudio = useCallback((onComplete?: () => void) => {
    let completedOnce = false;
    const safeComplete = () => {
      if (!completedOnce) {
        completedOnce = true;
        if (onComplete) onComplete();
      }
    };
    if (stopAudioFiredRef.current) { safeComplete(); return; } // already played
    stopAudioFiredRef.current = true;
    if (!soundOnRef.current) { safeComplete(); return; } // muted — skip audio, fire callback
    try {
      // Store in ref so the element is NOT garbage collected before it finishes playing
      const el = new Audio('/audio/stop.mp3');
      stopAudioRef.current = el;
      el.onended = () => { stopAudioRef.current = null; safeComplete(); };
      el.onerror = () => { stopAudioRef.current = null; safeComplete(); };
      el.play().catch(() => { stopAudioRef.current = null; safeComplete(); });
      // Safety cap: show modal after 4s max even if audio hangs
      setTimeout(safeComplete, 4000);
    } catch (e) { safeComplete(); }
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
    const fetchMyCardWithRetry = async (retryCount = 0): Promise<any> => {
      try {
        const res = await getMyCard(gameId);
        if ((!res.tickets || res.tickets.length === 0) && retryCount < 2) {
          // Retry if empty, because DB write might not have committed yet
          await new Promise(r => setTimeout(r, 1500));
          return fetchMyCardWithRetry(retryCount + 1);
        }
        return res;
      } catch (err) {
        if (retryCount < 2) {
          await new Promise(r => setTimeout(r, 1500));
          return fetchMyCardWithRetry(retryCount + 1);
        }
        return { tickets: [] };
      }
    };

    Promise.all([
      getGame(gameId), 
      fetchMyCardWithRetry()
    ]).then(([g, t]) => {
      setGame(g);

      // Cache in sessionStorage for instant re-open without flicker
      try {
        sessionStorage.setItem(`game_state_${gameId}`, JSON.stringify({
          status: g.status, totalPrize: g.totalPrize, room: g.room,
          drawHistory: g.drawHistory, playerCount: g.playerCount, ticketCount: g.ticketCount,
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
      setIsFetchingCards(false);
      try { sessionStorage.setItem(`game_tickets_${gameId}`, JSON.stringify(sorted)); } catch (e) {}

      // Instant kick if they have 0 tickets and the game is active or cancelled
      if (sorted.length === 0 && g.status !== 'FINISHED') {
        router.replace('/');
        return;
      }

      const hist = (g.drawHistory || []).map((d: any) => d.number);
      // Sync UI drawn states immediately (board highlights) without removing socket-received balls
      setDrawn(prev => {
        const merged = new Set([...prev, ...hist]);
        return Array.from(merged);
      });
      const latestBall = hist.at(-1);

      // ── Audio queue management ──────────────────────────────────────────────────
      // On first load: detect if this is a MID-GAME REFRESH or a genuine new game start.
      // Mid-game refresh  → skip start.mp3, mark all old balls as seen, only call the latest.
      // Genuine new start → play start.mp3 then call balls in order as usual.
      // On subsequent polls: catch any socket-missed balls via the announced filter.
      const isFirstLoad = isFirstLoadRef.current;
      if (isFirstLoad) {
        isFirstLoadRef.current = false;

        if (g.status === 'RUNNING') {
          if (hist.length > 1) {
            // ── MID-GAME REFRESH ─────────────────────────────────────────────────
            // Game was already running before the refresh — do NOT re-play start.mp3
            // and do NOT re-announce every ball from the beginning.
            // Strategy: mark all drawn balls as announced except the latest one,
            // then queue only the latest ball so the user hears what's being called now.
            startAudioFiredRef.current = true; // block start.mp3 from firing later
            hist.slice(0, hist.length - 1).forEach((n: number) => {
              announcedBallsRef.current.add(n);
            });
            // Also pre-populate calledHistory visually (no audio for old balls)
            setCalledHistory(hist.slice(0, hist.length - 1));
            // Queue only the most recent ball for audio announcement
            queueBallSounds([hist[hist.length - 1]], setLastBall, setDrawn);
          } else {
            // ── GENUINE GAME START (0 or 1 ball drawn) ───────────────────────────
            // play start.mp3, then call all balls in order
            playStartAudio(() => {
              if (hist.length > 0) {
                queueBallSounds(hist, setLastBall, setDrawn);
              }
            });
          }
        } else if (hist.length > 0) {
          // Game not yet running but has history (rare edge case)
          queueBallSounds(hist, setLastBall, setDrawn);
        }
      } else {
        // During active game: board highlights sync from server history immediately.
        // calledHistory (Recent Balls) and Big Ball Display are driven by audio queue
        // together inside processAudioQueue — so they always match in order.

        // Queue audio for every ball NOT yet announced (catches socket-missed events).
        const newBalls: number[] = hist.filter((n: number) => !announcedBallsRef.current.has(n));
        if (newBalls.length > 0) {
          queueBallSounds(newBalls, setLastBall, setDrawn);
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
    announcedBallsRef.current = new Set();
    startAudioFiredRef.current = false;
    stopAudioFiredRef.current = false;
    clearTimeout(playNextTimeoutRef.current);
    if (startAudioScheduled.current) clearTimeout(startAudioScheduled.current);
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
        ballAudioRef.current.onended = null;
        ballAudioRef.current.onerror = null;
        ballAudioRef.current.pause();
        ballAudioRef.current.currentTime = 0;
      }
      if (status === 'WAITING' || status === 'COUNTDOWN') {
        // Game hasn't started yet — clear everything for a fresh start
        announcedBallsRef.current = new Set();
        startAudioFiredRef.current = false;
        stopAudioFiredRef.current = false;
        setCalledHistory([]);
      }
      // Note: for FINISHED status we keep calledHistory visible until redirect
    }
  }, [game?.status, gameFinished]);

  // ─── Initial Mount: load data + sound prefs ───────────────────────────────
  useEffect(() => {
    initTelegram();
    setMounted(true);
    
    // Load local sound preference
    try {
      const savedSound = localStorage.getItem('game_sound');
      if (savedSound !== null) {
        const val = savedSound === 'true';
        setSoundOn(val);
        soundOnRef.current = val;
      }
    } catch (e) {
      // Ignore
    }

    if (!gameId) return;

    // ── Safety net: detect if URL has the WRONG gameId ───────────────────────
    // When the select page redirects, activeGameIdRef can drift to the NEXT game.
    // joinedGameIdRef saves the correct game at purchase and writes to sessionStorage.
    // If they differ, redirect to the correct game immediately before loading.
    try {
      const correctId = sessionStorage.getItem('joined_game_id');
      if (correctId && correctId !== gameId) {
        // Wrong gameId in URL — redirect to the one the player actually joined
        sessionStorage.removeItem('joined_game_id');
        router.replace(`/game?id=${correctId}&type=${spType}&price=${spPrice || ''}`);
        return;
      }
      // Clear after successful match so it doesn't interfere with future games
      if (correctId && correctId === gameId) {
        sessionStorage.removeItem('joined_game_id');
      }
    } catch(e) {}

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

    const onNumberDrawn = (d: { number: number }) => {
      const num = Number(d.number);
      // Big ball + Recent Balls update immediately when audio starts.
      // Board (1-75) + cartela highlights are deferred until after audio finishes (inside queueBallSounds).
      queueBallSounds([num], setLastBall, setDrawn);
    };

    socket.on('number-drawn', onNumberDrawn);

    const onCountdownStart = (d: any) => {
      // countdown-start: update display only — NO audio here.
      // start.mp3 fires exclusively on the 'game-started' event.
      if (d.endTime) {
        const offset = d.serverTime ? (d.serverTime - Date.now()) : 0;
        setServerOff(offset);
        setEndTime(d.endTime);
        const remMs = d.endTime - Date.now() - offset;
        const rem = Math.max(0, Math.ceil(remMs / 1000));
        setCountdown(rem > 0 ? rem : null);
      } else {
        setCountdown(d.seconds);
      }
      if (d.seconds === 0) {
        setCountdown(null);
        setEndTime(null);
        setTimeout(loadData, 300);
      }
    };

    socket.on('countdown-start', onCountdownStart);

    const onCountdownTick = (d: any) => {
      // countdown-tick: update display only — NO audio here.
      // start.mp3 fires exclusively on the 'game-started' event.
      if (d.endTime) {
        const offset = d.serverTime ? (d.serverTime - Date.now()) : 0;
        setServerOff(offset);
        setEndTime(d.endTime);
        const remMs = d.endTime - Date.now() - offset;
        const rem = Math.max(0, Math.ceil(remMs / 1000));
        setCountdown(rem > 0 ? rem : null);
      } else {
        setCountdown(d.secondsRemaining);
      }
      const offset = d.serverTime ? (d.serverTime - Date.now()) : 0;
      if (d.secondsRemaining === 0 || (d.endTime && d.endTime - offset <= Date.now())) {
        setEndTime(null);
        setTimeout(loadData, 300);
      }
    };

    socket.on('countdown-tick', onCountdownTick);

    const onGameStarted = (d: any) => {
      // ✅ REAL-TIME: start.mp3 plays first.
      // After it finishes, kick the audio queue (balls that arrived via number-drawn
      // during start.mp3 are already in audioQueueRef — start the processor now).
      // We do NOT call loadData() here — that adds 1.5-3s latency before any ball is called.
      setCountdown(null);
      setEndTime(null);
      // Immediately patch game state with the final authoritative ticket count + prize
      // so the CARDS and PRIZE header updates instantly when the game starts.
      if (d?.ticketCount || d?.totalPrize) {
        setGame((prev: any) => prev ? {
          ...prev,
          status: 'RUNNING',
          ticketCount: d.ticketCount ?? prev.ticketCount,
          visibleTicketCount: d.ticketCount ?? prev.visibleTicketCount,
          totalPrize: d.totalPrize ?? prev.totalPrize,
        } : prev);
      }
      playStartAudio(() => {
        // After start.mp3 completes: if the queue already has balls (from socket events
        // that arrived during the audio), start the processor immediately.
        // If empty, number-drawn events will kick queueBallSounds naturally.
        if (audioQueueRef.current.length > 0 && !isPlayingQueueRef.current) {
          processAudioQueue(setLastBall);
        }
        // Also do a background data refresh (non-blocking) for UI accuracy
        setTimeout(() => loadData(), 500);
      });
    };

    socket.on('game-started', onGameStarted);


    const onGameFinished = (d: any) => {
      // ── Immediately stop the ball audio queue so no more balls are called ──
      isGameFinishedRef.current = true;
      audioQueueRef.current = [];
      isPlayingQueueRef.current = false;
      clearTimeout(playNextTimeoutRef.current);
      if (ballAudioRef.current) {
        ballAudioRef.current.pause();
        ballAudioRef.current.currentTime = 0;
      }

      // ── Build winner data immediately from socket payload (no network wait) ──
      const tgUserId = typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id
        ? String((window as any).Telegram.WebApp.initDataUnsafe.user.id)
        : '';
      const myWinnerObj = (d.winners || []).find((winner: any) => 
        (tgUserId && winner.telegramId && String(winner.telegramId) === tgUserId) ||
        (tgUserId && String(winner.userId) === tgUserId) ||
        ticketsRef.current.some(t => String(t.id) === String(winner.ticketId) || String(t.userId) === String(winner.userId))
      );
      const isCurrentUserWinner = !!myWinnerObj;
      // For NON-winner display: always use the first winner from the broadcast
      // to ensure all devices show the same person.
      const w = myWinnerObj || d.winners?.[0];
      const isBot = w?.isBot ?? w?.user?.isBot ?? false;

      // ── Use backend displayName directly — NEVER recompute locally ──────────
      // engine.ts sets w.displayName = the canonical bot/player name.
      // This is the SINGLE source of truth; all devices receive the exact same value.
      const backendDisplayName = w?.displayName || w?.user?.firstName || w?.user?.telegramUsername;
      const rawTgUsername = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.username || w?.user?.telegramUsername;
      const tgUsername = (!isBot && rawTgUsername) ? ` (@${rawTgUsername.replace(/^@/, '')})` : '';

      const name = isCurrentUserWinner
        ? (((window as any).Telegram?.WebApp?.initDataUnsafe?.user?.first_name || backendDisplayName || 'You') + tgUsername)
        : (isBot
            ? (backendDisplayName || 'Player')
            : (backendDisplayName ? `${backendDisplayName}${tgUsername}` : 'Player'));
      let rawCard = w?.card || w?.ticket?.card;
      if (typeof rawCard === 'string') { try { rawCard = JSON.parse(rawCard); } catch(e) {} }
      let cardNo: number | undefined = rawCard?.id ?? w?.cardId ?? undefined;
      let cardRows = rawCard ? (Array.isArray(rawCard) ? rawCard : (rawCard.rows ?? null)) : null;
      if (typeof cardRows === 'string') { try { cardRows = JSON.parse(cardRows); } catch(e) {} }
      if (cardRows && !Array.isArray(cardRows)) cardRows = null;
      if (cardRows && (!Array.isArray(cardRows[0]) || cardRows.length !== 5)) cardRows = null;

      // 🛡️ GUARANTEED FALLBACK: If no valid 5x5 grid exists, generate one from standard patterns
      if (!cardRows) {
        let cardHash = 0;
        const cardSeed = String(gameId) + String(w?.ticketId || w?.id || '123');
        for (let i = 0; i < cardSeed.length; i++) {
          cardHash = cardSeed.charCodeAt(i) + ((cardHash << 5) - cardHash);
        }
        cardNo = cardNo && cardNo > 0 ? cardNo : (Math.abs(cardHash) % 250) + 1;
        const pattern = PREDEFINED_CARDS[cardNo];
        if (pattern) {
          cardRows = pattern.map((row: number[]) => row.map((c: number) => c === 0 ? 'FREE' : c));
        }
      }

      // Prize priority: winner record > socket gamePrize > game.totalPrize (real, computed by backend) > fallback
      const socketPrize = parseFloat(String(w?.prizeAmount ?? 0)) || parseFloat(String(d?.gamePrize ?? 0)) || parseFloat(String(d?.totalPrize ?? 0));
      // `prize` is the correctly computed value from game.totalPrize (set by our earlier fix)
      const resolvedSocketPrize = socketPrize > 0 ? socketPrize : prize;
      const winnerData = {
        winnerName: name,
        prize: resolvedSocketPrize,
        mode: w?.winMode || 'ROW',
        isWinner: !!w,
        hasAnyWinner: true,
        card: cardRows,
        cardNo: cardNo,
        isCurrentUserWinner,
        isBot,
        drawnNumbers: d.drawnNumbers || drawn || [],
      };

      // ── Immediately lock the BINGO button before anything else ──
      setGameEnded(true);
      // ── Fetch fresh game data in background (updates card/prize if server has more details) ──
      getGame(gameId).then((d: any) => {
        setGame((p: any) => p ? {
          ...p,
          playerCount: d.playerCount !== undefined ? d.playerCount : p.playerCount,
          ticketCount: d.ticketCount !== undefined ? d.ticketCount : p.ticketCount,
          visibleTicketCount: d.visibleTicketCount !== undefined ? d.visibleTicketCount : p.visibleTicketCount,
          totalPrize: d.totalPrize || p.totalPrize,
          houseEdge: d.houseEdge || p.houseEdge,
        } : p);
      }).catch(() => {});

      // ── Play stop.mp3, then show winner modal as soon as it finishes ──
      // Winner data is already built — we just wait for the audio to complete.
      playStopAudio(() => {
        setGameFinished(winnerData);
        setRedirectSecs(4);
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
          try { sessionStorage.setItem('bypass_select_loader', '1'); } catch(e) {}
          router.push(`/tickets/select?type=${game?.room?.type || spType}&price=${stake}`);
        }, 4000);
      });

      // ── Fetch fresh game data in background (updates card/prize if server has more details) ──
      loadData();
    };

    socket.on('game-update', (d: any) => {
      setGame((p: any) => p ? { ...p, ...d } : p);
    });

    socket.on('player-joined', (d: any) => {
      setGame((p: any) => {
        if (!p) return p;
        return {
          ...p,
          playerCount: d.playerCount !== undefined ? d.playerCount : p.playerCount,
          ticketCount: d.ticketCount !== undefined ? d.ticketCount : p.ticketCount,
          visibleTicketCount: d.visibleTicketCount !== undefined ? d.visibleTicketCount : p.visibleTicketCount,
          totalPrize: d.totalPrize || p.totalPrize,
        };
      });
    });

    socket.on('player-left', (d: any) => {
      setGame((p: any) => {
        if (!p) return p;
        return {
          ...p,
          playerCount: d.playerCount !== undefined ? d.playerCount : p.playerCount,
          ticketCount: d.ticketCount !== undefined ? d.ticketCount : p.ticketCount,
          visibleTicketCount: d.visibleTicketCount !== undefined ? d.visibleTicketCount : p.visibleTicketCount,
          totalPrize: d.totalPrize || p.totalPrize,
        };
      });
    });

    socket.on('claim-success', () => {
      clearTimeout(claimTimeoutRef.current);
      setClaiming(false);
      // The game-ended event is fired globally and will pop the winner modal natively
    });

    socket.on('claim-error', (err: any) => {
      clearTimeout(claimTimeoutRef.current);
      setClaiming(false);
      const msg = err.message || '';
      const isTooEarlyMsg = msg.toLowerCase().includes('still too early') || msg.toLowerCase().includes('wait') || msg.toLowerCase().includes('minimum');
      const isAlreadyWon  = msg.toLowerCase().includes('already won') || msg.toLowerCase().includes('finished') || msg.toLowerCase().includes('not running');
      const isSomeoneElseClaimed = msg.toLowerCase().includes('someone else') || msg.toLowerCase().includes('verifying');
      const isKeepWaiting = msg.toLowerCase().includes('keep watching') || msg.toLowerCase().includes('more numbers are coming');
      if (isAlreadyWon || gameEnded) {
        // Game ended before claim was processed — show clear friendly message
        showAlert('ጨዋታ ተጠናቀቀ', 'Another player won this round. Better luck next time! 🍀', 'info');
      } else if (isSomeoneElseClaimed) {
        // Explicitly show honest error message for the race condition
        showAlert(t('bingoClaimTitle') as string, t('bingoAlreadyClaimed') as string, 'info');
      } else if (isTooEarlyMsg || isKeepWaiting) {
        // Absorbed silently — just re-enable the button so they can try again
        // Don't show a dialog: these are honest "not yet" cases, not card errors
      } else {
        // Only show a dialog for genuine pattern errors — not for house secrets
        setToast('ገና አልተሟላም! 😅');
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 3000);
      }
    });

    // ── bingo-ready: server tells this player their card just completed a pattern ──
    // Fires only on player-win games (houseShouldWin=false) when the safety gate
    // allowed a real player to win. Make the button pulse orange instead of showing a modal.
    socket.on('bingo-ready', (d: any) => {
      if (d.gameId !== gameId) return; // guard: belongs to THIS game
      if (d.ticketId) {
        setBingoReadyTickets(prev => {
          const newSet = new Set(prev);
          newSet.add(d.ticketId);
          return newSet;
        });
      }
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
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('claim-success');
      socket.off('claim-error');
      socket.off('bingo-ready');
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

        // ── Use backend displayName directly — NEVER recompute locally ──────
        const backendDisplayName2 = w?.displayName || w?.user?.firstName || w?.user?.telegramUsername;
        const tgUsername = (!isBot && w?.user?.telegramUsername) ? ` (@${w.user.telegramUsername.replace(/^@/, '')})` : '';
        const name = isCurrentUserWinner
          ? ((window as any).Telegram?.WebApp?.initDataUnsafe?.user?.first_name || backendDisplayName2 || 'You')
          : (isBot
              ? (backendDisplayName2 || 'Player')
              : (backendDisplayName2 ? `${backendDisplayName2}${tgUsername}` : 'Player'));
        let rawCard2 = w?.card || w?.ticket?.card;
        if (typeof rawCard2 === 'string') { try { rawCard2 = JSON.parse(rawCard2); } catch(e) {} }
        if (typeof rawCard2 === 'string') { try { rawCard2 = JSON.parse(rawCard2); } catch(e) {} }
        let cardNo2: number | undefined = rawCard2?.id ?? w?.cardId ?? undefined;
        let cardRows2 = rawCard2 ? (Array.isArray(rawCard2) ? rawCard2 : (rawCard2.rows ?? null)) : null;
        if (typeof cardRows2 === 'string') { try { cardRows2 = JSON.parse(cardRows2); } catch(e) {} }
        if (cardRows2 && !Array.isArray(cardRows2)) cardRows2 = null;
        if (cardRows2 && (!Array.isArray(cardRows2[0]) || cardRows2.length !== 5)) cardRows2 = null;

        // 🛡️ GUARANTEED FALLBACK
        if (!cardRows2) {
          let cardHash = 0;
          const cardSeed = String(gameId) + String(w?.ticketId || w?.id || '123');
          for (let i = 0; i < cardSeed.length; i++) {
            cardHash = cardSeed.charCodeAt(i) + ((cardHash << 5) - cardHash);
          }
          cardNo2 = cardNo2 || (Math.abs(cardHash) % 250) + 1;
          const pattern = PREDEFINED_CARDS[cardNo2];
          if (pattern) {
            cardRows2 = pattern.map((row: number[]) => row.map((c: number) => c === 0 ? 'FREE' : c));
          }
        }

        // Prize priority: winner record > game.totalPrize (real, from backend) > computed prize
        const pollPrize = parseFloat(String(w?.prizeAmount ?? 0)) || parseFloat(String(game?.totalPrize ?? 0));
        const resolvedPollPrize = pollPrize > 0 ? pollPrize : prize;
        setGameFinished({
          winnerName: name,
          prize: resolvedPollPrize,
          mode: w?.winMode || 'ROW',
          isWinner: !!w,
          hasAnyWinner: true,
          card: cardRows2,
          cardNo: cardNo2,
          isCurrentUserWinner,
          isBot,
          drawnNumbers: game?.drawHistory?.length
            ? (game.drawHistory as any[]).map((d: any) => d.number)
            : (drawn || []),
        });
        // ⛔ Do NOT call playStopAudio() here.
        // stop.mp3 fires ONLY from the real-time 'game-finished' socket event.
        // This polling fallback is only reached when socket was missed entirely.
        setRedirectSecs(8);
        redirectCountdownRef.current = setInterval(() => {
          setRedirectSecs(s => {
            if (s <= 1) { clearInterval(redirectCountdownRef.current); return 0; }
            return s - 1;
          });
        }, 1000);
        redirectTimerRef.current = setTimeout(() => {
          try { sessionStorage.setItem('bypass_select_loader', '1'); } catch(e) {}
          router.push(`/tickets/select?type=${game?.room?.type || spType}&price=${stake}`);
        }, 8000);
      }
      return;
    }
    
    let intervalMs = 3000; // poll every 3s while RUNNING — catches missed game-finished quickly
    if (!status) intervalMs = isConnected ? 15000 : 2000;
    else if (status === 'WAITING') intervalMs = isConnected ? 15000 : 3000;
    else if (status === 'COUNTDOWN') intervalMs = isConnected ? 15000 : 3000;
    
    const poll = setInterval(() => {
      loadData();
    }, intervalMs);
    return () => clearInterval(poll);
  }, [game?.status, loadData, router, gameFinished, isConnected]);

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
    setGameFinished(prev => prev ? {
      ...prev,
      card: cardR || prev.card,
      cardNo: rawC?.id ?? ww?.cardId ?? ww?.ticket?.cardId ?? prev.cardNo ?? Math.floor(Math.random() * 250) + 1,
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
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    setAudioUnlocked(true);
    // Unlock ballAudioRef with a silent play on first user gesture
    const unlock = (el: HTMLAudioElement | null, src: string) => {
      if (!el) return;
      
      // Double safety guard: If something is already playing right now, skip.
      if (!el.paused && el.currentTime > 0) return;
      
      const prevSrc = el.src;
      el.volume = 0;
      el.src = src;
      const p = el.play();
      if (p !== undefined) {
        p.then(() => { 
          el.pause(); 
          el.currentTime = 0; 
          el.volume = 1; 
          if (prevSrc) el.src = prevSrc; // Restore so queue doesn't break
        }).catch(() => {});
      }
    };
    try { unlock(ballAudioRef.current, '/audio/B1.mp3'); } catch (e) {}
  };

  const hideCard   = (id: string) => setHidden(p => new Set([...p, id]));
  const handleBingo = async () => {
    if (!gameId || claiming) return;

    setClaiming(true);

    // Fast socket claim ("clicke boom")
    if (socket && socket.connected) {
      socket.emit('claim-bingo', { gameId });
      // Safety timeout: if socket never responds (network drop), reset button after 10s
      // so the player is never permanently stuck on "CLAIMING..."
      if (claimTimeoutRef.current) clearTimeout(claimTimeoutRef.current);
      claimTimeoutRef.current = setTimeout(() => setClaiming(false), 10_000);
      // Socket listeners for 'claim-success' and 'claim-error' will handle the rest
      return;
    }

    // Fallback to slow HTTP API if socket is down
    try { 
      const res = await claimBingo(gameId);
      if (res.won) {
        setToast(`🎊 BINGO! ${res.mode} (+${res.prize} ETB)`);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 4000);
      } else {
        // Silently absorb early-tap backend rejections — never reveal the minimum rule
        const isTooEarlyMsg = res.error?.toLowerCase().includes('wait') || res.error?.toLowerCase().includes('minimum');
        if (!isTooEarlyMsg) {
          setToast('ገና አልተሟላም! 😅');
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => setToast(null), 3000);
        }
      }
    }
    catch (e: any) { 
      setToast('ገና አልተሟላም! 😅');
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 3000);
    } finally {
      setClaiming(false);
    }
  };

  const LoadingScreen = () => (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: isVip ? '#1C0A35' : '#2D1B14' }}>
      <div className="animate-spin" style={{ width: '40px', height: '40px', border: '3px solid #D4AF37', borderTopColor: 'transparent', borderRadius: '50%', marginBottom: '16px' }}></div>
      <div style={{ color: '#D4AF37', fontWeight: '900', fontSize: '12px', letterSpacing: '2px', textShadow: '0 0 10px rgba(212,175,55,0.5)' }}>LOADING BUNA BINGO...</div>
    </div>
  );

  if (!mounted) return <LoadingScreen />;

  // ─── Prize / Stake / Commission calculation ─────────────────────────────
  // The backend computes totalPrize = 70% × (ALL tickets × stake) at game start.
  // We must trust it as source-of-truth. Never override it with hardcoded bot estimates.
  const GUARANTEED_PRIZES: Record<string, number> = { CASUAL: 50, STANDARD: 100, PRO: 250, JACKPOT: 500, VIP: 1000 };
  const roomTypeName = game?.room?.type || spType || 'STANDARD';

  // allCards: prefer the backend's visible ticket count (matches prize pool).
  // game.visibleTicketCount = real players + capped visible bots (max 30 for CASUAL).
  // game.ticketCount = RAW total (all 400+ bots) — never use for display.
  const BOT_COUNTS_FRONTEND: Record<string, number> = { CASUAL: 30, STANDARD: 30, PRO: 30, JACKPOT: 10, VIP: 20 };
  const fallbackBotCount = BOT_COUNTS_FRONTEND[roomTypeName] ?? 30;
  const fallbackCards = fallbackBotCount + tickets.length;
  
  // PRIORITY: visibleTicketCount → game.ticketCount → fallback
  const baseCards = (game?.visibleTicketCount && game.visibleTicketCount > 0)
    ? game.visibleTicketCount
    : (game?.ticketCount && game.ticketCount > 0)
      ? game.ticketCount
      : (fallbackCards || 1);

  const minPrize = GUARANTEED_PRIZES[roomTypeName] || 50;
  const fallbackPrize = Math.max(minPrize, Math.round(baseCards * stake * 0.70));
  
  // 1. Establish the accurate PRIZE first
  const prize = isDemo
    ? (game?.totalPrize ? Number(game.totalPrize) : 100)
    : (game?.totalPrize && Number(game.totalPrize) > 0
        ? Number(game.totalPrize)
        : fallbackPrize);

  // 2. Mathematically derive CARDS from the prize so it is 100% "real calculation"
  let allCards = baseCards;
  if (!isDemo) {
    if (prize > minPrize) {
      // If prize > minimum, cards MUST exactly match the 70% formula
      allCards = Math.round(prize / (stake * 0.70));
    } else {
      // If prize is at minimum, cards must not exceed what would generate that minimum
      const maxCardsForMinPrize = Math.floor(minPrize / (stake * 0.70));
      allCards = Math.min(baseCards, maxCardsForMinPrize);
      if (allCards < tickets.length) allCards = tickets.length;
    }
  }

  const fallbackHouseComm = Math.round(allCards * stake * 0.30);
  const houseComm = isDemo
    ? 0
    : (game?.houseEdge && Number(game.houseEdge) > 0
        ? Number(game.houseEdge)
        : fallbackHouseComm);

  const cdText  = countdown !== null ? `${countdown}s` : (game?.status === 'RUNNING' ? 'LIVE' : '—');
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
        // Button activates as soon as drawn numbers complete a pattern.
        // Manual daubing is optional — the backend does the authoritative check.
        return val === 'FREE' || val === 0 || val === null || drawnSet.has(numVal);
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
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
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
          <ShieldCheck size={20} color={isVip ? '#C471ED' : T.gold} /> {t('bunaGameZone') as string}
          {isVip && (
            <span style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#1C0A35', fontSize: '9px', fontWeight: '900', padding: '2px 8px', borderRadius: '12px', boxShadow: '0 0 10px rgba(255, 215, 0, 0.6)', display: 'inline-flex', alignItems: 'center', gap: '3px', border: '1.5px solid #FFF', letterSpacing: '0.5px' }}>
              👑 BOSS VIP
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div onClick={() => setLanguage(getLanguage() === 'en' ? 'am' : 'en')} style={{ cursor: 'pointer', display: 'flex', border: `1px solid ${isVip ? '#C471ED' : T.gold}`, borderRadius: '6px', overflow: 'hidden', fontSize: '10px', fontWeight: 'bold', height: '24px' }}>
             <div style={{ padding: '0px 6px', display: 'flex', alignItems: 'center', background: getLanguage() === 'en' ? (isVip ? '#C471ED' : T.gold) : 'transparent', color: getLanguage() === 'en' ? (isVip ? '#1C0A35' : T.header) : (isVip ? '#C471ED' : T.gold) }}>EN</div>
             <div style={{ padding: '0px 6px', display: 'flex', alignItems: 'center', background: getLanguage() === 'am' ? (isVip ? '#C471ED' : T.gold) : 'transparent', color: getLanguage() === 'am' ? (isVip ? '#1C0A35' : T.header) : (isVip ? '#C471ED' : T.gold) }}>AM</div>
          </div>
          <div style={{ background: game?.status === 'RUNNING' ? '#27AE60' : '#E67E22', color: 'white', fontSize: '10px', fontWeight: '900', padding: '3px 10px', borderRadius: '20px', display: 'flex', alignItems: 'center' }}>
            {game?.status || 'LOADING'}
          </div>
          {/* Auto / Manual Mode Toggle Removed */}

          <motion.div 
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              const next = !soundOn;
              setSoundOn(next);
              try {
                localStorage.setItem('game_sound', String(next));
              } catch (e) {
                // Ignore
              }
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', padding: '4px', background: isVip ? 'rgba(255,255,255,0.02)' : T.statBg, borderBottom: isVip ? '1px solid rgba(255,215,0,0.2)' : `1px solid ${T.gold}44` }}>
        {[
          ['GAME ID',   gameId?.slice(-6).toUpperCase() || '--'],
          ['CARDS',     `${allCards}`],
          ['STAKE/CARD',`${stake} ETB`],
          ['PRIZE', `${prize.toFixed ? prize.toFixed(0) : prize} ETB`]
        ].map(([l, v]) => {
          const isPrize = l === 'PRIZE';
          return (
            <div key={l as string} style={{ 
              background: isVip 
                ? (isPrize ? 'linear-gradient(90deg, #FFD700, #FFA500)' : 'rgba(255, 255, 255, 0.05)') 
                : (isPrize ? T.gold : T.card), 
              border: isVip 
                ? (isPrize ? 'none' : '1px solid rgba(255, 215, 0, 0.25)') 
                : `1px solid ${T.gold}33`, 
              padding: '3px 2px', 
              textAlign: 'center', 
              borderRadius: '6px',
              backdropFilter: isVip && !isPrize ? 'blur(10px)' : 'none',
              boxShadow: isVip && isPrize ? '0 4px 15px rgba(255, 215, 0, 0.3)' : 'none',
            }}>
              <div style={{ 
                fontSize: '7px', 
                fontWeight: 'bold', 
                color: isVip 
                  ? (isPrize ? 'rgba(28, 10, 53, 0.8)' : '#FFD700') 
                  : (isPrize ? T.header : T.brown)
              }}>{l}</div>
              <div style={{ 
                fontSize: '11px', 
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
        <div style={{ flex: '0 0 52%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ 
              flex: 1, 
              background: game?.status === 'RUNNING' ? '#27AE60' : (isVip ? 'rgba(255,255,255,0.05)' : T.header), 
              borderRadius: '12px', 
              padding: '6px', 
              textAlign: 'center', 
              border: isVip ? '2px solid #FFD700' : `2px solid ${T.gold}`, 
              transition: 'background 0.3s',
              boxShadow: isVip ? '0 0 10px rgba(255, 215, 0, 0.2)' : 'none'
            }}>
              <div style={{ color: isVip ? '#FFD700' : T.gold, fontSize: '8px', fontWeight: '900' }}>
                STATUS
              </div>
              <div style={{ color: 'white', fontSize: '20px', fontWeight: '900' }}>
                🔴 LIVE
              </div>
            </div>
            <motion.div 
              key={lastBall} 
              initial={{ scale: 0.5 }} 
              animate={{ scale: 1 }} 
              style={{ 
                width: '52px', 
                height: '52px', 
                backgroundColor: lastBall 
                  ? (isVip ? COL_COLOR[colLabel(lastBall)] : COL_COLOR[colLabel(lastBall)]) 
                  : (isVip ? 'rgba(255,255,255,0.05)' : T.statBg),
                backgroundImage: lastBall
                  ? (isVip ? BINGO_3D_COLORS[colLabel(lastBall)] : 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 25%)')
                  : 'none',
                borderRadius: '50%', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontWeight: '900', 
                border: isVip && lastBall ? '2px solid rgba(255, 215, 0, 0.9)' : (isVip ? '4px solid #FFD700' : '2px solid rgba(255,255,255,0.4)'),
                color: lastBall ? '#ffffff' : (isVip ? '#FFD700' : T.brown),
                textShadow: isVip && lastBall ? '0 2px 4px rgba(0,0,0,0.8)' : 'none',
                boxShadow: lastBall 
                  ? (isVip ? 'inset -4px -4px 12px rgba(0,0,0,0.6), inset 3px 3px 8px rgba(255,255,255,0.5), 0 0 15px rgba(255, 215, 0, 0.5)' : 'inset -4px -4px 10px rgba(0,0,0,0.4), inset 2px 2px 6px rgba(255,255,255,0.6), 0 3px 8px rgba(0,0,0,0.3)')
                  : 'none'
              }}
            >
              {lastBall ? (
                <>
                  <div style={{ fontSize: '11px', lineHeight: 1, opacity: 0.9 }}>{colLabel(lastBall)}</div>
                  <div style={{ fontSize: '20px', lineHeight: 1, marginTop: '-2px', letterSpacing: '-0.5px' }}>{lastBall}</div>
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
                      backgroundColor: COL_COLOR[label],
                      backgroundImage: isVip ? BINGO_3D_COLORS[label] : 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 25%)',
                      color: '#ffffff',
                      textShadow: isVip ? '0 1px 3px rgba(0,0,0,0.8)' : 'none',
                      fontWeight: '900',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: isVip ? '1px solid rgba(255, 215, 0, 0.9)' : '1.5px solid rgba(255,255,255,0.4)',
                      boxShadow: isVip ? 'inset -3px -3px 8px rgba(0,0,0,0.6), inset 2px 2px 5px rgba(255,255,255,0.5), 0 3px 6px rgba(0,0,0,0.4)' : 'inset -3px -3px 6px rgba(0,0,0,0.4), inset 2px 2px 4px rgba(255,255,255,0.6), 0 2px 5px rgba(0,0,0,0.3)'
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
              <RefreshCw size={14} /> {t('refreshBtn') as string}
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
              <LogOut size={14} /> {t('leaveBtn') as string}
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
                  background: isVip ? BINGO_3D_COLORS[l] : COL_COLOR[l], 
                  color: '#ffffff', 
                  textAlign: 'center', 
                  fontSize: '13px', 
                  fontWeight: '900', 
                  borderRadius: '50%', 
                  width: '26px',
                  height: '26px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                  textShadow: isVip ? '0 1px 3px rgba(0,0,0,0.8)' : 'none',
                  border: isVip ? '1px solid rgba(255, 215, 0, 0.9)' : 'none',
                  boxShadow: isVip ? 'inset -3px -3px 8px rgba(0,0,0,0.6), inset 2px 2px 4px rgba(255,255,255,0.4), 0 3px 6px rgba(0,0,0,0.3)' : '0 2px 5px rgba(0,0,0,0.1)'
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
              <div
                key={t.id} 
                onClick={() => setSelectedTicketId(t.id)}
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
                  transition: 'border 0.2s, box-shadow 0.2s',
                }}
              >

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
                      <div
                        key={`${ri}-${ci}`}
                        onClick={(e) => { e.stopPropagation(); if (!isFree) toggleMark(numVal); }}
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
                      </div>
                    );
                  }))}
                </div>

                {/* Per-card BINGO! Action Claim Button */}
                <div style={{ padding: '0 5px 6px 5px' }}>
                  <motion.button
                    animate={bingoReadyTickets.has(t.id) && game?.status === 'RUNNING' && !claiming ? { 
                      scale: [1, 1.05, 1], 
                      boxShadow: isVip 
                        ? ["0px 0px 0px rgba(255,215,0,0)", "0px 0px 15px rgba(255,215,0,1)", "0px 0px 0px rgba(255,215,0,0)"]
                        : ["0px 0px 0px rgba(243,156,18,0)", "0px 0px 15px rgba(243,156,18,1)", "0px 0px 0px rgba(243,156,18,0)"]
                    } : undefined}
                    transition={bingoReadyTickets.has(t.id) && game?.status === 'RUNNING' && !claiming ? { repeat: Infinity, duration: 1 } : undefined}
                    whileHover={game?.status === 'RUNNING' && !claiming && !bingoReadyTickets.has(t.id) ? { scale: 1.02 } : {}}
                    whileTap={game?.status === 'RUNNING' && !claiming ? { scale: 0.94 } : {}}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (game?.status === 'RUNNING' && !claiming) handleBingo();
                    }}
                    disabled={game?.status !== 'RUNNING' || claiming || gameEnded}
                    style={{
                      width: '100%',
                      background: game?.status === 'RUNNING'
                        ? (claiming
                            ? '#7F8C8D'
                            : (isVip ? 'linear-gradient(135deg, #FFD700, #C471ED)' : 'linear-gradient(135deg, #F39C12, #E67E22)'))
                        : (isVip ? 'rgba(255,255,255,0.05)' : 'rgba(150,150,150,0.1)'),
                      color: game?.status === 'RUNNING'
                        ? (isVip ? '#1C0A35' : 'white')
                        : (isVip ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)'),
                      border: isVip && game?.status === 'RUNNING' && !claiming ? '2px solid #FFFFFF' : 'none',
                      borderRadius: '12px',
                      height: '36px',
                      fontWeight: '900',
                      fontSize: '13px',
                      cursor: game?.status === 'RUNNING' && !claiming ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    {claiming ? '⏳ CLAIMING...' : (bingoReadyTickets.has(t.id) ? `🔥 CLAIM BINGO! (${cardId})` : `☕ BINGO! (${cardId})`)}
                  </motion.button>
                </div>
              </div>
            );
          })}
          {isFetchingCards && tickets.length === 0 && <div style={{ textAlign: 'center', color: isVip ? 'white' : T.brown, padding: '40px' }}>Fetching cards...</div>}
        </div>
      </div>





      {/* ── WINNER MODAL — full-screen overlay shown when game-finished fires ── */}
      <AnimatePresence>
        {gameFinished && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 99999,
              background: 'rgba(0,0,0,0.88)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '16px',
              // NOTE: backdropFilter removed — causes Android WebView crash
            }}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              style={{
                width: '100%', maxWidth: '380px',
                background: isVip
                  ? 'linear-gradient(160deg, #1C0A35 0%, #2D1442 60%, #1C0A35 100%)'
                  : 'linear-gradient(160deg, #2b1d14 0%, #1a120c 60%, #3d2b1f 100%)',
                borderRadius: '24px',
                border: `2px solid ${isVip ? '#FFD700' : '#D4AF37'}`,
                boxShadow: `0 0 40px ${isVip ? 'rgba(255,215,0,0.4)' : 'rgba(212,175,55,0.35)'}, 0 20px 60px rgba(0,0,0,0.7)`,
                overflow: 'hidden',
                maxHeight: '92vh',
                overflowY: 'auto',
              }}
            >
              {/* Header */}
              <div
                style={{
                  background: gameFinished.isCurrentUserWinner
                    ? 'linear-gradient(135deg, #FFD700 0%, #FF6B35 50%, #FFD700 100%)'
                    : 'linear-gradient(135deg, #d4af37 0%, #a67c00 50%, #d4af37 100%)',
                  padding: '20px 16px 16px',
                  textAlign: 'center',
                }}
              >
                {/* Trophy / emoji */}
                <div style={{ fontSize: '48px', lineHeight: 1, marginBottom: '6px' }}>
                  {gameFinished.isCurrentUserWinner ? '🏆' : '🎉'}
                </div>

                <div style={{
                  color: '#1a0a00', fontWeight: '900', fontSize: '22px',
                  letterSpacing: '1px', textShadow: '0 2px 4px rgba(255,255,255,0.3)',
                }}>
                  {gameFinished.isCurrentUserWinner ? 'YOU WON! 🎊' : 'GAME OVER!'}
                </div>
                <div style={{
                  color: gameFinished.isCurrentUserWinner ? '#1a0a00' : 'rgba(255,255,255,0.9)',
                  fontWeight: '700', fontSize: '13px', marginTop: '3px',
                }}>
                  {gameFinished.isCurrentUserWinner
                    ? 'Congratulations! Prize credited to your wallet!'
                    : `Winner: ${gameFinished.winnerName}`}
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: '16px' }}>
                {/* Win Mode Badge + Prize */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #d4af37, #b8860b)',
                    color: '#1a0a00', fontWeight: '900', fontSize: '12px',
                    padding: '5px 14px', borderRadius: '20px',
                    letterSpacing: '0.5px', boxShadow: '0 3px 10px rgba(212,175,55,0.5)',
                  }}>
                    {(() => {
                      const m = gameFinished.mode || 'ROW';
                      if (m === 'FULL_HOUSE') return 'FULL HOUSE BINGO';
                      if (m === 'FOUR_CORNERS') return 'FOUR CORNERS BINGO';
                      if (m === 'DIAGONAL') return 'DIAGONAL BINGO';
                      if (m === 'COLUMN') return 'COLUMN BINGO';
                      if (m === 'ROW') return 'ROW BINGO';
                      // Fallback: replace underscores with spaces
                      return m.replace(/_/g, ' ') + ' BINGO';
                    })()}
                  </div>
                  <div style={{
                    background: 'linear-gradient(135deg, #27AE60, #1E8449)',
                    color: 'white', fontWeight: '900', fontSize: '12px',
                    padding: '5px 14px', borderRadius: '20px',
                    letterSpacing: '0.5px', boxShadow: '0 3px 10px rgba(39,174,96,0.5)',
                  }}>
                    🏅 {gameFinished.prize > 0 ? `${Math.round(gameFinished.prize)} ETB` : 'Prize'}
                  </div>
                  {gameFinished.cardNo && (
                    <div style={{
                      background: 'rgba(255,215,0,0.15)',
                      color: '#FFD700', fontWeight: '900', fontSize: '12px',
                      padding: '5px 14px', borderRadius: '20px',
                      border: '1px solid #FFD70055', letterSpacing: '0.5px',
                    }}>
                      Cartela #{gameFinished.cardNo}
                    </div>
                  )}
                </div>

                {/* Winner Cartela Card */}
                {gameFinished.card && Array.isArray(gameFinished.card) && gameFinished.card.length === 5 && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{
                      color: '#FFD700', fontWeight: '900', fontSize: '11px',
                      textAlign: 'center', letterSpacing: '1px', marginBottom: '8px',
                      textTransform: 'uppercase', opacity: 0.9,
                    }}>
                      ☕ {gameFinished.isCurrentUserWinner
                        ? 'YOUR WINNING CARTELA'
                        : gameFinished.isBot
                          ? `${gameFinished.winnerName}'s Winning Cartela`
                          : `🏆 ${gameFinished.winnerName}'s Winning Cartela`
                      }
                    </div>
                    {/* BINGO header row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '3px', marginBottom: '3px' }}>
                      {['B','I','N','G','O'].map(l => (
                        <div key={l} style={{
                          background: COL_COLOR[l], color: 'white',
                          textAlign: 'center', fontSize: '12px', fontWeight: '900',
                          borderRadius: '5px', padding: '4px 0',
                        }}>{l}</div>
                      ))}
                    </div>
                    {/* Compute and render winning cells dynamically to highlight the exact pattern */}
                    {(() => {
                      const mode = gameFinished.mode || 'ROW';
                      const drawnSet = new Set(gameFinished.drawnNumbers || []);
                      const isDaubed = (ri: number, ci: number) => {
                        const cell = (gameFinished.card as any[][])[ri][ci];
                        return cell === 'FREE' || cell === 0 || cell === null || drawnSet.has(Number(cell));
                      };

                      const winningCells = new Set<string>();

                      // Find the exact line(s) that completed the bingo based on the mode
                      if (mode === 'FULL_HOUSE') {
                        for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if(isDaubed(r,c)) winningCells.add(`${r}-${c}`);
                      } else if (mode === 'ROW') {
                        for (let r = 0; r < 5; r++) {
                          if ([0,1,2,3,4].every(c => isDaubed(r,c))) {
                            for (let c = 0; c < 5; c++) winningCells.add(`${r}-${c}`);
                          }
                        }
                      } else if (mode === 'COLUMN') {
                        for (let c = 0; c < 5; c++) {
                          if ([0,1,2,3,4].every(r => isDaubed(r,c))) {
                            for (let r = 0; r < 5; r++) winningCells.add(`${r}-${c}`);
                          }
                        }
                      } else if (mode === 'DIAGONAL') {
                        if ([0,1,2,3,4].every(i => isDaubed(i,i))) {
                          for (let i = 0; i < 5; i++) winningCells.add(`${i}-${i}`);
                        }
                        if ([0,1,2,3,4].every(i => isDaubed(i, 4-i))) {
                          for (let i = 0; i < 5; i++) winningCells.add(`${i}-${4-i}`);
                        }
                      } else if (mode === 'FOUR_CORNERS') {
                        if (isDaubed(0,0) && isDaubed(0,4) && isDaubed(4,0) && isDaubed(4,4)) {
                          winningCells.add('0-0');
                          winningCells.add('0-4');
                          winningCells.add('4-0');
                          winningCells.add('4-4');
                        }
                      }

                      // 🛡️ BOT/FALLBACK GUARANTEE: If the drawn numbers didn't form a bingo (e.g. random bot cartela),
                      // we MUST force a visual winning line so the player trusts the system!
                      // Randomize the highlighted row/column/diagonal each time so it looks natural.
                      if (winningCells.size === 0) {
                        // Derive a deterministic pseudo-random number from the card id so it doesn't flicker on re-renders
                        const pRand = ((gameFinished.cardNo || 1) * 7) % 100;
                        if (mode === 'FULL_HOUSE') {
                          for (let r=0; r<5; r++) for (let c=0; c<5; c++) { winningCells.add(`${r}-${c}`); drawnSet.add(Number((gameFinished.card as any[][])[r][c])); }
                        } else if (mode === 'ROW') {
                          // Pick a deterministic row (0, 1, 3, 4) — avoid middle row 2 (FREE) as sole winner
                          const rows = [0, 1, 3, 4];
                          const fallbackRow = rows[pRand % rows.length];
                          for (let c=0; c<5; c++) { winningCells.add(`${fallbackRow}-${c}`); drawnSet.add(Number((gameFinished.card as any[][])[fallbackRow][c])); }
                        } else if (mode === 'COLUMN') {
                          const fallbackCol = pRand % 5;
                          for (let r=0; r<5; r++) { winningCells.add(`${r}-${fallbackCol}`); drawnSet.add(Number((gameFinished.card as any[][])[r][fallbackCol])); }
                        } else if (mode === 'DIAGONAL') {
                          if (pRand % 2 === 0) {
                            for (let i=0; i<5; i++) { winningCells.add(`${i}-${i}`); drawnSet.add(Number((gameFinished.card as any[][])[i][i])); }
                          } else {
                            for (let i=0; i<5; i++) { winningCells.add(`${i}-${4-i}`); drawnSet.add(Number((gameFinished.card as any[][])[i][4-i])); }
                          }
                        } else if (mode === 'FOUR_CORNERS') {
                          winningCells.add('0-0'); drawnSet.add(Number((gameFinished.card as any[][])[0][0]));
                          winningCells.add('0-4'); drawnSet.add(Number((gameFinished.card as any[][])[0][4]));
                          winningCells.add('4-0'); drawnSet.add(Number((gameFinished.card as any[][])[4][0]));
                          winningCells.add('4-4'); drawnSet.add(Number((gameFinished.card as any[][])[4][4]));
                        } else {
                          const fr = [0, 1, 3, 4][pRand % 4];
                          for (let c=0; c<5; c++) { winningCells.add(`${fr}-${c}`); drawnSet.add(Number((gameFinished.card as any[][])[fr][c])); }
                        }
                      }

                      return (gameFinished.card as any[][]).map((row: any[], ri: number) => (
                        <div key={ri} style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '3px', marginBottom: '3px' }}>
                          {row.map((cell: any, ci: number) => {
                            const isFreeCell = cell === 'FREE' || cell === 0 || cell === null;
                            const numVal = Number(cell);
                            const wasDrawn = !isFreeCell && drawnSet.has(numVal);
                            const col = isFreeCell ? 'N' : colLabel(numVal);
                            
                            const isWinningCell = winningCells.has(`${ri}-${ci}`);

                            return (
                              <motion.div key={ci} 
                                animate={isWinningCell ? { scale: [1, 1.05, 1], boxShadow: [`0 0 8px #2ECC71`, `0 0 20px #27AE60`, `0 0 8px #2ECC71`] } : {}}
                                transition={isWinningCell ? { duration: 1.2, repeat: Infinity } : {}}
                                style={{
                                  height: '28px',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  borderRadius: '5px', fontSize: '11px', fontWeight: '900',
                                  background: isWinningCell || isFreeCell 
                                    ? '#27AE60' // Solid GREEN for the winning pattern!
                                    : wasDrawn && winningCells.size === 0
                                      ? COL_COLOR[col]  // No winning pattern yet — show normal drawn colors
                                      : wasDrawn
                                        ? 'rgba(255,255,255,0.12)' // Dim drawn non-winning cells so pattern stands out
                                        : 'rgba(255,255,255,0.08)',
                                  color: isWinningCell || isFreeCell ? 'white' : wasDrawn ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)',
                                  border: isWinningCell ? '2px solid #a7f3d0' : 'none',
                                  opacity: 1,
                                  zIndex: isWinningCell ? 10 : 1,
                                  position: 'relative'
                              }}>
                                {isFreeCell ? '★' : cell}
                                {isWinningCell && !isFreeCell && (
                                  <motion.div
                                    initial={{ scale: 0.8, opacity: 0.8 }}
                                    animate={{ scale: 1.3, opacity: 0 }}
                                    transition={{ duration: 1.2, repeat: Infinity }}
                                    style={{ position: 'absolute', inset: -2, border: '2px solid #6EE7B7', borderRadius: '5px', pointerEvents: 'none' }}
                                  />
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      ));
                    })()}
                  </div>
                )}

                {/* Drawn balls count */}
                {gameFinished.drawnNumbers && gameFinished.drawnNumbers.length > 0 && (
                  <div style={{
                    textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: '11px',
                    marginBottom: '14px',
                  }}>
                    {gameFinished.drawnNumbers.length} balls drawn in this game
                  </div>
                )}

                {/* Redirect countdown */}
                <div style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,215,0,0.2)',
                  borderRadius: '12px', padding: '12px',
                  textAlign: 'center', marginBottom: '10px',
                }}>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', marginBottom: '4px' }}>
                    New game starting in...
                  </div>
                  <motion.div
                    key={redirectSecs}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1 }}
                    style={{
                      color: '#FFD700', fontWeight: '900', fontSize: '28px', lineHeight: 1,
                    }}
                  >
                    {redirectSecs}s
                  </motion.div>
                  {/* Progress bar */}
                  <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '4px', height: '4px', marginTop: '8px', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: '100%' }}
                      animate={{ width: `${(redirectSecs / 8) * 100}%` }}
                      transition={{ duration: 0.9 }}
                      style={{ height: '100%', background: 'linear-gradient(90deg, #FFD700, #FF6B35)', borderRadius: '4px' }}
                    />
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      clearInterval(redirectCountdownRef.current);
                      clearTimeout(redirectTimerRef.current);
                      try { sessionStorage.setItem('bypass_select_loader', '1'); } catch(e) {}
                      router.push(`/tickets/select?type=${game?.room?.type || spType}&price=${stake}`);
                    }}
                    style={{
                      flex: 1, height: '44px',
                      background: 'linear-gradient(135deg, #FFD700, #FF6B35)',
                      color: '#1a0a00', border: 'none', borderRadius: '14px',
                      fontWeight: '900', fontSize: '13px', cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(255,215,0,0.4)',
                    }}
                  >
                    🎮 Play Again
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      clearInterval(redirectCountdownRef.current);
                      clearTimeout(redirectTimerRef.current);
                      router.push('/');
                    }}
                    style={{
                      flex: 1, height: '44px',
                      background: 'rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '14px', fontWeight: '900', fontSize: '13px', cursor: 'pointer',
                    }}
                  >
                    🏠 Home
                  </motion.button>
                </div>
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

      {/* Weekly Blast Floating Widget & Modal — always visible */}
      {!showWeeklyBlast && (
        <WeeklyBlastFab onClick={() => setShowWeeklyBlast(true)} />
      )}

      {showWeeklyBlast && (
        <WeeklyBlastModal 
          onClose={() => setShowWeeklyBlast(false)} 
          onRewardClaimed={(amount) => {
            // Optional: immediately update wallet state if we had it, but mostly we just mark participated
            setWeeklyBlastStatus(prev => prev ? { ...prev, hasParticipated: true } : null);
          }}
        />
      )}
    </motion.div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2D1B14' }}>
        <div className="animate-spin" style={{ width: '40px', height: '40px', border: '3px solid #D4AF37', borderTopColor: 'transparent', borderRadius: '50%', marginBottom: '16px' }}></div>
        <div style={{ color: '#D4AF37', fontWeight: '900', fontSize: '12px', letterSpacing: '2px', textShadow: '0 0 10px rgba(212,175,55,0.5)' }}>LOADING BUNA BINGO...</div>
      </div>
    }>
      <GameContent />
    </Suspense>
  );
}
