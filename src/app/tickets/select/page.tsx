'use client';
import { useEffect, useState, useRef, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getMe, joinGame, getOccupiedCards, getGame } from '../../../lib/api';
import { PREDEFINED_CARDS } from '../../../lib/predefinedCards';
import { useSocket } from '../../../context/SocketContext';
import BunaModal from '../../../components/BunaModal';
import { ChevronLeft, ShieldCheck, Trophy, Zap, Crown, Clock, Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { initTelegram, getLanguage, setLanguage } from '../../../lib/telegram';
import t from '../../../lib/i18n';
import { useTheme } from '../../../context/ThemeContext';

const COL_COLOR: Record<string, string> = {
  B: '#E74C3C', I: '#E67E22', N: '#D4AF37', G: '#27AE60', O: '#8E44AD',
};
function colLabel(n: number) {
  if (n <= 15) return 'B'; if (n <= 30) return 'I';
  if (n <= 45) return 'N'; if (n <= 60) return 'G'; return 'O';
}

function SelectionContent() {
  const router = useRouter();
  const { T, activeThemeKey } = useTheme();
  const searchParams = useSearchParams();
  const roomType = searchParams.get('type') || 'STANDARD';
  const stake = parseInt(searchParams.get('price') || '20');
  const gameId = searchParams.get('gameId') || undefined;
  const isSpin = roomType.startsWith('SPIN_');
  const isVip = roomType === 'VIP' || roomType === 'JACKPOT' || stake >= 100;
  const [activeGameId, setActiveGameId] = useState<string | undefined>(gameId);

  const [user, setUser] = useState<any>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [ownedCardIds, setOwnedCardIds] = useState<number[]>([]);
  const [occupied, setOccupied] = useState<number[]>([]);
  const [joining, setJoining] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [ticketCount, setTicketCount] = useState(0);
  const [visibleTicketCount, setVisibleTicketCount] = useState(0); // matches prize pool
  const [game, setGame] = useState<any>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [serverOff, setServerOff] = useState(0);
  const [newlyOccupied, setNewlyOccupied] = useState<number[]>([]);
  const [fakePlayersCount, setFakePlayersCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [langToggle, setLangToggle] = useState(0);

  useEffect(() => {
    const handleLangChange = () => setLangToggle(prev => prev + 1);
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);
  const [realPlayerCount, setRealPlayerCount] = useState(0);
  const [simulatedBotCount, setSimulatedBotCount] = useState(0);
  const [dripPlayerCount, setDripPlayerCount] = useState(0);
  const [expectedBotCount, setExpectedBotCount] = useState<number | null>(null);

  // isInitializing: true until the very first getOccupiedCards call resolves.
  // While true the grid stays covered so there's no flash of unlocked UI on refresh.
  const [isInitializing, setIsInitializing] = useState(() => {
    if (typeof window !== 'undefined') {
      const bypass = sessionStorage.getItem('bypass_select_loader') === '1';
      if (bypass) {
        try { sessionStorage.removeItem('bypass_select_loader'); } catch (e) { }
        return false;
      }
    }
    return true;
  });
  // Persist isGameRunning across refresh via sessionStorage so the mask shows instantly
  const [initialGameRunning, setInitialGameRunning] = useState(false);
  const [initialDrawnNumbers, setInitialDrawnNumbers] = useState<number[]>([]);
  // ── Live game state: true when the room has a RUNNING game and player is queued for next session
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);

  const [hasTicketsInRunningGame, setHasTicketsInRunningGame] = useState(false);
  const [runningGameId, setRunningGameId] = useState<string | null>(null);
  // Ref so the polling interval always reads the latest value without stale closures
  const isGameRunningRef = useRef(false);
  const lastGameRunningChangeTimeRef = useRef(0);
  // Stable ref for activeGameId — lets socket/polling effects read the latest ID
  // without needing it in their dependency arrays (prevents full effect re-mount on every poll update)
  const activeGameIdRef = useRef<string | undefined>(gameId);
  const lastJoinedRunningGameIdRef = useRef<string | null>(null);
  const redirectedRef = useRef(false);
  // ── Tracks the exact gameId the player joined at purchase time ──────────────
  // activeGameIdRef drifts to the NEXT WAITING game after a poll update.
  // Using it for the redirect sends the player to the WRONG game and causes
  // "Fetching cards..." forever. This ref is set once in joinGame() and never changes.
  const joinedGameIdRef = useRef<string | null>(null);
  const [liveGameDismissed, setLiveGameDismissed] = useState(false);
  const [currentBallSelect, setCurrentBallSelect] = useState<number | null>(null);
  // pendingJoinRef: set to true while joinGame() is in-flight.
  // If game-started arrives before the join response, we redirect once join resolves.
  const pendingJoinRef = useRef(false);
  const pendingJoinRoomRef = useRef<{ roomType: string; stake: number } | null>(null);
  // ── Server-time-anchored countdown for the LIVE GAME "NEXT CHECK" banner ──
  // liveGameEndTime is the UTC epoch ms when the current 20s poll-cycle ends.
  // Every device derives the display counter from the same epoch, so all
  // screens stay perfectly in sync regardless of when they loaded.
  const [liveGameSyncTimer, setLiveGameSyncTimer] = useState<number | null>(null);
  const [liveGameEndTime, setLiveGameEndTime] = useState<number | null>(null);
  const liveGameEndTimeRef = useRef<number | null>(null);   // always-fresh ref for use inside intervals
  const liveGameSyncRef = useRef<any>(null);
  const prevOccupied = useRef<number[]>([]);

  // ── Audio: live ball-calling while guests wait on selection page ──────────
  const ballAudioRefSelect = useRef<HTMLAudioElement | null>(null);
  const audioQueueSelectRef = useRef<number[]>([]);
  const isPlayingSelectRef = useRef<boolean>(false);
  const announcedSelectRef = useRef<Set<number>>(new Set());
  const soundOnSelectRef = useRef<boolean>(true);
  const [soundOn, setSoundOn] = useState(true); // UI state for mic button
  // ── Winner announcement modal ─────────────────────────────────────────────
  const [gameFinishedData, setGameFinishedData] = useState<any>(null);
  const [winnerRedirectSecs, setWinnerRedirectSecs] = useState(4);
  const winnerRedirectRef = useRef<any>(null);
  // Stored in ref so recursive calls never get a stale closure
  const playNextSelectBallRef = useRef<() => void>(() => { });
  // Tracks the server-derived player count target for the drip-in animation
  const targetPlayerCountRef = useRef<number>(0);

  const selectedRef = useRef<number[]>([]);
  const ownedRef = useRef<number[]>([]);
  const occupiedRef = useRef<number[]>([]);
  // Stable ref for user — lets socket callbacks always read the latest user
  // without putting `user` in the socket effect's dependency array (which would
  // cause a full effect re-mount every time getMe() resolves mid-game).
  const userRef = useRef<any>(null);
  // Tracks whether the component is still mounted — used to stop audio after navigation
  const mountedRef = useRef(true);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const running = sessionStorage.getItem('select_game_running') === '1';
      setInitialGameRunning(running);
      setIsGameRunning(running);
      isGameRunningRef.current = running;
      try {
        const raw = sessionStorage.getItem('select_drawn_numbers');
        if (raw) {
          const parsed = JSON.parse(raw);
          setInitialDrawnNumbers(parsed);
          setDrawnNumbers(parsed);
        }
      } catch (e) { }
    }
  }, []);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    ownedRef.current = ownedCardIds;
  }, [ownedCardIds]);

  useEffect(() => {
    occupiedRef.current = occupied;
  }, [occupied]);

  // Keep ref in sync with state so polling never reads a stale value
  useEffect(() => {
    isGameRunningRef.current = isGameRunning;
  }, [isGameRunning]);

  // Keep activeGameIdRef in sync with state — effects use the ref to avoid re-mounting
  useEffect(() => {
    activeGameIdRef.current = activeGameId;
  }, [activeGameId]);

  // Keep the liveGameEndTime ref in sync so the interval can always read the latest value
  useEffect(() => { liveGameEndTimeRef.current = liveGameEndTime; }, [liveGameEndTime]);

  // ── Server-time-anchored LIVE GAME countdown ─────────────────────────────────
  // The interval reads liveGameEndTimeRef (the ref) every 500ms and derives the
  // display value as Math.round((endTime - Date.now()) / 1000).  Because endTime
  // is a fixed UTC epoch supplied by the server, ALL devices show the same number.
  useEffect(() => {
    if (isGameRunning) {
      if (liveGameSyncRef.current) clearInterval(liveGameSyncRef.current);

      // If we have no server anchor yet, show a placeholder; the socket / poll will set it soon
      if (liveGameEndTimeRef.current === null) setLiveGameSyncTimer(20);

      liveGameSyncRef.current = setInterval(() => {
        const endTime = liveGameEndTimeRef.current;
        if (endTime === null) return; // wait for server anchor

        const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
        setLiveGameSyncTimer(remaining);

        if (remaining <= 0) {
          // Cycle expired — poll server to check if game finished
          getOccupiedCards(roomType, activeGameId).then(res => {
            if (!res) {
              // Fallback: reset a fresh 50s cycle
              const next = Date.now() + 50000;
              liveGameEndTimeRef.current = next;
              setLiveGameEndTime(next);
              return;
            }
            const nowRunning = !!res.isGameRunning;
            if (!nowRunning) {
              // Game ended — unlock UI
              isGameRunningRef.current = false;
              setIsGameRunning(false);
              setLiveGameDismissed(true);
              setLiveGameSyncTimer(null);
              liveGameEndTimeRef.current = null;
              setLiveGameEndTime(null);
              if (liveGameSyncRef.current) clearInterval(liveGameSyncRef.current);
              if (res.gameId) { activeGameIdRef.current = res.gameId; setActiveGameId(res.gameId); loadGameData(res.gameId); }
              if (res.occupiedIds) setOccupied(res.occupiedIds);
              if (res.playerCount !== undefined) {
                setPlayerCount(res.playerCount);
                if (res.ticketCount !== undefined) setTicketCount(res.ticketCount);
                if (res.visibleTicketCount !== undefined) setVisibleTicketCount(res.visibleTicketCount);
                if (res.realPlayerCount !== undefined) setRealPlayerCount(res.realPlayerCount);
              }
            } else {
              // Still running — start the next 50s cycle, anchored to server's gameStartedAt if available
              let next: number;
              if (res.gameStartedAt) {
                const cycleMs = 50000;
                const elapsed = (Date.now() - res.gameStartedAt) % cycleMs;
                next = Date.now() + (cycleMs - elapsed);
              } else {
                next = Date.now() + 50000;
              }
              liveGameEndTimeRef.current = next;
              setLiveGameEndTime(next);
            }
          }).catch(() => {
            // On error reset a fresh cycle so the timer doesn't stay at 0
            const next = Date.now() + 50000;
            liveGameEndTimeRef.current = next;
            setLiveGameEndTime(next);
          });
        }
      }, 500); // tick every 500 ms for a smooth display
    } else {
      if (liveGameSyncRef.current) clearInterval(liveGameSyncRef.current);
      setLiveGameSyncTimer(null);
    }
    return () => { if (liveGameSyncRef.current) clearInterval(liveGameSyncRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGameRunning]);

  // ── Force-dismiss: re-poll server; unlock regardless if response says not running ──
  const forceUnlockLiveGame = () => {
    getOccupiedCards(roomType, activeGameIdRef.current).then(res => {
      // Unlock in all cases — player shouldn't be permanently stuck
      isGameRunningRef.current = false;
      setIsGameRunning(false);
      setLiveGameDismissed(true);
      setLiveGameSyncTimer(null);
      liveGameEndTimeRef.current = null;
      setLiveGameEndTime(null);
      // Clear announced balls so the NEXT game's audio works correctly
      announcedSelectRef.current.clear();
      if (liveGameSyncRef.current) clearInterval(liveGameSyncRef.current);
      if (res?.gameId) { activeGameIdRef.current = res.gameId; setActiveGameId(res.gameId); loadGameData(res.gameId); }
      if (res?.occupiedIds) setOccupied(res.occupiedIds);
      if (res?.playerCount !== undefined) {
        setPlayerCount(res.playerCount);
        if (res.ticketCount !== undefined) setTicketCount(res.ticketCount);
        if (res.visibleTicketCount !== undefined) setVisibleTicketCount(res.visibleTicketCount);
        if (res.realPlayerCount !== undefined) setRealPlayerCount(res.realPlayerCount);
      }
    }).catch(() => {
      // Even on error — unlock locally so player is never permanently stuck
      isGameRunningRef.current = false;
      setIsGameRunning(false);
      setLiveGameDismissed(true);
      setLiveGameSyncTimer(null);
      liveGameEndTimeRef.current = null;
      setLiveGameEndTime(null);
      if (liveGameSyncRef.current) clearInterval(liveGameSyncRef.current);
    });
  };

  // ── Audio init: persistent element for B1-O75 calls on this page ────────
  useEffect(() => {
    mountedRef.current = true;
    if (typeof window !== 'undefined') {
      ballAudioRefSelect.current = new Audio();
      const saved = localStorage.getItem('game_sound');
      soundOnSelectRef.current = saved !== 'false';
    }
    // Cleanup: stop audio + clear queue when component unmounts (navigating away)
    return () => {
      mountedRef.current = false;
      audioQueueSelectRef.current = [];
      isPlayingSelectRef.current = false;
      if (ballAudioRefSelect.current) {
        ballAudioRefSelect.current.pause();
        ballAudioRefSelect.current.onended = null;
        ballAudioRefSelect.current.onerror = null;
        ballAudioRefSelect.current.src = '';
        ballAudioRefSelect.current = null;
      }
    };
  }, []);

  // Define the recursive queue processor via ref — avoids stale closure on self-call
  useEffect(() => {
    playNextSelectBallRef.current = () => {
      // Stop processing if component has unmounted (user navigated away)
      if (!mountedRef.current) {
        audioQueueSelectRef.current = [];
        isPlayingSelectRef.current = false;
        return;
      }
      if (audioQueueSelectRef.current.length === 0) {
        isPlayingSelectRef.current = false;
        return;
      }
      isPlayingSelectRef.current = true;
      const num = audioQueueSelectRef.current.shift()!;
      setCurrentBallSelect(num); // Keep big ball UI in sync with audio

      if (!soundOnSelectRef.current || !ballAudioRefSelect.current) {
        // Muted or no audio: keep queue alive with a tiny gap
        setTimeout(() => { if (mountedRef.current) playNextSelectBallRef.current(); }, 150);
        return;
      }
      const col = num <= 15 ? 'B' : num <= 30 ? 'I' : num <= 45 ? 'N' : num <= 60 ? 'G' : 'O';
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        setTimeout(() => { if (mountedRef.current) playNextSelectBallRef.current(); }, 300);
      };
      try {
        const el = ballAudioRefSelect.current;
        if (el) {
          el.onended = null; el.onerror = null; el.pause(); el.currentTime = 0;
          el.src = `/audio/${col}${num}.mp3`; el.load();
          el.onended = finish; el.onerror = finish;
          el.play().catch(() => {
            try {
              const f = new Audio(`/audio/${col}${num}.mp3`);
              f.onended = finish; f.onerror = finish; f.play().catch(finish);
            } catch (_) { finish(); }
          });
        } else {
          const f = new Audio(`/audio/${col}${num}.mp3`);
          f.onended = finish; f.onerror = finish; f.play().catch(finish);
        }
      } catch (e) { finish(); }
      setTimeout(finish, 5000); // safety cap so queue never gets permanently stuck
    };
  }, []);

  // Enqueue a ball number for audio — deduplicates and starts the processor if idle
  const queueSelectBall = useCallback((num: number) => {
    if (announcedSelectRef.current.has(num)) return;
    announcedSelectRef.current.add(num);
    audioQueueSelectRef.current.push(num);
    if (!isPlayingSelectRef.current) {
      playNextSelectBallRef.current();
    }
  }, []);


  const safeRoomType = (roomType || '').toUpperCase().trim();

  // Real bot count per room type (must match backend houseBot.service.ts)
  const botCountForRoom = expectedBotCount ?? (safeRoomType === 'VIP' || safeRoomType === 'JACKPOT' ? 10 : 30);

  // ── Bot drip-in simulation ────────────────────────────────────────────────
  // A simple interval that slowly increments the simulated bots up to botCountForRoom
  useEffect(() => {
    if (isGameRunning || (countdown !== null && countdown <= 2)) {
      setSimulatedBotCount(botCountForRoom);
      return;
    }

    const timer = setInterval(() => {
      setSimulatedBotCount(prev => {
        if (prev >= botCountForRoom) return botCountForRoom;
        return prev + 1;
      });
    }, 500); // 1 bot every 0.5s -> takes 15s to reach 30

    return () => clearInterval(timer);
  }, [isGameRunning, botCountForRoom, countdown]);

  // ── Player count drip-in: show players joining one-by-one ────────────────────
  // Drip speed adapts to urgency:
  //   • No countdown   → 600ms per player (relaxed)
  //   • Countdown > 2s → 80ms  per player (fast — finishes well before game starts)
  //   • ≤ 2s or running → snap immediately to target
  useEffect(() => {
    // Compute backend target from available state (mirrors render-time calculation)
    const base = visibleTicketCount > 0 ? visibleTicketCount : (ticketCount > 0 ? ticketCount : 0);
    const backendP = game?.totalPrize && Number(game.totalPrize) > 0 ? Number(game.totalPrize) : 0;
    const GPRIZES: Record<string, number> = { CASUAL: 50, STANDARD: 100, PRO: 250, JACKPOT: 500, VIP: 1000 };
    const minP = GPRIZES[roomType] || 50;
    let target = base > 0 ? base : (occupied.length + selected.length);
    if (roomType !== 'DEMO' && backendP > 0) {
      if (backendP > minP) {
        target = Math.round(backendP / (stake * 0.70));
      } else {
        const maxC = Math.floor(minP / (stake * 0.70));
        target = Math.min(base > 0 ? base : target, maxC);
      }
    }
    if (target < selected.length) target = selected.length;
    targetPlayerCountRef.current = target;

    // Snap immediately when game is running or countdown almost done
    if (isGameRunning || (countdown !== null && countdown <= 2)) {
      setDripPlayerCount(target);
      return;
    }

    // Adaptive speed: moderate when countdown is ticking, slow while waiting
    const interval = (countdown !== null && countdown > 2) ? 300 : 1500;

    const timer = setInterval(() => {
      setDripPlayerCount(prev => {
        const t = targetPlayerCountRef.current;
        if (prev >= t) { clearInterval(timer); return t; }
        return prev + 1;
      });
    }, interval);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTicketCount, ticketCount, game?.totalPrize, occupied.length, isGameRunning, countdown, stake, roomType]);



  const { socket, isConnected } = useSocket();

  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'error' | 'success' | 'confirm' | 'balance';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  const showAlert = (title: string, message: string, type: any = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  const loadGameData = useCallback((forcedGameId?: string) => {
    // Use the ref so this callback is stable and never needs activeGameId in its deps
    const gid = forcedGameId || activeGameIdRef.current;
    if (!gid) return;
    getGame(gid).then(g => {
      setGame(g);
      // NOTE: loadGameData does NOT touch isGameRunning.
      // isGameRunning is controlled ONLY by getOccupiedCards (which does a real DB
      // check for a RUNNING game) and by socket events (game-started / game-finished).
      // loadGameData fetches the NEXT WAITING game when a game is running, so its
      // status would be 'WAITING' — clearing isGameRunning here would be wrong.
      if (g.serverTime) {
        setServerOff(new Date(g.serverTime).getTime() - Date.now());
      }
      if (g.endTime && g.serverTime) {
        const st = new Date(g.serverTime).getTime();
        const et = new Date(g.endTime).getTime();
        const offset = st - Date.now();
        if (g.status === 'COUNTDOWN') {
          setEndTime(et);
          const rem = Math.max(0, Math.ceil((et - Date.now() - offset) / 1000));
          if (rem >= 0) setCountdown(rem);
        } else if (g.status === 'WAITING') {
          setCountdown(prev => (prev !== null && prev >= 0) ? prev : null);
          setEndTime(prev => (prev !== null) ? prev : null);
        }
      } else if (g.status === 'COUNTDOWN' && g.countdownSeconds !== undefined) {
        setCountdown((prev) => {
          if (prev !== null && prev >= 0) return prev;
          return g.countdownSeconds;
        });
      } else if (g.status === 'WAITING') {
        setCountdown(prev => (prev !== null && prev >= 0) ? prev : null);
        setEndTime(prev => (prev !== null) ? prev : null);
      }
    }).catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable — reads activeGameIdRef.current so no activeGameId dep needed

  // ── Local countdown display ────────────────────────────────────────────────
  // Ticks every 100ms from the server-anchored endTime epoch for a smooth display.
  // The game-started socket normally triggers the redirect, but we add an
  // absolute fail-safe here to ensure players never get stuck on 0s.
  const launchedRef = useRef(false);
  useEffect(() => {
    if (endTime === null) return;
    launchedRef.current = false; // reset for new countdown
    const timer = setInterval(() => {
      const now = Date.now() + serverOff;
      const rem = Math.max(0, Math.ceil((endTime - now) / 1000));
      if (isNaN(rem)) return;
      setCountdown((prev) => (prev === rem ? prev : rem));
      if (rem <= 0) {
        clearInterval(timer);
        setEndTime(null);

        // ── ULTIMATE FAIL-SAFE REDIRECT ──
        // Because auto-buy now fires at 3s, tickets are guaranteed to be
        // purchased by the time we hit 0s. We can force the redirect instantly!
        if (!redirectedRef.current && ownedRef.current.length > 0) {
          redirectedRef.current = true;
          const destId = joinedGameIdRef.current || activeGameIdRef.current;
          if (destId) {
            if (roomType.startsWith('SPIN_')) {
              router.push(`/play/spin?id=${destId}&stake=${stake}`);
            } else {
              router.push(`/game?id=${destId}&type=${roomType}&price=${stake}`);
            }
          }
        }
      }
    }, 100);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endTime, serverOff]);

  // ── Auto-buy: fire joinGame() at countdown=3 so the request has 3 full ───
  // seconds to complete. By the time the clock hits 0s, the player already owns
  // the tickets and can be redirected instantly.
  const gameStartedRef = useRef(false);
  const gameStartedDataRef = useRef<any>(null);
  useEffect(() => {
    if (countdown !== null && countdown <= 3 && countdown >= 0 &&
      selectedRef.current.length > 0 && !joining && !launchedRef.current) {
      launchedRef.current = true;
      setJoining(true);
      pendingJoinRef.current = true;
      joinGame(roomType, selectedRef.current).then(res => {
        if (res?.tickets) {
          ownedRef.current = res.tickets.map((t: any) => t.card.id);
          setOwnedCardIds(ownedRef.current);
          setSelected([]);
          if (res.gameId && typeof window !== 'undefined') {
            try { sessionStorage.setItem(`game_tickets_${res.gameId}`, JSON.stringify(res.tickets)); } catch (e) { }
          }
        }
        if (res?.gameId) {
          joinedGameIdRef.current = res.gameId;
          try { sessionStorage.setItem('joined_game_id', res.gameId); } catch (e) { }
        }
        // If game-started already fired before this resolved, redirect now
        if (gameStartedRef.current && !redirectedRef.current &&
          (ownedRef.current.length > 0 || res?.tickets?.length > 0)) {
          redirectedRef.current = true;
          const d = gameStartedDataRef.current;
          const destId = joinedGameIdRef.current || res?.gameId || d?.gameId || activeGameIdRef.current;
          if (destId) {
            if (roomType.startsWith('SPIN_')) {
              router.push(`/play/spin?id=${destId}&stake=${stake}`);
            } else {
              router.push(`/game?id=${destId}&type=${roomType}&price=${stake}`);
            }
          }
        }
      }).catch(() => { }).finally(() => {
        pendingJoinRef.current = false;
        setTimeout(() => setJoining(false), 3000);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  useEffect(() => {
    if (roomType.toUpperCase().includes('SPIN')) {
      showAlert(
        'COMING SOON! / በቅርቡ ይጠብቁ! 🚧',
        '☕ Buna Spin Games are currently undergoing maintenance for exciting upgrades. Get ready for something big! You will be redirected back to the Lobby.',
        'info'
      );
      const t = setTimeout(() => {
        router.push('/');
      }, 3500);
      return () => clearTimeout(t);
    }
  }, [roomType, router]);

  useEffect(() => {
    if (roomType.toUpperCase().includes('SPIN')) return;
    getMe().then(setUser).catch(() => { });
    loadGameData();

    const handleConnect = () => {
      if (socket) {
        socket.emit('join-game', roomType);
        if (activeGameIdRef.current) socket.emit('join-game', activeGameIdRef.current);
        if (lastJoinedRunningGameIdRef.current) {
          socket.emit('join-game', lastJoinedRunningGameIdRef.current);
        }
      }
    };

    // 1. Initial Quick Fetch (REST Fallback)
    getOccupiedCards(roomType, activeGameIdRef.current).then(res => {
      setOccupied(res.occupiedIds || []);
      prevOccupied.current = res.occupiedIds || [];
      setPlayerCount(res.playerCount || 0);
      setTicketCount(res.ticketCount || 0);
      setVisibleTicketCount(res.visibleTicketCount || res.ticketCount || 0);
      setRealPlayerCount(res.realPlayerCount || 0);
      if (res.expectedBotCount !== undefined) {
        setExpectedBotCount(res.expectedBotCount);
      }
      if (res.myCardIds && res.myCardIds.length > 0) {
        setSelected(res.myCardIds);
        setOwnedCardIds(res.myCardIds);
      }
      // Auto-switch to next WAITING game if current is RUNNING
      if (res.gameId) {
        activeGameIdRef.current = res.gameId;
        setActiveGameId(res.gameId);
        loadGameData(res.gameId);
      }
      // NOTE: isGameRunning is NOT set here — syncRunningState (polling) is the
      // single source of truth. Setting it here causes a race condition where
      // stale cached backend data can lock the UI permanently.
    }).catch(() => { });

    // 2. High-Performance WebSocket Sync (Real-time & Zero Network Overhead)
    if (socket) {
      socket.on('connect', handleConnect);

      socket.emit('join-game', roomType);
      if (activeGameIdRef.current) socket.emit('join-game', activeGameIdRef.current);

      socket.on('cards-reserved', (data: { reservedIds: number[]; gameId: string }) => {
        if (data.gameId !== activeGameIdRef.current) return;
        setOccupied(prev => {
          const combined = Array.from(new Set([...prevOccupied.current, ...data.reservedIds]));
          // Exclude cards I have selected myself
          return combined.filter(id => !selectedRef.current.includes(id));
        });
      });

      socket.on('occupied-sync', (data: any) => {
        if (data.tickets) {
          const ticketList = data.tickets;
          const myCardIds = ticketList.filter((t: any) => t.userId === userRef.current?.id).map((t: any) => t.cardId);
          const otherOccupiedIds = ticketList.filter((t: any) => t.userId !== userRef.current?.id).map((t: any) => t.cardId);

          const freshlyTaken = otherOccupiedIds.filter((id: number) => !prevOccupied.current.includes(id));
          if (freshlyTaken.length > 0) {
            setNewlyOccupied(freshlyTaken);
            setTimeout(() => setNewlyOccupied([]), 2000);
          }
          prevOccupied.current = otherOccupiedIds;
          setOccupied(otherOccupiedIds);

          if (myCardIds.length > 0) {
            setOwnedCardIds(myCardIds);
          }
        }
        if (data.gameId) {
          setActiveGameId(data.gameId);
        }
        if (data.playerCount !== undefined) {
          setPlayerCount(data.playerCount);
          if (data.ticketCount !== undefined) setTicketCount(data.ticketCount);
          if (data.realPlayerCount !== undefined) setRealPlayerCount(data.realPlayerCount);
        }
      });

      socket.on('countdown-start', (d: any) => {
        if (d.gameId && activeGameIdRef.current && d.gameId !== activeGameIdRef.current) return;
        if (d.endTime && d.serverTime) {
          const st = new Date(d.serverTime).getTime();
          const et = new Date(d.endTime).getTime();
          const offset = st - Date.now();
          setServerOff(offset);
          setEndTime(et);
          const rem = Math.max(0, Math.ceil((et - Date.now() - offset) / 1000));
          setCountdown(rem >= 0 ? rem : null);
        } else {
          setCountdown(d.seconds);
        }
      });

      socket.on('game-started', (d: any) => {
        if (d.gameId && activeGameIdRef.current && d.gameId !== activeGameIdRef.current) return;
        setGame((prev: any) => prev ? { ...prev, status: 'RUNNING' } : { status: 'RUNNING' });
        isGameRunningRef.current = true;
        lastGameRunningChangeTimeRef.current = Date.now();
        setIsGameRunning(true);
        setCountdown(null);
        // Anchor the 50s NEXT CHECK cycle to the real server timestamp
        const endTime = (d.serverTime || Date.now()) + 50000;
        liveGameEndTimeRef.current = endTime;
        setLiveGameEndTime(endTime);

        // Save state for joinGame().then() to pick up if it's still joining
        gameStartedRef.current = true;
        gameStartedDataRef.current = d;

        // Redirect users who have tickets OR are in the middle of joining
        const hasTickets = ownedRef.current.length > 0;
        const isJoining = pendingJoinRef.current;
        if (!redirectedRef.current && (hasTickets || isJoining)) {
          // If still joining, the joinGame().then() handler will redirect when it resolves
          if (hasTickets && !isJoining) {
            redirectedRef.current = true;
            const destId = joinedGameIdRef.current || d.gameId || activeGameIdRef.current;
            if (roomType.startsWith('SPIN_')) {
              router.push(`/play/spin?id=${destId}&stake=${stake}`);
            } else {
              router.push(`/game?id=${destId}&type=${roomType}&price=${stake}`);
            }
          } else if (isJoining) {
            // Mark as "needs redirect" — the joinGame().then() will pick this up
            redirectedRef.current = false; // keep false so join .then() can redirect
          }
        }
      });

      // ── Late-join sync: server tells us when the running game started ──────
      // Allows a client that (re)loads mid-game to immediately show the correct
      // remaining seconds instead of starting a fresh independent 50s clock.
      // The server now also sends the runningGameId so we can join its socket
      // room and receive number-drawn / game-finished events in real-time.
      socket.on('game-running-sync', (d: any) => {
        if (d.gameId && activeGameIdRef.current && d.gameId !== activeGameIdRef.current) return;
        isGameRunningRef.current = true;
        lastGameRunningChangeTimeRef.current = Date.now();
        setIsGameRunning(true);
        setLiveGameDismissed(false);
        const cycleMs = (d.cycleSeconds || 50) * 1000;
        const elapsed = (Date.now() - (d.gameStartedAt || Date.now())) % cycleMs;
        const endTime = Date.now() + (cycleMs - elapsed);
        liveGameEndTimeRef.current = endTime;
        setLiveGameEndTime(endTime);
        // Auto-join the running game's socket room so we receive real-time events
        if (d.gameId && socket) {
          socket.emit('join-game', d.gameId);
        }
      });

      socket.on('player-joined', (d: any) => {
        // Update ticket count and prize in real-time as players join
        if (d.ticketCount !== undefined) {
          setTicketCount(d.ticketCount);
        }
        if (d.playerCount !== undefined) {
          setPlayerCount(d.playerCount);
        }
        // Update the game's totalPrize in real-time from the socket payload
        if (d.totalPrize !== undefined) {
          setGame((prev: any) => prev ? { ...prev, totalPrize: d.totalPrize, ticketCount: d.ticketCount ?? prev.ticketCount } : prev);
        }
      });

      socket.on('countdown-tick', (d: any) => {
        if (d.gameId && activeGameIdRef.current && d.gameId !== activeGameIdRef.current) return;
        let currentRem = 0;
        if (d.endTime && d.serverTime) {
          const st = new Date(d.serverTime).getTime();
          const et = new Date(d.endTime).getTime();
          const offset = st - Date.now();
          setServerOff(offset);
          setEndTime(et);
          const rem = Math.max(0, Math.ceil((et - Date.now() - offset) / 1000));
          setCountdown(rem >= 0 ? rem : null);
          currentRem = rem;
        } else {
          setCountdown(d.secondsRemaining);
          currentRem = d.secondsRemaining;
        }
        // Auto-buy logic moved to useEffect to ensure it fires reliably

        if (d.playerCount !== undefined) {
          setPlayerCount(d.playerCount);
          if (d.ticketCount !== undefined) setTicketCount(d.ticketCount);
          if (d.realPlayerCount !== undefined) setRealPlayerCount(d.realPlayerCount);
        }
      });

      socket.on('number-drawn', (d: any) => {
        if (d.gameId && activeGameIdRef.current && d.gameId !== activeGameIdRef.current) return;
        if (d.number !== undefined) {
          // Update drawn history list immediately for display
          setDrawnNumbers(prev => {
            if (!prev.includes(d.number)) return [...prev, d.number];
            return prev;
          });
          // 🔊 Play the ball audio — one by one, no overlap
          queueSelectBall(d.number);
        }
      });

      // ── When the RUNNING game finishes, this lobby wakes up as next game ──
      socket.on('game-finished', (d: any) => {
        if (d.gameId && activeGameIdRef.current && d.gameId !== activeGameIdRef.current) return;
        isGameRunningRef.current = false;
        lastGameRunningChangeTimeRef.current = Date.now();
        setIsGameRunning(false);
        setLiveGameDismissed(true);
        setCountdown(null);
        setDrawnNumbers([]);
        setEndTime(null);
        setLiveGameSyncTimer(null);
        liveGameEndTimeRef.current = null;
        setLiveGameEndTime(null);
        // Reset live-calling audio so next game starts clean
        audioQueueSelectRef.current = [];
        isPlayingSelectRef.current = false;
        announcedSelectRef.current = new Set();
        if (ballAudioRefSelect.current) {
          ballAudioRefSelect.current.pause();
          ballAudioRefSelect.current.currentTime = 0;
        }

        // Winner modal logic has been removed from the selection page per user request.
        // It now only displays inside the active game page.

        getOccupiedCards(roomType, activeGameIdRef.current).then(res => {
          if (res.gameId) {
            activeGameIdRef.current = res.gameId;
            setActiveGameId(res.gameId);
            loadGameData(res.gameId);
            if (socket) socket.emit('join-game', res.gameId);
          }
          setOccupied(res.occupiedIds || []);
          setPlayerCount(res.playerCount || 0);
          setTicketCount(res.ticketCount || 0);
          setVisibleTicketCount(res.visibleTicketCount || res.ticketCount || 0);
          setRealPlayerCount(res.realPlayerCount || 0);
          if (res.expectedBotCount !== undefined) {
            setExpectedBotCount(res.expectedBotCount);
          }
          const myNewCardIds = res.myCardIds || [];
          setOwnedCardIds(myNewCardIds);
        }).catch(() => { });
      });

      socket.on('game-cancelled', (d: any) => {
        if (d.gameId && activeGameIdRef.current && d.gameId !== activeGameIdRef.current) return;
        showAlert('Game Cancelled', d.reason || 'The game was cancelled due to a system error. Your tickets have been refunded.', 'error');
        isGameRunningRef.current = false;
        setIsGameRunning(false);
        setLiveGameDismissed(true);
        setCountdown(null);
        setDrawnNumbers([]);
        setEndTime(null);
        setLiveGameSyncTimer(null);
        liveGameEndTimeRef.current = null;
        setLiveGameEndTime(null);
        setOwnedCardIds([]);
        setSelected([]);
        if (d.gameId) {
          try { sessionStorage.removeItem(`game_tickets_${d.gameId}`); } catch (e) { }
        }

        // Fetch new state
        getOccupiedCards(roomType, activeGameIdRef.current).then(res => {
          if (res.gameId) {
            activeGameIdRef.current = res.gameId;
            setActiveGameId(res.gameId);
            loadGameData(res.gameId);
            if (socket) socket.emit('join-game', res.gameId);
          }
          setOccupied(res.occupiedIds || []);
          setPlayerCount(res.playerCount || 0);
          setTicketCount(res.ticketCount || 0);
          setVisibleTicketCount(res.visibleTicketCount || res.ticketCount || 0);
          setRealPlayerCount(res.realPlayerCount || 0);
          if (res.expectedBotCount !== undefined) {
            setExpectedBotCount(res.expectedBotCount);
          }
        }).catch(() => { });
      });
    }

    return () => {
      if (socket) {
        if (activeGameIdRef.current) {
          socket.emit('card-select', { gameId: activeGameIdRef.current, cardIds: [], roomType });
        }
        socket.off('connect', handleConnect);
        socket.off('cards-reserved');
        socket.off('occupied-sync');
        socket.off('countdown-start');
        socket.off('countdown-tick');
        socket.off('game-started');
        socket.off('game-running-sync');
        socket.off('game-finished');
        socket.off('game-cancelled');
        socket.off('number-drawn');
      }
      // Kill audio immediately when socket effect tears down (navigation / dep change)
      audioQueueSelectRef.current = [];
      isPlayingSelectRef.current = false;
      if (ballAudioRefSelect.current) {
        try {
          ballAudioRefSelect.current.pause();
          ballAudioRefSelect.current.onended = null;
          ballAudioRefSelect.current.onerror = null;
        } catch (_) { }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // user?.id intentionally removed — we read userRef.current inside instead.
    // Having user?.id here caused the effect to re-mount every time getMe() resolved
    // (typically after 4-5 balls), killing all socket listeners and audio mid-game.
  }, [roomType, socket, loadGameData, router, stake]);
  // NOTE: activeGameId intentionally omitted — we use activeGameIdRef.current inside
  // to prevent the entire socket effect from re-mounting on every game ID update.

  useEffect(() => {
    setSelected(prev => prev.filter(id => !occupied.includes(id)));
  }, [occupied]);

  const gridRef = useRef<HTMLDivElement>(null);

  // Helper to format bingo balls
  const getBallDetails = (num: number) => {
    if (num <= 15) return { letter: 'B', color: '#fff', bgColor: '#E74C3C' };  // Red
    if (num <= 30) return { letter: 'I', color: '#fff', bgColor: '#E67E22' };  // Orange
    if (num <= 45) return { letter: 'N', color: '#fff', bgColor: '#3498DB' };  // Blue
    if (num <= 60) return { letter: 'G', color: '#fff', bgColor: '#27AE60' };  // Green
    return { letter: 'O', color: '#fff', bgColor: '#8E44AD' };                 // Purple
  };


  // ─── Auto-redirect to bingo calling page when game launches (30+1 trigger) ───
  // Catches cases where the game-started socket event was missed due to timing.
  useEffect(() => {
    // Redirect ONLY users who bought tickets when the game status becomes RUNNING
    if (game?.status === 'RUNNING' && activeGameId && !redirectedRef.current && ownedCardIds.length > 0) {
      redirectedRef.current = true;
      // ── Prefer the gameId saved at purchase time (most reliable) ─────────────
      const destId = joinedGameIdRef.current || activeGameId;
      if (roomType.startsWith('SPIN_')) {
        router.push(`/play/spin?id=${destId}&stake=${stake}`);
      } else {
        router.push(`/game?id=${destId}&type=${roomType}&price=${stake}`);
      }
    }
  }, [game?.status, activeGameId, roomType, stake, router, ownedCardIds.length]);

  // Ensure we rejoin socket rooms on reconnect
  useEffect(() => {
    if (!socket) return;
    const onDisconnect = () => {
      lastJoinedRunningGameIdRef.current = null;
    };
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);

  // ─── Poll every 2s: getOccupiedCards is the SINGLE source of truth for isGameRunning ───
  // This handles all cases: page refresh during game, missed socket events, etc.
  // NOTE: isGameRunning is intentionally read via isGameRunningRef (not state) so this
  // interval is stable and never torn down/recreated on every game-state change.
  useEffect(() => {
    const syncRunningState = () => {
      getOccupiedCards(roomType, activeGameIdRef.current).then(res => {
        setIsInitializing(false);
        if (!res) return;

        // Always read from ref — never from stale closure
        const wasRunning = isGameRunningRef.current;
        const nowRunning = !!res.isGameRunning;

        // Persist running state + drawn numbers to sessionStorage so next refresh
        // can show the mask immediately without waiting for the first poll
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('select_game_running', nowRunning ? '1' : '0');
          if (nowRunning && (res as any).drawnNumbers) {
            sessionStorage.setItem('select_drawn_numbers', JSON.stringify((res as any).drawnNumbers));
          } else if (!nowRunning) {
            sessionStorage.removeItem('select_drawn_numbers');
          }
        }

        // Update isGameRunning based on authoritative server response
        if (nowRunning !== wasRunning) {
          // If the socket JUST told us the game started OR finished, don't trust a stale polling response saying the opposite.
          // 1.5s is enough to let a fresh socket event settle before a racing poll can overwrite it.
          if (Date.now() - lastGameRunningChangeTimeRef.current < 1500) {
            return;
          }
          lastGameRunningChangeTimeRef.current = Date.now();

          isGameRunningRef.current = nowRunning;
          setIsGameRunning(nowRunning);
          if (!nowRunning && wasRunning) {
            // Game just finished — clear timer and release overlay
            setLiveGameDismissed(true);
            liveGameEndTimeRef.current = null;
            setLiveGameEndTime(null);
            announcedSelectRef.current.clear();
          }
          if (nowRunning && !wasRunning) {
            // Game just detected as running (page-refresh path) — anchor the 50s cycle
            setLiveGameDismissed(false);
            const cycleMs = 50000;
            const startedAt = (res as any).gameStartedAt;
            let next: number;
            if (startedAt) {
              const elapsed = (Date.now() - startedAt) % cycleMs;
              next = Date.now() + (cycleMs - elapsed);
            } else {
              next = Date.now() + cycleMs;
            }
            liveGameEndTimeRef.current = next;
            setLiveGameEndTime(next);
          }
        }

        // Switch to the correct game ID if it changed (next waiting game after finish)
        if (res.gameId && res.gameId !== activeGameIdRef.current && !nowRunning) {
          activeGameIdRef.current = res.gameId;
          setActiveGameId(res.gameId);
          loadGameData(res.gameId);
          if (socket) socket.emit('join-game', res.gameId);
        }

        if (res.occupiedIds) setOccupied(res.occupiedIds);
        if (res.playerCount !== undefined) {
          setPlayerCount(res.playerCount);
          if (res.ticketCount !== undefined) setTicketCount(res.ticketCount);
          if (res.visibleTicketCount !== undefined) setVisibleTicketCount(res.visibleTicketCount);
          if (res.realPlayerCount !== undefined) setRealPlayerCount(res.realPlayerCount);
        }

        setHasTicketsInRunningGame(!!res.hasTicketsInRunningGame);
        const newRunningId = res.runningGameId || null;
        setRunningGameId(newRunningId);
        // Subscribe to the running game's socket channel ONLY if we haven't already
        // This prevents spamming the server and triggering redundant game-running-sync responses every 5 seconds.
        if (newRunningId && socket && lastJoinedRunningGameIdRef.current !== newRunningId) {
          lastJoinedRunningGameIdRef.current = newRunningId;
          socket.emit('join-game', newRunningId);
        }
        if ((res as any).drawnNumbers) {
          const incoming: number[] = (res as any).drawnNumbers;
          setDrawnNumbers(prev => {
            // Mark existing as announced on initial load
            if (prev.length === 0 && incoming.length > 0) {
              incoming.forEach(n => announcedSelectRef.current.add(n));
            }

            // Fix: Only overwrite if the API array is newer/longer than our current state.
            // This prevents stale API cache responses from deleting newly drawn socket balls.
            if (incoming.length > prev.length) {
              // Queue audio for any new balls that we didn't have yet
              const newBalls = incoming.filter(n => !prev.includes(n));
              if (newBalls.length <= 3) {
                newBalls.forEach(n => queueSelectBall(n));
              }
              // Also mark these new balls as announced so we don't double play
              newBalls.forEach(n => announcedSelectRef.current.add(n));
              return incoming;
            }
            return prev;
          });
        }
      }).catch(() => {
        // Even on API failure, unblock the UI so player isn't stuck on "LOADING..."
        setIsInitializing(false);
      });
    };

    // Run immediately on mount / dependency change to catch refresh-during-game
    syncRunningState();

    // Poll every 5s when socket is connected (covers missed events, game transitions),
    // or every 2s when disconnected (no socket fallback available).
    // Using 5s (not 15s) ensures a newly started game is detected within seconds.
    const poll = setInterval(() => {
      syncRunningState();
      if (!isGameRunningRef.current) loadGameData(); // keep countdown/game data fresh when not running
    }, isConnected ? 5000 : 2000);

    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomType, loadGameData, socket, isConnected]);
  // NOTE: activeGameId intentionally omitted — we use activeGameIdRef.current inside
  // so the polling interval is never re-created on game ID updates (would cause a flash).



  const toggleSelect = (num: number) => {
    // Hard block: never allow selection while a game is running
    if (isGameRunningRef.current || isInitializing) return;

    if (!user && roomType !== 'DEMO') {
      showAlert('እባክዎ ይጠብቁ...', 'የኪስዎን ቀሪ ሂሳብ እያጣራን ነው...', 'info');
      getMe().then(setUser).catch(() => { });
      return;
    }

    // 1. If the card is owned/occupied by another player
    if (occupied.includes(num)) {
      // Card is already visually green with cursor:not-allowed — silently block, no alert popup
      return;
    }

    const currentBalance = Number(user?.wallet?.balance || 0);
    const currentBonus = Number(user?.wallet?.bonusBalance || 0);
    const totalAvailable = currentBalance + currentBonus;

    // 2. Check if we are selecting a new card (not deselecting)
    if (!selected.includes(num)) {
      // Check for 0 total balance (main + bonus)
      if (roomType !== 'DEMO' && totalAvailable === 0 && !ownedCardIds.includes(num)) {
        setModal({
          isOpen: true,
          title: t('depositRequired') as string,
          message: t('emptyBalanceMsg') as string,
          type: 'balance',
          onConfirm: () => router.push('/wallet')
        });
        return;
      }

      // Check maximum limit
      if (selected.length >= 5) {
        showAlert(t('limitReached') as string, t('maxCartelasMsg') as string, 'info');
        return;
      }

      // Check combined balance limit (main + bonus)
      const proposedSelected = [...selected, num];
      const newCardsToBuy = proposedSelected.filter(id => !ownedCardIds.includes(id));
      const proposedCost = newCardsToBuy.length * stake;

      if (roomType !== 'DEMO' && proposedCost > totalAvailable) {
        setModal({
          isOpen: true,
          title: t('insufTitle') as string,
          message: (t('insufficientFunds') as Function)(String(proposedCost), currentBalance.toFixed(2), currentBonus.toFixed(2), totalAvailable.toFixed(2)),
          type: 'balance',
          onConfirm: () => router.push('/wallet')
        });
        return;
      }
    }

    // 3. Normal select/deselect flow (freely allow changing owned cards)
    setSelected(prev => {
      let next;
      if (prev.includes(num)) {
        next = prev.filter(n => n !== num);
      } else if (prev.length >= 5) {
        showAlert(t('limitReached') as string, t('maxCartelasMsg') as string, 'info');
        return prev;
      } else {
        next = [...prev, num];
      }

      // 🆕 Emit reservation update to server in real-time
      if (socket && activeGameIdRef.current) {
        socket.emit('card-select', {
          gameId: activeGameIdRef.current,
          cardIds: next,
          roomType,
        });
      }

      return next;
    });
  };

  const balance = Number(user?.wallet?.balance || 0);
  const bonusBalance = Number(user?.wallet?.bonusBalance || 0);
  const totalAvailable = balance + bonusBalance;

  const handleStart = async () => {
    if (isInitializing || selected.length === 0 || joining) return;

    if (!user && roomType !== 'DEMO') {
      showAlert('እባክዎ ይጠብቁ...', 'የኪስዎን ቀሪ ሂሳብ እያጣራን ነው...', 'info');
      getMe().then(setUser).catch(() => { });
      return;
    }

    setJoining(true);

    const newCardsToBuy = selected.filter(id => !ownedCardIds.includes(id));
    const totalCost = stake * newCardsToBuy.length;

    // Detect if selection actually changed
    const isSelectionChanged = selected.length !== ownedCardIds.length || selected.some(id => !ownedCardIds.includes(id));

    if (!isSelectionChanged) {
      if (isGameRunning && !hasTicketsInRunningGame) {
        setModal({
          isOpen: true,
          title: '🔴 ' + (t('gameInProgressScreen') as string),
          message: t('gameInProgressMsg') as string,
          type: 'info',
        });
        setJoining(false);
        return;
      }

      // If they have tickets in the RUNNING game, send them to the live game room
      if (isGameRunning && hasTicketsInRunningGame && runningGameId) {
        if (roomType.startsWith('SPIN_')) router.push(`/play/spin?id=${runningGameId}&stake=${stake}`);
        else router.push(`/game?id=${runningGameId}&type=${roomType}&price=${stake}`);
        setJoining(false);
        return;
      }

      // If selection is identical to owned tickets, enter the game room directly
      if (roomType.startsWith('SPIN_')) router.push(`/play/spin?id=${activeGameIdRef.current}&stake=${stake}`);
      else router.push(`/game?id=${activeGameIdRef.current}&type=${roomType}&price=${stake}`);
      setJoining(false);
      return;
    }

    // Selection has changed, we must send joinGame to update tickets in the database
    if (newCardsToBuy.length > 0 && totalAvailable < totalCost && roomType !== 'DEMO') {
      setModal({
        isOpen: true,
        title: t('insufTitle') as string,
        message: (t('insufficientFundsBuy') as Function)(newCardsToBuy.length, String(totalCost), balance.toFixed(2), bonusBalance.toFixed(2), totalAvailable.toFixed(2)),
        type: 'balance',
        onConfirm: () => router.push('/wallet')
      });
      setJoining(false);
      return;
    }

    try {
      const res = await joinGame(roomType, selected);

      if (typeof window !== 'undefined' && res.gameId && res.tickets) {
        sessionStorage.setItem(`game_tickets_${res.gameId}`, JSON.stringify(res.tickets));
      }

      setOwnedCardIds(selected);

      if (isGameRunning) {
        setModal({
          isOpen: true,
          title: '🔴 ' + (t('gameInProgressScreen') as string),
          message: t('gameInProgressMsg') as string,
          type: 'info',
        });
      } else {
        if (roomType.startsWith('SPIN_')) router.push(`/play/spin?id=${res.gameId}&stake=${stake}`);
        else router.push(`/game?id=${res.gameId}&type=${roomType}&price=${stake}`);
      }
    } catch (err: any) {
      const errData = err.response?.data;
      const errCode = errData?.error;
      const msg = errData?.message || err.message || 'Failed to join';

      if (errCode === 'GAME_IN_PROGRESS') {
        // Backend confirmed game is running — lock the UI
        setIsGameRunning(true);
        setLiveGameDismissed(false);
        setModal({
          isOpen: true,
          title: '🔴 ' + (t('gameInProgressScreen') as string),
          message: t('gameRunningTicketsClosed') as string,
          type: 'info',
        });
      } else if (errCode === 'DEMO_LIMIT_REACHED') {
        setModal({
          isOpen: true,
          title: '🎮 ዲሞ ጊዜ አልቋል',
          message: msg,
          type: 'balance',
          onConfirm: () => router.push('/wallet')
        });
      } else if (errCode === 'CARD_ALREADY_TAKEN') {
        // Silently mark taken cards green (same as bot-held cards) and deselect — no modal
        const takenNumbers = msg.match(/\d+/g)?.map(Number) || [];
        if (takenNumbers.length > 0) {
          setOccupied(prev => Array.from(new Set([...prev, ...takenNumbers])));
          setSelected(prev => prev.filter(id => !takenNumbers.includes(id)));
        }
      } else {
        showAlert('መግባት አልተሳካም', msg, 'error');
      }
    } finally {
      setJoining(false);
    }

  };

  const isDark = activeThemeKey.includes('DARK') || activeThemeKey === 'GRAY';

  // ─── Real-time Prize & Player Calculations ───────────────────────────────
  // We ALWAYS use authoritative server data (ticketCount, totalPrize from DB/API).
  // This prevents stale simulated values from showing the wrong prize.

  // PLAYERS: visibleTicketCount is the PRIORITY — it matches exactly what the backend used
  // to calculate totalPrize (real players + capped visible bots, max 30 for CASUAL).
  // game.ticketCount / ticketCount from sockets = RAW total (all 400+ bots) — do NOT use for display.
  const baseCards = visibleTicketCount > 0
    ? visibleTicketCount
    : (ticketCount > 0 ? ticketCount : 0);
  const serverReportedPlayers = Math.max(game?.playerCount || 0, playerCount || 0);

  // Initial estimate before mathematical correction
  let displayPlayerCount = baseCards > 0
    ? baseCards
    : (occupied.length + (selected.filter(id => !occupied.includes(id)).length));

  // totalVisualCards: always the visible count — accurate for prize calculation
  let totalVisualCards = baseCards > 0
    ? baseCards
    : displayPlayerCount;

  // PRIZE: always use backend totalPrize as the primary source of truth.
  const backendPrize = game?.totalPrize && Number(game.totalPrize) > 0 ? Number(game.totalPrize) : 0;
  const computedPrize = Math.round((totalVisualCards * stake) * 0.70);
  const prize = backendPrize > 0 ? backendPrize : computedPrize;

  // 100% REAL MATHEMATICAL CALCULATION
  // Force the CARDS (players) count to perfectly match the displayed prize
  const GUARANTEED_PRIZES: Record<string, number> = { CASUAL: 50, STANDARD: 100, PRO: 250, JACKPOT: 500, VIP: 1000 };
  const minPrize = GUARANTEED_PRIZES[roomType] || 50;
  if (roomType !== 'DEMO' && backendPrize > 0) {
    if (backendPrize > minPrize) {
      displayPlayerCount = Math.round(backendPrize / (stake * 0.70));
    } else {
      const maxCardsForMinPrize = Math.floor(minPrize / (stake * 0.70));
      displayPlayerCount = Math.min(baseCards > 0 ? baseCards : displayPlayerCount, maxCardsForMinPrize);
    }
  }

  if (displayPlayerCount < selected.length) {
    displayPlayerCount = selected.length;
  }

  totalVisualCards = displayPlayerCount;
  const totalStake = totalVisualCards * stake;

  // House edge: 30% of total stake
  const houseEdge = Math.round(totalStake * 0.30);
  // Company gets 20% of stake
  const companyComm = Math.round(totalStake * 0.20);
  // Agent gets 10% of stake
  const agentComm = Math.round(totalStake * 0.10);

  // Prize that stays in sync with the drip animation:
  // while players are counting up one-by-one, prize grows proportionally.
  // Once drip reaches target, it equals the real backend prize.
  const dripPrize = Math.round(dripPlayerCount * stake * 0.70);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isLive = countdown !== null && countdown >= 0;
  const urgencyColor = countdown !== null && countdown <= 5 ? '#E74C3C' : T.gold;

  // Effective game-running state: true if confirmed by server OR if we have sessionStorage
  // hint from the previous load. This eliminates the flicker on refresh.
  const effectiveGameRunning = isGameRunning || (isInitializing && initialGameRunning);
  // Effective drawn numbers: use server data once available, fall back to sessionStorage on init
  const effectiveDrawnNumbers = (isInitializing && drawnNumbers.length === 0)
    ? initialDrawnNumbers
    : drawnNumbers;

  // Prevent the "flash of unmasked cartelas" if a game is running but we haven't fetched the first poll yet
  if (!mounted || (isInitializing && !initialGameRunning)) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: T.bg }}>
        <div style={{ width: '40px', height: '40px', border: `4px solid ${T.gold}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'loader-spin 1s linear infinite' }}>
          <style>{`@keyframes loader-spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div className={`selection-container ${isVip ? 'vip-theme' : 'brown'} ${isSpin ? 'spin-theme' : ''}`}>


      {/* ── Header ── */}
      <div className="selection-header-top" style={{ alignItems: 'center' }}>
        <button className="btn-back" onClick={() => router.push('/')}>
          <ChevronLeft size={20} color={isVip ? '#C471ED' : '#4B3621'} />
        </button>

        {/* Live Ball Calls — always show when game is running */}
        {effectiveGameRunning ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '4px',
            minWidth: 0,
          }}>
            {(() => {
              const headerDark = isDark || isVip || isSpin;
              return (
                <>
                  {effectiveDrawnNumbers.length > 0 ? (
                    <>
                      {/* Left: Big Ball (Newest) */}
                      {(() => {
                        const newestNum = currentBallSelect || effectiveDrawnNumbers[effectiveDrawnNumbers.length - 1];
                        const { letter, bgColor } = getBallDetails(newestNum);
                        return (
                          <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            backgroundColor: bgColor,
                            backgroundImage: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 25%)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: `inset -4px -4px 8px rgba(0,0,0,0.4), inset 2px 2px 6px rgba(255,255,255,0.6), 0 3px 8px rgba(0,0,0,0.3)`,
                            flexShrink: 0,
                            position: 'relative',
                            border: '1.5px solid rgba(255,255,255,0.4)'
                          }}>
                            <span style={{ fontSize: '11px', fontWeight: '900', color: '#fff', lineHeight: 1, opacity: 0.9, textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>{letter}</span>
                            <span style={{ fontSize: '22px', fontWeight: '900', color: '#fff', lineHeight: 1, marginTop: '-2px', letterSpacing: '-1px', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{newestNum}</span>
                          </div>
                        );
                      })()}

                      {/* Middle: Previous balls box */}
                      <div style={{
                        flex: 1,
                        height: '36px',
                        borderRadius: '18px',
                        border: `1px solid ${headerDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)'}`,
                        background: headerDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 6px',
                        gap: '4px',
                        overflow: 'hidden',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.08)'
                      }}>
                        <AnimatePresence initial={false} mode="popLayout">
                          {[...effectiveDrawnNumbers].reverse().slice(1, 6).map((num) => {
                            const { letter, bgColor } = getBallDetails(num);
                            return (
                              <motion.div
                                key={num}
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.3, opacity: 0 }}
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  backgroundColor: bgColor,
                                  backgroundImage: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 25%)',
                                  boxShadow: `inset -2px -2px 5px rgba(0,0,0,0.4), inset 1px 1px 3px rgba(255,255,255,0.6), 0 2px 4px rgba(0,0,0,0.3)`,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  position: 'relative',
                                  border: '1px solid rgba(255,255,255,0.4)'
                                }}
                              >
                                <span style={{ fontSize: '7px', fontWeight: '900', color: '#fff', lineHeight: 1, opacity: 0.9, textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>{letter}</span>
                                <span style={{ fontSize: '13px', fontWeight: '900', color: '#fff', lineHeight: 1, marginTop: '-1px', letterSpacing: '-0.5px', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>{num}</span>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>

                      {/* Right: Count pill */}
                      <div style={{
                        height: '30px',
                        borderRadius: '15px',
                        border: `1px solid ${headerDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'}`,
                        padding: '0 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: headerDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                        color: headerDark ? '#FFF' : '#1a1d2e',
                        fontSize: '11px',
                        fontWeight: '900',
                        flexShrink: 0
                      }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f1c40f' }} />
                        {effectiveDrawnNumbers.length} / 75
                      </div>
                    </>
                  ) : (
                    /* Waiting for first ball */
                    <div style={{
                      height: '32px',
                      borderRadius: '16px',
                      padding: '0 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: headerDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                      color: headerDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)',
                      fontSize: '11px',
                      fontWeight: '700',
                    }}>
                      <motion.div
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#E74C3C' }}
                      />
                      LIVE — waiting for balls...
                    </div>
                  )}

                  {/* Mic toggle — always visible when game is live */}
                  <button
                    onClick={() => {
                      const next = !soundOn;
                      setSoundOn(next);
                      soundOnSelectRef.current = next;
                      localStorage.setItem('game_sound', next ? 'true' : 'false');
                      // Unlock audio context on mobile (requires user gesture)
                      if (next) {
                        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                        if (ctx.state === 'suspended') ctx.resume();
                        if (!ballAudioRefSelect.current) {
                          ballAudioRefSelect.current = new Audio();
                        }
                      } else if (ballAudioRefSelect.current) {
                        ballAudioRefSelect.current.pause();
                      }
                    }}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: 'none',
                      background: soundOn
                        ? (headerDark ? 'rgba(46,204,113,0.25)' : 'rgba(46,204,113,0.15)')
                        : (headerDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      boxShadow: soundOn ? '0 0 8px rgba(46,204,113,0.4)' : 'none',
                      transition: 'all 0.2s ease',
                    }}
                    title={soundOn ? 'Mute live calls' : 'Unmute live calls'}
                  >
                    {soundOn
                      ? <Mic size={14} color="#2ECC71" />
                      : <MicOff size={14} color={headerDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'} />
                    }
                  </button>
                </>
              );
            })()}
          </div>
        ) : (
          <div className="header-text">
            <h1 style={{ color: isVip ? '#C471ED' : (isDark ? T.gold : '#3D2B1F'), fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <ShieldCheck size={24} /> {t('bunaGameZone') as string}
              {isVip && (
                <span style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#1C0A35', fontSize: '9px', fontWeight: '900', padding: '2px 8px', borderRadius: '12px', boxShadow: '0 0 10px rgba(255, 215, 0, 0.6)', display: 'inline-flex', alignItems: 'center', gap: '3px', border: '1.5px solid #FFF', letterSpacing: '0.5px' }}>
                  👑 BOSS VIP
                </span>
              )}
            </h1>
            <p style={{ color: isVip ? 'rgba(255,255,255,0.7)' : (isDark ? 'rgba(255,255,255,0.7)' : 'rgba(61,43,31,0.6)'), fontWeight: 800 }}>{roomType} • STAKE {stake} ETB</p>
          </div>
        )}
        <div onClick={() => setLanguage(getLanguage() === 'en' ? 'am' : 'en')} style={{ marginLeft: 'auto', cursor: 'pointer', display: 'flex', border: `1px solid ${isVip ? '#C471ED' : (isDark ? T.gold : '#3D2B1F')}`, borderRadius: '6px', overflow: 'hidden', fontSize: '10px', fontWeight: 'bold' }}>
          <div style={{ padding: '3px 8px', background: (!mounted || getLanguage() === 'en') ? (isVip ? '#C471ED' : (isDark ? T.gold : '#3D2B1F')) : 'transparent', color: (!mounted || getLanguage() === 'en') ? (isVip ? '#1C0A35' : (isDark ? T.header : '#FFF')) : (isVip ? '#C471ED' : (isDark ? T.gold : '#3D2B1F')) }}>EN</div>
          <div style={{ padding: '3px 8px', background: (mounted && getLanguage() === 'am') ? (isVip ? '#C471ED' : (isDark ? T.gold : '#3D2B1F')) : 'transparent', color: (mounted && getLanguage() === 'am') ? (isVip ? '#1C0A35' : (isDark ? T.header : '#FFF')) : (isVip ? '#C471ED' : (isDark ? T.gold : '#3D2B1F')) }}>AM</div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="stats-row-brown">
        <div className="capsule-white"><div className="l">WALLET</div><div className="v">{Number(balance).toFixed(0)}</div></div>
        <div className="capsule-white"><div className="l">BONUS</div><div className="v">{Number(user?.wallet?.bonusBalance || 0).toFixed(0)}</div></div>
        {/* PLAYERS capsule — number rolls up on each bot join */}
        <div className="capsule-white" style={{ position: 'relative', overflow: 'visible' }}>
          <div className="l">PLAYERS</div>
          <div className="v">
            <span className="count-normal">{dripPlayerCount}</span>
          </div>
        </div>
        {/* PRIZE capsule — number rolls up alongside player count */}
        <div className="capsule-brown total-box">
          <div className="l" style={{ color: 'rgba(255,255,255,0.5)' }}>PRIZE</div>
          <div className="v">
            <span className="count-normal">{dripPrize}</span>
          </div>
        </div>
      </div>

      {/* ── PREMIUM JACKPOT + COUNTDOWN BANNER ── */}
      <div style={{
        background: isDark
          ? 'linear-gradient(135deg, #0F0A02 0%, #1C1208 50%, #0F0A02 100%)'
          : 'linear-gradient(135deg, #1C1208 0%, #2D1F0A 60%, #1C1208 100%)',
        border: `2px solid ${urgencyColor}`,
        borderRadius: '14px',
        padding: '8px 12px',
        margin: '3px 0 4px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `0 6px 24px rgba(0,0,0,0.4), 0 0 0 1px ${urgencyColor}22, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}>
        {/* Shimmer sweep */}
        <div className="jackpot-shimmer" />

        {/* Left — Real Prize Pool */}
        <div>
          {/* Badge: PRIZE POOL */}
          <div style={{
            background: urgencyColor,
            color: '#1C0A35',
            fontSize: '9px',
            fontWeight: '900',
            padding: '3px 9px',
            borderRadius: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '6px',
            letterSpacing: '1.2px',
            boxShadow: `0 2px 8px ${urgencyColor}66`,
          }}>
            <Trophy size={9} /> PRIZE POOL
          </div>
          {/* Main prize amount — rolls up on each bot join */}
          <div
            style={{
              color: 'white',
              fontSize: '22px',
              fontWeight: '900',
              lineHeight: 1,
              letterSpacing: '-0.5px',
              textShadow: `0 0 20px ${urgencyColor}66`,
            }}
          >
            <span className="count-normal">{dripPrize} ETB</span>
          </div>
        </div>

        {/* Right — Countdown / Status */}
        <div style={{ textAlign: 'center', minWidth: '90px' }}>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '9px', fontWeight: '900', letterSpacing: '1.5px', marginBottom: '4px', textTransform: 'uppercase' }}>
            {effectiveGameRunning
              ? 'LIVE GAME'
              : countdown !== null && countdown >= 0
                ? 'STARTS IN'
                : 'NEXT GAME'}
          </div>
          {effectiveGameRunning ? (
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#E74C3C', textShadow: '0 0 14px rgba(231,76,60,0.7)', letterSpacing: '-1px' }}>
              🔴 LIVE
            </div>
          ) : countdown !== null && countdown >= 0 ? (
            <div
              style={{
                fontSize: countdown <= 5 ? '38px' : '32px',
                fontWeight: '900',
                color: countdown <= 5 ? '#E74C3C' : urgencyColor,
                textShadow: `0 0 18px ${countdown <= 5 ? 'rgba(231,76,60,0.9)' : urgencyColor + '88'}`,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-2px',
                lineHeight: 1,
              }}
            >
              {countdown}s
            </div>
          ) : (
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#2ECC71', textShadow: '0 0 12px rgba(46,204,113,0.6)' }}>
              ✅ OPEN
            </div>
          )}
        </div>
      </div>

      {/* ── Live Activity Bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '2px 4px',
        marginBottom: '2px',
      }}>
        {/* Left: card select label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: '900', fontSize: '12px', color: T.text }}>
            SELECT YOUR CARDS ({stake} ETB)
          </span>
        </div>
        {/* Right: selection counter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: T.gold,
            color: T.header,
            fontWeight: '900',
            fontSize: '12px',
            padding: '2px 10px',
            borderRadius: '12px',
            minWidth: '48px',
            textAlign: 'center',
          }}>
            {selected.length} / 5
          </div>
        </div>
      </div>



      {/* \u2500\u2500 Card Grid \u2500\u2500 */}
      <div className="grid-brown" style={{ position: 'relative', overflow: 'hidden', pointerEvents: effectiveGameRunning ? 'none' : undefined }}>

        {/* \u2550\u2550\u2550\u2550\u2550\u2550 GAME IN PROGRESS MASK \u2550\u2550\u2550\u2550\u2550\u2550 */}
        {effectiveGameRunning && (
          <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            pointerEvents: 'all',
            cursor: 'not-allowed',
            background: isVip
              ? 'radial-gradient(circle at top, rgba(45,20,66,0.95) 0%, rgba(28,10,53,0.98) 60%, rgba(15,4,26,1) 100%)'
              : 'linear-gradient(160deg, rgba(26,18,12,0.95) 0%, rgba(43,29,20,0.98) 50%, rgba(26,18,12,1) 100%)',
          }}>
            <div style={{
              position: 'sticky',
              top: '5%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              gap: '20px',
            }}>
              {/* Pulsing ring animation */}
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  border: `3px solid ${isVip ? '#FFD700' : '#D4AF37'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 0 30px ${isVip ? 'rgba(255,215,0,0.4)' : 'rgba(212,175,55,0.3)'}`,
                }}
              >
                <span style={{ fontSize: '40px' }}>🎱</span>
              </motion.div>

              {/* Title */}
              <div style={{ textAlign: 'center' }}>
                <motion.div
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  style={{
                    color: isVip ? '#FFD700' : '#D4AF37',
                    fontSize: '20px',
                    fontWeight: '900',
                    letterSpacing: '1px',
                    marginBottom: '8px',
                  }}
                >
                  ⏳ GAME IN PROGRESS
                </motion.div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: '700', lineHeight: 1.6 }}>
                  {t('gameInProgressScreen') as string}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginTop: '6px' }}>
                  {t('waitForGame') as string}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>
                  {t('selectAfterGame') as string}
                </div>
              </div>

              {/* Live game countdown if available */}
              {liveGameSyncTimer !== null && liveGameSyncTimer > 0 && (
                <div style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${isVip ? 'rgba(255,215,0,0.3)' : 'rgba(212,175,55,0.3)'}`,
                  borderRadius: '10px',
                  padding: '8px 20px',
                  textAlign: 'center',
                  marginTop: '10px'
                }}>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: '700', marginBottom: '4px' }}>NEXT CHECK IN</div>
                  <div style={{ color: isVip ? '#FFD700' : '#D4AF37', fontSize: '24px', fontWeight: '900' }}>{liveGameSyncTimer}s</div>
                </div>
              )}
            </div>
          </div>
        )}
        {Array.from({ length: isVip ? 50 : 250 }, (_, i) => i + 1).map(num => {
          const isOccupied = occupied.includes(num);
          const isSelected = selected.includes(num);
          const isOwned = ownedCardIds.includes(num);
          const isNewlySnatched = newlyOccupied.includes(num);

          return (
            <div
              key={num}
              className={`num-brown ${isSelected ? 'selected' : ''} ${isOccupied ? 'occupied' : ''} ${isOwned ? 'owned' : ''} ${isNewlySnatched ? 'newly-snatched' : ''}`}
              style={{
                background: isOwned
                  ? 'linear-gradient(135deg, #1C0A35, #D4AF37)'
                  : (isOccupied || isSelected) ? 'linear-gradient(135deg, #27AE60, #1E8449)' : undefined,
                color: (isOwned || isOccupied || isSelected)
                  ? 'white'
                  : T.text,
                cursor: isOccupied ? 'not-allowed' : 'pointer',
                opacity: 1,
                border: isOwned
                  ? '2.5px solid #D4AF37'
                  : (isOccupied || isSelected) ? '2px solid #2ECC71' : undefined,
                boxShadow: isOwned
                  ? '0 0 12px rgba(212, 175, 55, 0.6)'
                  : (isOccupied || isSelected) ? '0 0 8px rgba(46, 204, 113, 0.5)' : 'none',
                position: 'relative',
                overflow: 'hidden',
                fontWeight: '900',
              }}
              onClick={() => !isOccupied && toggleSelect(num)}
            >
              {num}

              {/* Gold crown for owned cards */}
              {isOwned && (
                <div style={{ position: 'absolute', top: '1.5px', right: '1.5px', lineHeight: 1 }}>
                  <Crown size={9} color="#F1C40F" fill="#F1C40F" />
                </div>
              )}

              {/* Green crown for selected cards — matches occupied/bot card style */}
              {isSelected && !isOwned && (
                <div style={{ position: 'absolute', top: '1.5px', right: '1.5px', lineHeight: 1 }}>
                  <Crown size={9} color="#2ECC71" fill="#2ECC71" />
                </div>
              )}

              {/* Green crown for occupied/sold cards */}
              {isOccupied && (
                <div style={{ position: 'absolute', top: '1.5px', right: '1.5px', lineHeight: 1 }}>
                  <Crown size={9} color="#2ECC71" fill="#2ECC71" />
                </div>
              )}

              {/* "SNATCHED" flash overlay */}
              {isNewlySnatched && (
                <motion.div
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 1.5 }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(231,76,60,0.6)',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '7px',
                    fontWeight: '900',
                    color: 'white',
                  }}
                >
                  ⚡
                </motion.div>
              )}
            </div>
          );
        })}


      </div>

      <div style={{ height: '250px' }} />



      {/* banner removed — mask is now inside grid-brown above */}


      <BunaModal
        isOpen={modal.isOpen}
        onClose={() => setModal(p => ({ ...p, isOpen: false }))}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        confirmText={modal.type === 'balance' ? 'Deposit Now' : 'Confirm'}
      />

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes ballPop {
          0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
          60%  { transform: scale(1.25) rotate(5deg); opacity: 1; }
          80%  { transform: scale(0.95) rotate(-2deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes tickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        /* occupied-pulse is intentionally removed — all occupied cards are solid green.
           Only newly-snatched cards get the flash animation below. */
        @keyframes snatchFlash {
          0%   { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        .newly-snatched {
          animation: snatchFlash 0.3s ease-out;
        }
        .jackpot-shimmer {
          position: absolute;
          top: 0; bottom: 0;
          left: -100%;
          width: 60%;
          background: linear-gradient(90deg, transparent, rgba(212,175,55,0.06), transparent);
          animation: shimmerMove 3.5s infinite linear;
          pointer-events: none;
        }
        @keyframes shimmerMove {
          0%   { left: -80%; }
          100% { left: 120%; }
        }
        @keyframes liveDot {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #2ECC71; }
          50%       { opacity: 0.4; box-shadow: 0 0 2px #2ECC71; }
        }
        @keyframes livePulse {
          0%   { box-shadow: 0 0 0 0 rgba(231,76,60,0.7); }
          70%  { box-shadow: 0 0 0 10px rgba(231,76,60,0); }
          100% { box-shadow: 0 0 0 0 rgba(231,76,60,0); }
        }
        @keyframes bounceBalls {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50%       { transform: translateY(-8px) rotate(180deg); }
        }
      `}} />

      {/* ── WINNER MODAL — broadcast to ALL guests on selection page ── */}
      <AnimatePresence>
        {gameFinishedData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 99999,
              background: 'rgba(0,0,0,0.88)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '16px',
              backdropFilter: 'blur(6px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 18, stiffness: 280 }}
              style={{
                width: '100%', maxWidth: '380px',
                background: isVip
                  ? 'linear-gradient(160deg, #1C0A35 0%, #2D1442 60%, #1C0A35 100%)'
                  : 'linear-gradient(160deg, #2b1d14 0%, #1a120c 60%, #3d2b1f 100%)',
                borderRadius: '24px',
                border: `2px solid ${isVip ? '#FFD700' : '#D4AF37'}`,
                boxShadow: `0 0 60px ${isVip ? 'rgba(255,215,0,0.4)' : 'rgba(212,175,55,0.35)'}, 0 30px 80px rgba(0,0,0,0.7)`,
                overflow: 'hidden',
                maxHeight: '92vh',
                overflowY: 'auto',
              }}
            >
              {/* Header */}
              <motion.div
                animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                transition={{ duration: 3, repeat: Infinity }}
                style={{
                  background: 'linear-gradient(135deg, #d4af37 0%, #a67c00 50%, #d4af37 100%)',
                  backgroundSize: '200% 200%',
                  padding: '20px 16px 16px',
                  textAlign: 'center',
                }}
              >
                <motion.div
                  animate={{ scale: [1, 1.15, 1], rotate: [-5, 5, -5, 5, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2 }}
                  style={{ fontSize: '48px', lineHeight: 1, marginBottom: '6px' }}
                >
                  🎉
                </motion.div>
                <div style={{
                  color: '#1a0a00', fontWeight: '900', fontSize: '22px',
                  letterSpacing: '1px', textShadow: '0 2px 4px rgba(255,255,255,0.3)',
                }}>
                  GAME OVER!
                </div>
                <div style={{
                  color: 'rgba(255,255,255,0.9)',
                  fontWeight: '700', fontSize: '13px', marginTop: '3px',
                }}>
                  🏆 Winner: {gameFinishedData.winnerName || 'Unknown'}
                </div>
              </motion.div>

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
                      const m = gameFinishedData.mode || 'ROW';
                      if (m === 'FULL_HOUSE') return 'FULL HOUSE BINGO';
                      if (m === 'DIAGONAL') return 'DIAGONAL BINGO';
                      if (m === 'COLUMN') return 'COLUMN BINGO';
                      if (m === 'ROW') return 'ROW BINGO';
                      return m + ' BINGO';
                    })()}
                  </div>
                  {gameFinishedData.prize > 0 && (
                    <div style={{
                      background: 'linear-gradient(135deg, #27AE60, #1E8449)',
                      color: 'white', fontWeight: '900', fontSize: '12px',
                      padding: '5px 14px', borderRadius: '20px',
                      letterSpacing: '0.5px', boxShadow: '0 3px 10px rgba(39,174,96,0.5)',
                    }}>
                      🏅 {Math.round(gameFinishedData.prize)} ETB
                    </div>
                  )}
                  {gameFinishedData.cardNo && (
                    <div style={{
                      background: 'rgba(255,215,0,0.15)',
                      color: '#FFD700', fontWeight: '900', fontSize: '12px',
                      padding: '5px 14px', borderRadius: '20px',
                      border: '1px solid #FFD70055', letterSpacing: '0.5px',
                    }}>
                      Cartela #{gameFinishedData.cardNo}
                    </div>
                  )}
                </div>

                {/* Winner Cartela Card */}
                {gameFinishedData.card && Array.isArray(gameFinishedData.card) && gameFinishedData.card.length === 5 && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{
                      color: '#FFD700', fontWeight: '900', fontSize: '11px',
                      textAlign: 'center', letterSpacing: '1px', marginBottom: '8px',
                      textTransform: 'uppercase', opacity: 0.9,
                    }}>
                      ☕ {gameFinishedData.winnerName}&apos;s Winning Cartela
                    </div>
                    {/* BINGO header row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '3px', marginBottom: '3px' }}>
                      {['B', 'I', 'N', 'G', 'O'].map(l => (
                        <div key={l} style={{
                          background: COL_COLOR[l], color: 'white',
                          textAlign: 'center', fontSize: '12px', fontWeight: '900',
                          borderRadius: '5px', padding: '4px 0',
                        }}>{l}</div>
                      ))}
                    </div>
                    {/* Render the winning cartela grid */}
                    {(() => {
                      const mode = gameFinishedData.mode || 'ROW';
                      const drawnSet = new Set(gameFinishedData.drawnNumbers || []);
                      const isDaubed = (ri: number, ci: number) => {
                        const cell = (gameFinishedData.card as any[][])[ri][ci];
                        return cell === 'FREE' || cell === 0 || cell === null || drawnSet.has(Number(cell));
                      };
                      const winningCells = new Set<string>();
                      if (mode === 'FULL_HOUSE') {
                        for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (isDaubed(r, c)) winningCells.add(`${r}-${c}`);
                      } else if (mode === 'ROW') {
                        for (let r = 0; r < 5; r++) {
                          if ([0, 1, 2, 3, 4].every(c => isDaubed(r, c))) {
                            for (let c = 0; c < 5; c++) winningCells.add(`${r}-${c}`);
                          }
                        }
                      } else if (mode === 'COLUMN') {
                        for (let c = 0; c < 5; c++) {
                          if ([0, 1, 2, 3, 4].every(r => isDaubed(r, c))) {
                            for (let r = 0; r < 5; r++) winningCells.add(`${r}-${c}`);
                          }
                        }
                      } else if (mode === 'DIAGONAL') {
                        if ([0, 1, 2, 3, 4].every(i => isDaubed(i, i))) for (let i = 0; i < 5; i++) winningCells.add(`${i}-${i}`);
                        if ([0, 1, 2, 3, 4].every(i => isDaubed(i, 4 - i))) for (let i = 0; i < 5; i++) winningCells.add(`${i}-${4 - i}`);
                      }
                      // Fallback: if we still have no winning cells, highlight a deterministic row
                      if (winningCells.size === 0) {
                        const pRand = ((gameFinishedData.cardNo || 1) * 7) % 100;
                        if (mode === 'ROW') {
                          const rows = [0, 1, 3, 4]; const fr = rows[pRand % rows.length];
                          for (let c = 0; c < 5; c++) { winningCells.add(`${fr}-${c}`); drawnSet.add(Number((gameFinishedData.card as any[][])[fr][c])); }
                        } else if (mode === 'COLUMN') {
                          const fc = pRand % 5;
                          for (let r = 0; r < 5; r++) { winningCells.add(`${r}-${fc}`); drawnSet.add(Number((gameFinishedData.card as any[][])[r][fc])); }
                        } else if (mode === 'FULL_HOUSE') {
                          for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { winningCells.add(`${r}-${c}`); drawnSet.add(Number((gameFinishedData.card as any[][])[r][c])); }
                        } else {
                          const fr = [0, 1, 3, 4][pRand % 4];
                          for (let c = 0; c < 5; c++) { winningCells.add(`${fr}-${c}`); drawnSet.add(Number((gameFinishedData.card as any[][])[fr][c])); }
                        }
                      }
                      return (gameFinishedData.card as any[][]).map((row: any[], ri: number) => (
                        <div key={ri} style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '3px', marginBottom: '3px' }}>
                          {row.map((cell: any, ci: number) => {
                            const isFreeCell = cell === 'FREE' || cell === 0 || cell === null;
                            const numVal = Number(cell);
                            const wasDrawn = !isFreeCell && drawnSet.has(numVal);
                            const col = isFreeCell ? 'N' : colLabel(numVal);
                            const isWinningCell = winningCells.has(`${ri}-${ci}`);
                            return (
                              <motion.div key={ci}
                                animate={isWinningCell ? { scale: [1, 1.05, 1], boxShadow: ['0 0 8px #2ECC71', '0 0 20px #27AE60', '0 0 8px #2ECC71'] } : {}}
                                transition={isWinningCell ? { duration: 1.2, repeat: Infinity } : {}}
                                style={{
                                  height: '28px',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  borderRadius: '5px', fontSize: '11px', fontWeight: '900',
                                  background: isWinningCell || isFreeCell ? '#27AE60' : wasDrawn ? COL_COLOR[col] : 'rgba(255,255,255,0.08)',
                                  color: isWinningCell || isFreeCell || wasDrawn ? 'white' : 'rgba(255,255,255,0.35)',
                                  border: isWinningCell ? '2px solid #a7f3d0' : (wasDrawn && !isFreeCell ? `1px solid ${COL_COLOR[col]}` : 'none'),
                                  opacity: wasDrawn && !isWinningCell && winningCells.size > 0 ? 0.45 : 1,
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
                {gameFinishedData.drawnNumbers && gameFinishedData.drawnNumbers.length > 0 && (
                  <div style={{
                    textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: '11px',
                    marginBottom: '14px',
                  }}>
                    {gameFinishedData.drawnNumbers.length} balls drawn in this game
                  </div>
                )}

                {/* Countdown to close */}
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
                    key={winnerRedirectSecs}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1 }}
                    style={{ color: '#FFD700', fontWeight: '900', fontSize: '28px', lineHeight: 1 }}
                  >
                    {winnerRedirectSecs}s
                  </motion.div>
                  <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '4px', height: '4px', marginTop: '8px', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: '100%' }}
                      animate={{ width: `${(winnerRedirectSecs / 4) * 100}%` }}
                      transition={{ duration: 0.9 }}
                      style={{ height: '100%', background: 'linear-gradient(90deg, #FFD700, #FF6B35)', borderRadius: '4px' }}
                    />
                  </div>
                </div>

                {/* Dismiss button */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (winnerRedirectRef.current) clearInterval(winnerRedirectRef.current);
                    setGameFinishedData(null);
                  }}
                  style={{
                    width: '100%', height: '44px',
                    background: 'linear-gradient(135deg, #FFD700, #FF6B35)',
                    color: '#1a0a00', border: 'none', borderRadius: '14px',
                    fontWeight: '900', fontSize: '13px', cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(255,215,0,0.4)',
                  }}
                >
                  🎮 OK, Got it!
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TicketSelectPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SelectionContent />
    </Suspense>
  );
}
