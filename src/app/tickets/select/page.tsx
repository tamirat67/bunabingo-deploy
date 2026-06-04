'use client';
import { useEffect, useState, useRef, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getMe, joinGame, getOccupiedCards, getGame } from '../../../lib/api';
import { PREDEFINED_CARDS } from '../../../lib/predefinedCards';
import { useSocket } from '../../../context/SocketContext';
import BunaModal from '../../../components/BunaModal';
import { ChevronLeft, RefreshCw, Play, ShieldCheck, Eye, Users, Trophy, Zap, Crown, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../../context/ThemeContext';

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
  const [game, setGame] = useState<any>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [serverOff, setServerOff] = useState(0);
  const [newlyOccupied, setNewlyOccupied] = useState<number[]>([]);
  const [fakePlayersCount, setFakePlayersCount] = useState(0);
  const [fakeOccupied, setFakeOccupied] = useState<number[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  // ── Live game state: true when the room has a RUNNING game and player is queued for next session
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [latestBall, setLatestBall] = useState<number | null>(null);
  const [hasTicketsInRunningGame, setHasTicketsInRunningGame] = useState(false);
  const [runningGameId, setRunningGameId] = useState<string | null>(null);
  // Ref so the polling interval always reads the latest value without stale closures
  const isGameRunningRef = useRef(false);
  const redirectedRef = useRef(false);
  const [liveGameDismissed, setLiveGameDismissed] = useState(false);
  // ── Server-time-anchored countdown for the LIVE GAME "NEXT CHECK" banner ──
  // liveGameEndTime is the UTC epoch ms when the current 20s poll-cycle ends.
  // Every device derives the display counter from the same epoch, so all
  // screens stay perfectly in sync regardless of when they loaded.
  const [liveGameSyncTimer, setLiveGameSyncTimer] = useState<number | null>(null);
  const [liveGameEndTime, setLiveGameEndTime] = useState<number | null>(null);
  const liveGameEndTimeRef = useRef<number | null>(null);   // always-fresh ref for use inside intervals
  const liveGameSyncRef = useRef<any>(null);
  const prevOccupied = useRef<number[]>([]);
  
  const selectedRef = useRef<number[]>([]);
  const ownedRef = useRef<number[]>([]);
  const occupiedRef = useRef<number[]>([]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

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
              // Fallback: reset a fresh 20s cycle
              const next = Date.now() + 20000;
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
              if (res.gameId) { setActiveGameId(res.gameId); loadGameData(res.gameId); }
              if (res.occupiedIds) setOccupied(res.occupiedIds);
              if (res.playerCount !== undefined) setPlayerCount(res.playerCount);
              if (ownedRef.current.length > 0 && res.gameId) {
                router.push(`/game?id=${res.gameId}&type=${roomType}&price=${stake}`);
              }
            } else {
              // Still running — start the next 20s cycle, anchored to server's gameStartedAt if available
              let next: number;
              if (res.gameStartedAt) {
                const cycleMs = 20000;
                const elapsed = (Date.now() - res.gameStartedAt) % cycleMs;
                next = Date.now() + (cycleMs - elapsed);
              } else {
                next = Date.now() + 20000;
              }
              liveGameEndTimeRef.current = next;
              setLiveGameEndTime(next);
            }
          }).catch(() => {
            // On error reset a fresh cycle so the timer doesn't stay at 0
            const next = Date.now() + 20000;
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
    getOccupiedCards(roomType, activeGameId).then(res => {
      const nowRunning = !!res?.isGameRunning;
      // Unlock in all cases — player shouldn't be permanently stuck
      isGameRunningRef.current = false;
      setIsGameRunning(false);
      setLiveGameDismissed(true);
      setLiveGameSyncTimer(null);
      liveGameEndTimeRef.current = null;
      setLiveGameEndTime(null);
      if (liveGameSyncRef.current) clearInterval(liveGameSyncRef.current);
      if (res?.gameId) { setActiveGameId(res.gameId); loadGameData(res.gameId); }
      if (res?.occupiedIds) setOccupied(res.occupiedIds);
      if (res?.playerCount !== undefined) setPlayerCount(res.playerCount);
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

  // Clean up fakeOccupied if they overlap with selected, owned, or real occupied cards
  useEffect(() => {
    setFakeOccupied(prev => prev.filter(num => !selected.includes(num) && !ownedCardIds.includes(num) && !occupied.includes(num)));
  }, [selected, ownedCardIds, occupied]);

  // Dynamic Fake Holds Simulation (Up to 25 cartelas for Standard, 15 for VIP)
  useEffect(() => {
    const maxFakeHolds = isVip ? 15 : 25;
    const totalCartelas = isVip ? 50 : 250;
    const getRandNum = (existing: number[]): number => {
      let attempts = 0;
      while (attempts < 100) {
        const num = Math.floor(Math.random() * totalCartelas) + 1;
        if (
          !existing.includes(num) &&
          !selectedRef.current.includes(num) &&
          !ownedRef.current.includes(num) &&
          !occupiedRef.current.includes(num)
        ) {
          return num;
        }
        attempts++;
      }
      return -1;
    };
    
    // Initial occupied fake cards (7-11 for VIP, 12-18 for Standard)
    const initialHolds: number[] = [];
    const initialCount = isVip 
      ? Math.floor(Math.random() * 5) + 7   // 7 to 11
      : Math.floor(Math.random() * 7) + 12; // 12 to 18
    for (let i = 0; i < initialCount; i++) {
      const n = getRandNum(initialHolds);
      if (n !== -1) initialHolds.push(n);
    }
    setFakeOccupied(initialHolds);

    const interval = setInterval(() => {
      setFakeOccupied(prev => {
        const currentHolds = prev.filter(
          num =>
            !selectedRef.current.includes(num) &&
            !ownedRef.current.includes(num) &&
            !occupiedRef.current.includes(num)
        );
        const newHolds = [...currentHolds];
        const lowThreshold = isVip ? 6 : 10;

        // 70% chance to perform a "shift" (simulate selecting and deselecting numbers)
        const action = Math.random() < 0.70 ? 'SHIFT' : 'FLUCTUATE';

        if (action === 'SHIFT' && newHolds.length > 0) {
          // Deselect one random held number and select a new one
          const removeIndex = Math.floor(Math.random() * newHolds.length);
          newHolds.splice(removeIndex, 1);

          const numToAdd = getRandNum(newHolds);
          if (numToAdd !== -1) {
            newHolds.push(numToAdd);
            // Pulse the newly selected card
            setNewlyOccupied(f => [...f, numToAdd]);
            setTimeout(() => setNewlyOccupied(f => f.filter(x => x !== numToAdd)), 1500);
          }
        } else {
          // Fluctuate count: add new holds, or remove existing ones
          const currentCount = newHolds.length;
          const shouldAdd = currentCount < lowThreshold ? true : (currentCount >= maxFakeHolds ? false : Math.random() > 0.50);
          if (shouldAdd) {
            const numToAdd = getRandNum(newHolds);
            if (numToAdd !== -1) {
              newHolds.push(numToAdd);
              setNewlyOccupied(f => [...f, numToAdd]);
              setTimeout(() => setNewlyOccupied(f => f.filter(x => x !== numToAdd)), 1500);
            }
          } else if (newHolds.length > 0) {
            const removeIndex = Math.floor(Math.random() * newHolds.length);
            newHolds.splice(removeIndex, 1);
          }
        }
        return newHolds;
      });
    }, 2000); // highly dynamic ticking every 2 seconds

    return () => clearInterval(interval);
  }, [isVip]);


  
  // Fake Player Simulation Logic
  useEffect(() => {
    const maxFakePlayers = isVip ? 12 : 28;
    if (game?.status !== 'RUNNING' && fakePlayersCount < maxFakePlayers) {
      const timer = setTimeout(() => {
        const newPlayers = Math.floor(Math.random() * 2) + 1; // Adds 1 to 2 players at a time
        setFakePlayersCount(prev => Math.min(prev + newPlayers, maxFakePlayers));
      }, Math.random() * 1500 + 1000); // Wait 1.0s to 2.5s between additions
      return () => clearTimeout(timer);
    }
  }, [fakePlayersCount, game?.status, isVip]);
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
    const gid = forcedGameId || activeGameId;
    if (!gid) return;
    getGame(gid).then(g => {
      setGame(g);
      // NOTE: loadGameData does NOT touch isGameRunning.
      // isGameRunning is controlled ONLY by getOccupiedCards (which does a real DB
      // check for a RUNNING game) and by socket events (game-started / game-finished).
      // loadGameData fetches the NEXT WAITING game when a game is running, so its
      // status would be 'WAITING' — clearing isGameRunning here would be wrong.
      if (g.serverTime) {
        setServerOff(g.serverTime - Date.now());
      }
      if (g.endTime && g.serverTime) {
        const offset = g.serverTime - Date.now();
        setEndTime(g.endTime);
        if (g.status === 'COUNTDOWN') {
          const rem = Math.max(0, Math.ceil((g.endTime - Date.now() - offset) / 1000));
          if (rem > 0) setCountdown(rem);
        } else {
          setCountdown(null);
          setEndTime(null);
        }
      } else if (g.status === 'COUNTDOWN' && g.countdownSeconds) {
        setCountdown((prev) => {
          if (prev !== null && prev >= 0) return prev;
          return g.countdownSeconds;
        });
      } else {
        setCountdown(null);
        setEndTime(null);
      }
    }).catch(() => {});
  }, [activeGameId]);

  // Local countdown fallback
  useEffect(() => {
    if (endTime === null) return;
    const timer = setInterval(() => {
      const now = Date.now() + serverOff;
      const rem = Math.max(0, Math.ceil((endTime - now) / 1000));
      setCountdown((prev) => {
        if (prev === rem) return prev;
        return rem;
      });
      if (rem <= 0) setEndTime(null);
    }, 100);
    return () => clearInterval(timer);
  }, [endTime, serverOff]);

  // Reliable Auto-buy Effect
  useEffect(() => {
    if (countdown === 1 && selected.length > 0 && !joining) {
      setJoining(true);
      joinGame(roomType, selected).then(res => {
        if (res && res.tickets) {
          setOwnedCardIds(res.tickets.map((t: any) => t.card.id));
          setSelected([]);
        }
      }).catch(() => {}).finally(() => {
        // Only release joining lock if we are still on the page, but let it stay true during transition
        setTimeout(() => setJoining(false), 2000);
      });
    }
  }, [countdown, selected, joining, roomType]);

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
    getMe().then(setUser).catch(() => {});
    loadGameData();

    // 1. Initial Quick Fetch (REST Fallback)
    getOccupiedCards(roomType, activeGameId).then(res => {
      setOccupied(res.occupiedIds || []);
      prevOccupied.current = res.occupiedIds || [];
      setPlayerCount(res.playerCount || 0);
      if (res.myCardIds && res.myCardIds.length > 0) {
        setSelected(res.myCardIds);
        setOwnedCardIds(res.myCardIds);
      }
      // Auto-switch to next WAITING game if current is RUNNING
      if (res.gameId) {
        setActiveGameId(res.gameId);
      }
      // NOTE: isGameRunning is NOT set here — syncRunningState (polling) is the
      // single source of truth. Setting it here causes a race condition where
      // stale cached backend data can lock the UI permanently.
    }).catch(() => {});

    // 2. High-Performance WebSocket Sync (Real-time & Zero Network Overhead)
    if (socket) {
      socket.emit('join-game', roomType);
      if (activeGameId) socket.emit('join-game', activeGameId);

      socket.on('occupied-sync', (data: any) => {
        if (data.tickets) {
          const ticketList = data.tickets;
          const myCardIds = ticketList.filter((t: any) => t.userId === user?.id).map((t: any) => t.cardId);
          const otherOccupiedIds = ticketList.filter((t: any) => t.userId !== user?.id).map((t: any) => t.cardId);
          
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
        }
      });

      socket.on('countdown-start', (d: any) => {
        if (d.endTime && d.serverTime) {
          const offset = d.serverTime - Date.now();
          setServerOff(offset);
          setEndTime(d.endTime);
          const rem = Math.max(0, Math.ceil((d.endTime - Date.now() - offset) / 1000));
          setCountdown(rem > 0 ? rem : null);
        } else {
          setCountdown(d.seconds);
        }
      });

      socket.on('game-started', (d: any) => {
        setGame((prev: any) => prev ? { ...prev, status: 'RUNNING' } : { status: 'RUNNING' });
        isGameRunningRef.current = true;
        setIsGameRunning(true);
        // Anchor the 20s NEXT CHECK cycle to the real server timestamp
        const endTime = (d.serverTime || Date.now()) + 20000;
        liveGameEndTimeRef.current = endTime;
        setLiveGameEndTime(endTime);
        // Redirect ONLY users who have purchased tickets (or had them auto-purchased)
        if (ownedRef.current.length > 0 && !redirectedRef.current) {
          redirectedRef.current = true;
          if (roomType.startsWith('SPIN_')) {
            router.push(`/play/spin?id=${d.gameId || activeGameId}&stake=${stake}`);
          } else {
            router.push(`/game?id=${d.gameId || activeGameId}&type=${roomType}&price=${stake}`);
          }
        }
      });

      // ── Late-join sync: server tells us when the running game started ──────
      // Allows a client that (re)loads mid-game to immediately show the correct
      // remaining seconds instead of starting a fresh independent 20s clock.
      socket.on('game-running-sync', (d: any) => {
        isGameRunningRef.current = true;
        setIsGameRunning(true);
        setLiveGameDismissed(false);
        const cycleMs = (d.cycleSeconds || 20) * 1000;
        const elapsed = (Date.now() - (d.gameStartedAt || Date.now())) % cycleMs;
        const endTime = Date.now() + (cycleMs - elapsed);
        liveGameEndTimeRef.current = endTime;
        setLiveGameEndTime(endTime);
      });

      socket.on('countdown-tick', (d: any) => {
        let currentRem = 0;
        if (d.endTime && d.serverTime) {
          const offset = d.serverTime - Date.now();
          setServerOff(offset);
          setEndTime(d.endTime);
          const rem = Math.max(0, Math.ceil((d.endTime - Date.now() - offset) / 1000));
          setCountdown(rem > 0 ? rem : null);
          currentRem = rem;
        } else {
          setCountdown(d.secondsRemaining);
          currentRem = d.secondsRemaining;
        }
        // Auto-buy logic moved to useEffect to ensure it fires reliably

        if (typeof d.playerCount === 'number') {
          setPlayerCount(d.playerCount);
        }
      });

      socket.on('number-drawn', (d: any) => {
        if (d.number !== undefined) {
          setDrawnNumbers(prev => {
            if (!prev.includes(d.number)) return [...prev, d.number];
            return prev;
          });
          // Flash the latest ball in the header
          setLatestBall(d.number);
          setTimeout(() => setLatestBall(null), 2000);
        }
      });

      // ── When the RUNNING game finishes, this lobby wakes up as next game ──
      socket.on('game-finished', () => {
        setIsGameRunning(false);
        isGameRunningRef.current = false;
        setLiveGameDismissed(true);
        setCountdown(null);
        setDrawnNumbers([]);
        setEndTime(null);
        setLiveGameSyncTimer(null);
        liveGameEndTimeRef.current = null;
        setLiveGameEndTime(null);

        getOccupiedCards(roomType, activeGameId).then(res => {
          if (res.gameId) {
            setActiveGameId(res.gameId);
            loadGameData(res.gameId);
            if (socket) socket.emit('join-game', res.gameId);
          }
          setOccupied(res.occupiedIds || []);
          setPlayerCount(res.playerCount || 0);
          const myNewCardIds = res.myCardIds || [];
          setOwnedCardIds(myNewCardIds);
        }).catch(() => {});
      });
    }

    return () => {
      if (socket) {
        socket.off('occupied-sync');
        socket.off('countdown-start');
        socket.off('countdown-tick');
        socket.off('game-started');
        socket.off('game-running-sync');
        socket.off('game-finished');
      }
    };
  }, [roomType, activeGameId, socket, loadGameData, user?.id, router, stake]);

  useEffect(() => {
    setSelected(prev => prev.filter(id => !occupied.includes(id)));
  }, [occupied]);

  const gridRef = useRef<HTMLDivElement>(null);

  // Helper to format bingo balls
  const getBallDetails = (num: number) => {
    if (num <= 15) return { letter: 'B', color: '#E74C3C' }; // Red
    if (num <= 30) return { letter: 'I', color: '#E67E22' }; // Orange
    if (num <= 45) return { letter: 'N', color: '#3498DB' }; // Blue
    if (num <= 60) return { letter: 'G', color: '#2ECC71' }; // Green
    return { letter: 'O', color: '#9B59B6' }; // Purple
  };

  // Prefetch game page to avoid loading delay when redirecting
  useEffect(() => {
    if (countdown !== null && countdown <= 5) {
      router.prefetch(`/game`);
      router.prefetch(`/play/spin`);
    }
  }, [countdown, router]);

  // ─── Auto-redirect to bingo calling page when game launches (30+1 trigger) ───
  // Catches cases where the game-started socket event was missed due to timing.
  useEffect(() => {
    if (game?.status === 'RUNNING' && ownedCardIds.length > 0 && activeGameId && !redirectedRef.current) {
      redirectedRef.current = true;
      if (roomType.startsWith('SPIN_')) {
        router.push(`/play/spin?id=${activeGameId}&stake=${stake}`);
      } else {
        router.push(`/game?id=${activeGameId}&type=${roomType}&price=${stake}`);
      }
    }
  }, [game?.status, ownedCardIds.length, activeGameId, roomType, stake, router]);

  // ─── Poll every 2s: getOccupiedCards is the SINGLE source of truth for isGameRunning ───
  // This handles all cases: page refresh during game, missed socket events, etc.
  // NOTE: isGameRunning is intentionally read via isGameRunningRef (not state) so this
  // interval is stable and never torn down/recreated on every game-state change.
  useEffect(() => {
    const syncRunningState = () => {
      getOccupiedCards(roomType, activeGameId).then(res => {
        setIsInitializing(false);
        if (!res) return;

        // Always read from ref — never from stale closure
        const wasRunning = isGameRunningRef.current;
        const nowRunning = !!res.isGameRunning;

        // Update isGameRunning based on authoritative server response
        if (nowRunning !== wasRunning) {
          isGameRunningRef.current = nowRunning;
          setIsGameRunning(nowRunning);
          if (!nowRunning && wasRunning) {
            // Game just finished — clear timer and release overlay
            setLiveGameDismissed(true);
            liveGameEndTimeRef.current = null;
            setLiveGameEndTime(null);
          }
          if (nowRunning && !wasRunning) {
            // Game just detected as running (page-refresh path) — anchor the 20s cycle
            setLiveGameDismissed(false);
            const cycleMs = 20000;
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
        if (res.gameId && res.gameId !== activeGameId && !nowRunning) {
          setActiveGameId(res.gameId);
          loadGameData(res.gameId);
          if (socket) socket.emit('join-game', res.gameId);
        }

        if (res.occupiedIds) setOccupied(res.occupiedIds);
        if (res.playerCount !== undefined) setPlayerCount(res.playerCount);

        setHasTicketsInRunningGame(!!res.hasTicketsInRunningGame);
        const newRunningId = res.runningGameId || null;
        setRunningGameId(newRunningId);
        // Subscribe to the running game's socket channel so we receive number-drawn events
        if (newRunningId && socket) {
          socket.emit('join-game', newRunningId);
        }
        if ((res as any).drawnNumbers) {
          setDrawnNumbers((res as any).drawnNumbers);
        }
      }).catch(() => {
        // Even on API failure, unblock the UI so player isn't stuck on "LOADING..."
        setIsInitializing(false);
      });
    };

    // Run immediately on mount / dependency change to catch refresh-during-game
    syncRunningState();

    // Then poll every 2s continuously (covers WAITING, COUNTDOWN, RUNNING states)
    // isGameRunning is NOT in deps — we use the ref so the interval never resets
    const poll = setInterval(() => {
      syncRunningState();
      if (!isGameRunningRef.current) loadGameData(); // keep countdown/game data fresh when not running
    }, isConnected ? 15000 : 2000);

    return () => clearInterval(poll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomType, activeGameId, loadGameData, socket, isConnected]);



  const toggleSelect = (num: number) => {
    if (isInitializing) return;
    
    // 1. If the card is owned/occupied by another player
    if (occupied.includes(num) || fakeOccupied.includes(num)) {
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
          title: 'DEPOSIT WALLET / ተቀማጭ ያድርጉ ⚠️',
          message: 'WARNING: Your wallet is empty (Main + Bonus = 0 ETB). Please deposit money to play. / ማስጠንቀቂያ፡ ዋና ሂሳብዎ እና ቦነስዎ ባዶ ነው። ለመጫወት እባክዎ ተቀማጭ ያድርጉ።',
          type: 'balance',
          onConfirm: () => router.push('/wallet')
        });
        return;
      }

      // Check maximum limit
      if (selected.length >= 5) {
        showAlert('Limit Reached', 'Maximum of 5 cards allowed per player', 'info');
        return;
      }

      // Check combined balance limit (main + bonus)
      const proposedSelected = [...selected, num];
      const newCardsToBuy = proposedSelected.filter(id => !ownedCardIds.includes(id));
      const proposedCost = newCardsToBuy.length * stake;

      if (roomType !== 'DEMO' && proposedCost > totalAvailable) {
        setModal({
          isOpen: true,
          title: 'Insufficient Balance / የኪስዎ ቀሪ በቂ አይደለም ⚠️',
          message: `You need ${proposedCost} ETB to select these cards. You have ${currentBalance.toFixed(2)} ETB (Main) + ${currentBonus.toFixed(2)} ETB (Bonus) = ${totalAvailable.toFixed(2)} ETB total. Please deposit to continue. / ${proposedCost} ETB ያስፈልግዎታል። ዋና: ${currentBalance.toFixed(2)} + ቦነስ: ${currentBonus.toFixed(2)} = ${totalAvailable.toFixed(2)} ETB ብቻ አለ።`,
          type: 'balance',
          onConfirm: () => router.push('/wallet')
        });
        return;
      }
    }

    // 3. Normal select/deselect flow (freely allow changing owned cards)
    setSelected(prev => {
      if (prev.includes(num)) return prev.filter(n => n !== num);
      if (prev.length >= 5) {
        showAlert('Limit Reached', 'Maximum of 5 cards allowed per player', 'info');
        return prev;
      }
      return [...prev, num];
    });
  };

const balance = Number(user?.wallet?.balance || 0);
  const bonusBalance = Number(user?.wallet?.bonusBalance || 0);
  const totalAvailable = balance + bonusBalance;

  const handleStart = async () => {
    if (isInitializing || selected.length === 0 || joining) return;
    setJoining(true);



    const newCardsToBuy = selected.filter(id => !ownedCardIds.includes(id));
    const totalCost = stake * newCardsToBuy.length;

    // Detect if selection actually changed
    const isSelectionChanged = selected.length !== ownedCardIds.length || selected.some(id => !ownedCardIds.includes(id));

    if (!isSelectionChanged) {
      if (isGameRunning && !hasTicketsInRunningGame) {
        setModal({
          isOpen: true,
          title: '🔴 Game In Progress!',
          message: 'ጨዋታ በሂደት ላይ ነው! ለሚቀጥለው ጨዋታ ካርቴላ ይግዙ።',
          type: 'info',
        });
        setJoining(false);
        return;
      }
      // If selection is identical to owned tickets, enter the game room directly
      if (roomType.startsWith('SPIN_')) router.push(`/play/spin?id=${activeGameId}&stake=${stake}`);
      else router.push(`/game?id=${activeGameId}&type=${roomType}&price=${stake}`);
      setJoining(false);
      return;
    }

    // Selection has changed, we must send joinGame to update tickets in the database
    if (newCardsToBuy.length > 0 && totalAvailable < totalCost && roomType !== 'DEMO') {
      setModal({
        isOpen: true,
        title: 'Insufficient Balance / የኪስዎ ቀሪ በቂ አይደለም ⚠️',
        message: `You need ${totalCost} ETB to purchase ${newCardsToBuy.length} card(s). You have ${balance.toFixed(2)} ETB (Main) + ${bonusBalance.toFixed(2)} ETB (Bonus) = ${totalAvailable.toFixed(2)} ETB total. Please deposit to continue. / ${totalCost} ETB ያስፈልግዎታልᢾ ${balance.toFixed(2)} + ቦነስ: ${bonusBalance.toFixed(2)} = ${totalAvailable.toFixed(2)} ETB ብቻ አለ།`,
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
          title: '🔴 Game In Progress!',
          message: 'ጨዋታ በሂደት ላይ ነው! ለሚቀጥለው ጨዋታ ካርቴላ ይግዙ።',
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
          title: '🔴 Game In Progress!',
          message: 'A bingo game is currently live. Cartela selling is stopped. Wait for the game to finish — the page will unlock automatically!',
          type: 'info',
        });
      } else if (errCode === 'DEMO_LIMIT_REACHED') {
        setModal({
          isOpen: true,
          title: '🎮 Demo Limit Reached / ዲሞ ጊዜ አልቋል',
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
        showAlert('Join Failed', msg, 'error');
      }
    } finally {
      setJoining(false);
    }

  };

  const isDark = activeThemeKey === 'DARK' || activeThemeKey === 'GRAY';

  const displayPlayerCount = playerCount + fakePlayersCount;
  
  // ─── Prize / Stake / Commission calculation ─────────────────────────────
  // 30% house edge: 20% company commission + 10% agent commission
  // 70% of ticket sales goes to prize pool for winners
  const totalOccupiedList = Array.from(new Set([...occupied, ...fakeOccupied]));
  const occupiedCount = totalOccupiedList.filter(id => !ownedCardIds.includes(id)).length;

  const baseCards = displayPlayerCount || 1;
  const allCards = Math.max(game?.tickets?.length || 0, baseCards) || 1;
  const totalStake = allCards * stake;
  
  // House edge: 30% of total stake
  const houseEdge = Math.round(totalStake * 0.30);
  // Company gets 20% of stake (66.67% of house edge)
  const companyComm = Math.round(totalStake * 0.20);
  // Agent gets 10% of stake (33.33% of house edge)
  const agentComm = Math.round(totalStake * 0.10);
  // Prize pool: 70% of stake
  const prize = Math.max(
    game?.totalPrize && Number(game.totalPrize) > 0 ? Number(game.totalPrize) : 0,
    Math.round(totalStake * 0.70)
  );

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isLive = countdown !== null && countdown > 0;
  const urgencyColor = countdown !== null && countdown <= 5 ? '#E74C3C' : T.gold;

  return (
    <div className={`selection-container ${isVip ? 'vip-theme' : 'brown'} ${isSpin ? 'spin-theme' : ''}`}>


      {/* ── Header ── */}
      <div className="selection-header-top" style={{ alignItems: 'center' }}>
        <button className="btn-back" onClick={() => router.push('/')}>
          <ChevronLeft size={20} color={isVip ? '#C471ED' : '#4B3621'} />
        </button>

        {/* Recent Balls Ticker — newest ball pops in, older ones scroll right-to-left */}
        {isGameRunning && drawnNumbers.length > 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            overflow: 'hidden',
            minWidth: 0,
          }}>
            {/* Label */}
            <div style={{
              fontSize: '9px',
              fontWeight: '900',
              color: isVip ? '#FFD700' : '#4B3621',
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
              textTransform: 'uppercase',
              flexShrink: 0,
            }}>
              RECENT<br/>BALLS
            </div>

            {/* Latest ball — big animated pop-in */}
            {latestBall !== null && (() => {
              const { letter, color } = getBallDetails(latestBall);
              return (
                <div key={latestBall} style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: color,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFF',
                  boxShadow: `0 0 18px ${color}, 0 2px 8px rgba(0,0,0,0.4)`,
                  border: '2.5px solid #FFF',
                  flexShrink: 0,
                  animation: 'ballPop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
                  zIndex: 2,
                }}>
                  <span style={{ fontSize: '9px', fontWeight: '900', lineHeight: 1 }}>{letter}</span>
                  <span style={{ fontSize: '15px', fontWeight: '900', lineHeight: 1 }}>{latestBall}</span>
                </div>
              );
            })()}

            {/* Scrolling older balls */}
            <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex',
                gap: '5px',
                animation: 'tickerScroll 14s linear infinite',
                width: 'max-content',
              }}>
                {(() => {
                  const older = [...drawnNumbers].reverse().slice(latestBall !== null ? 1 : 0);
                  const doubled = [...older, ...older];
                  return doubled.map((num, i) => {
                    const { letter, color } = getBallDetails(num);
                    return (
                      <div key={i} style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: color,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFF',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
                        border: '2px solid rgba(255,255,255,0.65)',
                        flexShrink: 0,
                        opacity: 0.85,
                      }}>
                        <span style={{ fontSize: '8px', fontWeight: '800', lineHeight: 1 }}>{letter}</span>
                        <span style={{ fontSize: '13px', fontWeight: '900', lineHeight: 1 }}>{num}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        ) : (
          <div className="header-text">
            <h1 style={{ color: isVip ? '#C471ED' : '#3D2B1F', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <ShieldCheck size={24} /> BUNA GAME ZONE
              {isVip && (
                <span style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#1C0A35', fontSize: '9px', fontWeight: '900', padding: '2px 8px', borderRadius: '12px', boxShadow: '0 0 10px rgba(255, 215, 0, 0.6)', display: 'inline-flex', alignItems: 'center', gap: '3px', border: '1.5px solid #FFF', letterSpacing: '0.5px' }}>
                  👑 BOSS VIP
                </span>
              )}
            </h1>
            <p style={{ color: isVip ? 'rgba(255,255,255,0.7)' : 'rgba(61,43,31,0.6)', fontWeight: 800 }}>{roomType} • STAKE {stake} ETB</p>
          </div>
        )}
      </div>

      {/* ── Stats Row ── */}
      <div className="stats-row-brown">
        <div className="capsule-white"><div className="l">WALLET</div><div className="v">{Number(balance).toFixed(0)}</div></div>
        <div className="capsule-white"><div className="l">BONUS</div><div className="v">{Number(user?.wallet?.bonusBalance || 0).toFixed(0)}</div></div>
        <div className="capsule-white"><div className="l">PLAYERS</div><div className="v">{displayPlayerCount}</div></div>
        <div className="capsule-brown total-box"><div className="l" style={{ color: 'rgba(255,255,255,0.5)' }}>STAKE</div><div className="v">{stake}</div></div>
      </div>



      {/* ── PREMIUM JACKPOT + COUNTDOWN BANNER ── */}
      <div style={{
        background: isDark
          ? 'linear-gradient(135deg, #0F0A02 0%, #1C1208 50%, #0F0A02 100%)'
          : 'linear-gradient(135deg, #1C1208 0%, #2D1F0A 60%, #1C1208 100%)',
        border: `2px solid ${urgencyColor}`,
        borderRadius: '16px',
        padding: '10px 14px',
        margin: '4px 0 6px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px ${urgencyColor}22, inset 0 1px 0 rgba(255,255,255,0.04)`,
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
          {/* Main prize amount — this is what the winner receives */}
          <div
            style={{
              color: 'white',
              fontSize: '24px',
              fontWeight: '900',
              lineHeight: 1,
              letterSpacing: '-0.5px',
              textShadow: `0 0 20px ${urgencyColor}66`,
            }}
          >
            {prize.toFixed(0)} ETB
          </div>
          {/* Pool info only — no internal commission breakdown */}
          <div style={{ fontSize: '9px', fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.5px', marginTop: '5px' }}>
            Pool: {totalStake.toFixed(0)} ETB
          </div>
        </div>

        {/* Right — Countdown / Status */}
        <div style={{ textAlign: 'center', minWidth: '90px' }}>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '9px', fontWeight: '900', letterSpacing: '1.5px', marginBottom: '4px', textTransform: 'uppercase' }}>
            {isGameRunning || game?.status === 'RUNNING'
              ? 'LIVE GAME'
              : countdown !== null && countdown > 0
              ? 'STARTS IN'
              : 'NEXT GAME'}
          </div>
          {isGameRunning || game?.status === 'RUNNING' ? (
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#E74C3C', textShadow: '0 0 14px rgba(231,76,60,0.7)', letterSpacing: '-1px' }}>
              🔴 LIVE
            </div>
          ) : countdown !== null && countdown > 0 ? (
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
        padding: '4px',
        marginBottom: '4px',
      }}>
        {/* Left: card select label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: '900', fontSize: '12px', color: T.text }}>
            SELECT YOUR CARDS ({stake} ETB)
          </span>
        </div>
        {/* Right: selection counter + players */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {occupiedCount > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(46,204,113,0.12)',
              border: '1px solid rgba(46,204,113,0.3)',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '10px',
              fontWeight: '900',
              color: '#27AE60',
            }}>
              <Eye size={10} /> {occupiedCount} held
            </div>
          )}
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

      {/* ── Players Browsing Indicator ── */}
      {displayPlayerCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 8px',
            marginBottom: '4px',
            background: `${T.gold}11`,
            border: `1px solid ${T.gold}33`,
            borderRadius: '10px',
            fontSize: '10px',
            fontWeight: '800',
            color: T.brown,
          }}
        >
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2ECC71', boxShadow: '0 0 6px #2ECC71', animation: 'liveDot 1.5s infinite' }} />
          <Users size={11} color={T.gold} />
          <span><strong style={{ color: T.text }}>{displayPlayerCount}</strong> players active now</span>
          {occupiedCount > 0 && (
            <span style={{ marginLeft: 'auto', color: '#E67E22', fontWeight: '900' }}>
              🔥 {occupiedCount} cards snatched!
            </span>
          )}
        </motion.div>
      )}

      {/* \u2500\u2500 Card Grid \u2500\u2500 */}
      <div className="grid-brown" style={{ position: 'relative', overflow: 'hidden' }}>
        
        {/* \u2550\u2550\u2550\u2550\u2550\u2550 GAME IN PROGRESS MASK \u2550\u2550\u2550\u2550\u2550\u2550 */}
        {isGameRunning && (
          <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            background: isVip
              ? 'radial-gradient(circle at top, rgba(45,20,66,0.95) 0%, rgba(28,10,53,0.98) 60%, rgba(15,4,26,1) 100%)'
              : 'linear-gradient(160deg, rgba(26,18,12,0.95) 0%, rgba(43,29,20,0.98) 50%, rgba(26,18,12,1) 100%)',
            backdropFilter: 'blur(4px)',
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
                ጨዋታ በሂደት ላይ ነው!
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginTop: '6px' }}>
                Please wait for this game to finish.
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>
                ጨዋታው ሲጠናቀቅ ካርቴላ መምረጥ ይችላሉ።
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
          const isOccupied = occupied.includes(num) || fakeOccupied.includes(num);
          const isSelected = selected.includes(num);
          const isOwned = ownedCardIds.includes(num);
          const isNewlySnatched = newlyOccupied.includes(num);

          return (
            <div
              key={num}
              className={`num-brown ${isSelected ? 'selected' : ''} ${isOccupied ? 'occupied occupied-pulse' : ''} ${isOwned ? 'owned' : ''} ${isNewlySnatched ? 'newly-snatched' : ''}`}
              style={{
                background: isOwned
                  ? 'linear-gradient(135deg, #1C0A35, #D4AF37)'
                  : (isOccupied ? 'linear-gradient(135deg, #27AE60, #1E8449)' : (isSelected ? 'linear-gradient(135deg, #00B4DB, #0083B0)' : undefined)),
                color: (isOwned || isOccupied || isSelected)
                  ? 'white'
                  : T.text,
                cursor: isOccupied ? 'not-allowed' : 'pointer',
                opacity: 1,
                border: isOwned
                  ? '2.5px solid #D4AF37'
                  : (isOccupied ? '2px solid #2ECC71' : (isSelected ? '2px solid #00D2FF' : undefined)),
                boxShadow: isOwned
                  ? '0 0 12px rgba(212, 175, 55, 0.6)'
                  : (isOccupied ? '0 0 8px rgba(46, 204, 113, 0.5)' : (isSelected ? '0 0 10px rgba(0, 180, 219, 0.6)' : 'none')),
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

              {/* Light blue/cyan crown for selected cards */}
              {isSelected && !isOwned && (
                <div style={{ position: 'absolute', top: '1.5px', right: '1.5px', lineHeight: 1 }}>
                  <Crown size={9} color="#E0F7FA" fill="#00E5FF" />
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

      {/* ── Footer ── */}
      <div 
        className="selection-footer-smart"
        style={{
          background: isDark ? 'rgba(15, 20, 25, 0.15)' : 'rgba(232, 220, 196, 0.15)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
        }}
      >
        <div className="footer-cards-scroll">
          {selected.length === 0 ? (
            <div className="footer-no-cards">Select cards to preview</div>
          ) : (
            selected.map(num => {
              const card = PREDEFINED_CARDS[num] || [];
              return (
                <div key={num} className="footer-card-item">
                  <div className="flp-title">#{num}</div>
                  <div className="pc-mini-grid">
                    {card.map((row, ri) => row.map((cell: any, ci) => (
                      <div key={`${ri}-${ci}`} className={`pc-mini-cell ${cell === 0 ? 'star' : ''}`}>
                        {cell === 0 ? '★' : cell}
                      </div>
                    )))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="footer-right-actions">
          <button className="btn-refresh-blue" onClick={() => window.location.reload()}>
            <RefreshCw size={16} /> Refresh
          </button>
          {countdown !== 0 && (
            <button
              className={`btn-start-game ${selected.length > 0 && !isInitializing ? 'active' : ''}`}
              disabled={selected.length === 0 || joining || isInitializing}
              onClick={handleStart}
              style={isInitializing ? { background: '#555', borderBottomColor: '#333', opacity: 0.6, cursor: 'not-allowed' } : undefined}
            >
              <Play size={16} fill="white" /> {(() => {
                if (joining) return 'CONFIRMING...';
                if (isInitializing) return 'LOADING...';
                if (hasTicketsInRunningGame && selected.length === 0) return 'GAME IN PROGRESS...';
                if (isGameRunning && ownedCardIds.length > 0) return 'WAITING FOR NEXT GAME...';
                const isSelectionChanged = selected.length !== ownedCardIds.length || selected.some(id => !ownedCardIds.includes(id));
                if (isSelectionChanged) return ownedCardIds.length > 0 ? 'CONFIRM SELECTION' : 'BUY TICKETS';
                return ownedCardIds.length > 0 ? 'ENTER GAME ROOM' : 'BUY TICKETS';
              })()}
            </button>
          )}
        </div>
      </div>

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

      <style dangerouslySetInnerHTML={{ __html: `
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
        @keyframes occupiedGreenPulse {
          0%   { background: linear-gradient(135deg, #1E8449, #27AE60); box-shadow: 0 0 4px rgba(46,204,113,0.4); border-color: #27AE60; }
          50%  { background: linear-gradient(135deg, #27AE60, #2ECC71); box-shadow: 0 0 14px rgba(46,204,113,0.8); border-color: #2ECC71; }
          100% { background: linear-gradient(135deg, #1E8449, #27AE60); box-shadow: 0 0 4px rgba(46,204,113,0.4); border-color: #27AE60; }
        }
        .occupied-pulse {
          animation: occupiedGreenPulse 2s infinite ease-in-out !important;
          color: white !important;
          opacity: 1 !important;
          border: 1.5px solid #2ecc71 !important;
        }
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
