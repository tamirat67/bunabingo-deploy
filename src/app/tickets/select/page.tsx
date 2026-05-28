'use client';
import { useEffect, useState, useRef, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getMe, joinGame, getOccupiedCards, getGame } from '../../../lib/api';
import { PREDEFINED_CARDS } from '../../../lib/predefinedCards';
import { useSocket } from '../../../context/SocketContext';
import BunaModal from '../../../components/BunaModal';
import { ChevronLeft, RefreshCw, Play, ShieldCheck, Eye, Users, Trophy, Zap, Crown } from 'lucide-react';
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
  // ── Non-looping 60→0 WAITING-lobby countdown displayed on the grid mask ──
  const [waitingCountdown, setWaitingCountdown] = useState(60);
  const waitingCountdownRef = useRef(60);
  const waitingGameIdRef = useRef<string | undefined>(undefined); // track which game the 60s belongs to
  const [gameStartedMask, setGameStartedMask] = useState(false); // brief "Game Started!" flash
  const [endTime, setEndTime] = useState<number | null>(null);
  const [serverOff, setServerOff] = useState(0);
  const [newlyOccupied, setNewlyOccupied] = useState<number[]>([]);
  const [fakePlayersCount, setFakePlayersCount] = useState(0);
  const [fakeOccupied, setFakeOccupied] = useState<number[]>([]);
  // ── Live game state: true when the room has a RUNNING game and player is queued for next session
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [liveGameDismissed, setLiveGameDismissed] = useState(false);
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

  // ── Global Synchronized Countdown: counts from 3:00 to 00:00 based on game creation time, then freezes ──
  useEffect(() => {
    // Only tick when we have a WAITING game and no real countdown running
    const isRealCountdown = countdown !== null && countdown > 0;
    if (isRealCountdown || isGameRunning) return;
    if (game?.status !== 'WAITING') return;

    // Use the game's createdAt timestamp so ALL players (phone, tablet, etc.) see the exact same value
    const gameStartMs = game?.createdAt ? new Date(game.createdAt).getTime() : Date.now();
    const TOTAL_WAIT_SECONDS = 180; // 3 minutes

    const tick = () => {
      const now = Date.now() + serverOff;
      const elapsed = Math.floor(Math.max(0, now - gameStartMs) / 1000);
      const remaining = Math.max(0, TOTAL_WAIT_SECONDS - elapsed);
      setWaitingCountdown(remaining);

      // When it hits exactly 00:00 — freeze and show "Waiting for Players" overlay
      if (remaining === 0) {
        setGameStartedMask(true);
      } else {
        setGameStartedMask(false);
      }
    };

    tick(); // run immediately on mount so there is no 1s blank
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [game?.status, game?.createdAt, countdown, isGameRunning, serverOff]);

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
  const { socket } = useSocket();

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
      // ── Always sync isGameRunning from actual server game status ──
      if (g.status === 'RUNNING') {
        setIsGameRunning(true);
      } else {
        // WAITING, COUNTDOWN, READY, FINISHED — not "running" for our purposes
        setIsGameRunning(false);
        setLiveGameDismissed(true);
      }
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
        const estimatedEnd = Date.now() + (g.countdownSeconds * 1000);
        setEndTime(estimatedEnd);
        setServerOff(0);
        setCountdown(g.countdownSeconds);
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
      setCountdown(rem);
      if (rem <= 0) setEndTime(null);
    }, 1000);
    return () => clearInterval(timer);
  }, [endTime, serverOff]);

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
      if (res.isGameRunning) {
        setIsGameRunning(true);
        setLiveGameDismissed(false);
      }
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
        setCountdown(d.seconds);
        if (d.endTime && d.serverTime) {
          setServerOff(d.serverTime - Date.now());
          setEndTime(d.endTime);
        }
      });

      socket.on('game-started', (d: any) => {
        setGame((prev: any) => prev ? { ...prev, status: 'RUNNING' } : { status: 'RUNNING' });
        setGameStartedMask(false); // dismiss the flash mask — game is now truly live
        setIsGameRunning(true);
        // Automatically redirect to the game if the user has purchased tickets
        if (ownedRef.current.length > 0) {
          if (roomType.startsWith('SPIN_')) {
            router.push(`/play/spin?id=${d.gameId || activeGameId}&stake=${stake}`);
          } else {
            router.push(`/game?id=${d.gameId || activeGameId}&type=${roomType}&price=${stake}`);
          }
        }
      });

      socket.on('countdown-tick', (d: any) => {
        setCountdown(d.secondsRemaining);
      });

      // ── When the RUNNING game finishes, this lobby wakes up as next game ──
      socket.on('game-finished', () => {
        setIsGameRunning(false);
        setLiveGameDismissed(true);
        setCountdown(null);
        setEndTime(null);
        setGameStartedMask(false);
        // Reset the waiting countdown so the next WAITING game gets a fresh 60s
        waitingGameIdRef.current = undefined;
        waitingCountdownRef.current = 180;
        setWaitingCountdown(180);
        
        getOccupiedCards(roomType, activeGameId).then(res => {
          if (res.gameId) {
            setActiveGameId(res.gameId);
            loadGameData(res.gameId); // Force load the new waiting game data!
            if (socket) socket.emit('join-game', res.gameId);
          }
          setOccupied(res.occupiedIds || []);
          setPlayerCount(res.playerCount || 0);
          
          // CRITICAL: Update owned card IDs for the new game!
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
        socket.off('game-finished');
      }
    };
  }, [roomType, activeGameId, socket, loadGameData, user?.id, router, stake]);

  useEffect(() => {
    setSelected(prev => prev.filter(id => !occupied.includes(id)));
  }, [occupied]);

  // ─── Auto-redirect to bingo calling page when game launches (30+1 trigger) ───
  // Catches cases where the game-started socket event was missed due to timing.
  useEffect(() => {
    if (game?.status === 'RUNNING' && ownedCardIds.length > 0 && activeGameId) {
      if (roomType.startsWith('SPIN_')) {
        router.push(`/play/spin?id=${activeGameId}&stake=${stake}`);
      } else {
        router.push(`/game?id=${activeGameId}&type=${roomType}&price=${stake}`);
      }
    }
  }, [game?.status]);

  // ─── Poll game status while WAITING so we never miss the auto-launch ─────────
  useEffect(() => {
    if (game?.status !== 'WAITING' && game?.status !== 'COUNTDOWN') return;
    const poll = setInterval(() => { loadGameData(); }, 1500);
    return () => clearInterval(poll);
  }, [game?.status, loadGameData]);

  const toggleSelect = (num: number) => {
    // 1. If the card is owned/occupied by another player
    if (occupied.includes(num) || fakeOccupied.includes(num)) {
      showAlert('Card Taken', 'This card has just been purchased by another player! Please choose a free card.', 'error');
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

  const handleStart = async () => {
    if (selected.length === 0 || joining) return;
    setJoining(true);

    const newCardsToBuy = selected.filter(id => !ownedCardIds.includes(id));
    const totalCost = stake * newCardsToBuy.length;

    // Detect if selection actually changed
    const isSelectionChanged = selected.length !== ownedCardIds.length || selected.some(id => !ownedCardIds.includes(id));

    if (!isSelectionChanged) {
      // If selection is identical to owned tickets, enter the game room directly
      if (roomType.startsWith('SPIN_')) router.push(`/play/spin?id=${activeGameId}&stake=${stake}`);
      else router.push(`/game?id=${activeGameId}&type=${roomType}&price=${stake}`);
      setJoining(false);
      return;
    }

    // Selection has changed, we must send joinGame to update tickets in the database
    const bonusBalance = Number(user?.wallet?.bonusBalance || 0);
    const totalAvailableAtJoin = Number(balance) + bonusBalance;
    if (newCardsToBuy.length > 0 && totalAvailableAtJoin < totalCost && roomType !== 'DEMO') {
      setModal({
        isOpen: true,
        title: 'Insufficient Balance / የኪስዎ ቀሪ በቂ አይደለም ⚠️',
        message: `You need ${totalCost} ETB to purchase ${newCardsToBuy.length} card(s). You have ${Number(balance).toFixed(2)} ETB (Main) + ${bonusBalance.toFixed(2)} ETB (Bonus) = ${totalAvailableAtJoin.toFixed(2)} ETB total. / ${totalCost} ETB ያስፈልግዎታል። ዋና: ${Number(balance).toFixed(2)} + ቦነስ: ${bonusBalance.toFixed(2)} = ${totalAvailableAtJoin.toFixed(2)} ETB ብቻ አለ።`,
        type: 'balance',
        onConfirm: () => router.push('/wallet')
      });
      setJoining(false);
      return;
    }

    try {
      const res = await joinGame(roomType, selected);

      // ── GAME_IN_PROGRESS: backend returned 202 — player is queued for next session ──
      if (res.error === 'GAME_IN_PROGRESS' || res.nextGameId) {
        setIsGameRunning(true);
        setLiveGameDismissed(false);
        if (res.nextGameId) setActiveGameId(res.nextGameId);
        setModal({
          isOpen: true,
          title: '🔴 Game In Progress!',
          message: 'A bingo game is currently live. Your cartelas have been reserved for the NEXT session. Stay on this page — it will automatically activate when the current game finishes!',
          type: 'info',
        });
        setJoining(false);
        return;
      }

      if (typeof window !== 'undefined' && res.gameId && res.tickets) {
        sessionStorage.setItem(`game_tickets_${res.gameId}`, JSON.stringify(res.tickets));
      }
      if (roomType.startsWith('SPIN_')) router.push(`/play/spin?id=${res.gameId}&stake=${stake}`);
      else router.push(`/game?id=${res.gameId}&type=${roomType}&price=${stake}`);
    } catch (err: any) {
      const errData = err.response?.data;
      const errCode = errData?.error;
      const msg = errData?.message || err.message || 'Failed to join';

      // ── Graceful handling of GAME_IN_PROGRESS via axios error response ──
      if (errCode === 'GAME_IN_PROGRESS') {
        setIsGameRunning(true);
        setLiveGameDismissed(false);
        if (errData?.nextGameId) setActiveGameId(errData.nextGameId);
        setModal({
          isOpen: true,
          title: '🔴 Game In Progress!',
          message: msg || 'A bingo game is currently live. Your cartelas are reserved for the next session. Stay on this page!',
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
      } else {
        showAlert('Join Failed', msg, 'error');
      }
    } finally {
      setJoining(false);
    }

  };

  const balance = user?.wallet?.balance || 0;
  const isDark = activeThemeKey === 'DARK' || activeThemeKey === 'GRAY';

  const displayPlayerCount = playerCount + fakePlayersCount;
  
  // ─── Prize / Stake / Commission calculation ─────────────────────────────
  // occupiedCount is used by the UI to show "X held" and "X cards snatched"
  const totalOccupiedList = Array.from(new Set([...occupied, ...fakeOccupied]));
  const occupiedCount = totalOccupiedList.filter(id => !ownedCardIds.includes(id)).length;

  // Real prize pool = displayed players × stake × 75%
  // Align calculations perfectly with player count displayed in the UI:
  // e.g. 34 visible players * 10 stake = 340 ETB pool, keeping company commission 25% (85 ETB) and prize pool 75% (255 ETB)
  const baseCards = displayPlayerCount || 1;
  const allCards = Math.max(game?.tickets?.length || 0, baseCards) || 1;
  const totalStake = allCards * stake;
  // 25% company commission kept; 75% goes to winner as prize pool
  const companyComm = Math.round(totalStake * 0.25);
  const houseComm = companyComm; // alias for any existing references
  const prize = Math.max(
    game?.totalPrize && Number(game.totalPrize) > 0 ? Number(game.totalPrize) : 0,
    Math.round(totalStake * 0.75)
  );

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isLive = countdown !== null && countdown > 0;
  const urgencyColor = countdown !== null && countdown <= 10 ? '#E74C3C' : T.gold;

  return (
    <div className={`selection-container ${isVip ? 'vip-theme' : 'brown'} ${isSpin ? 'spin-theme' : ''}`}>

      {/* ── Header ── */}
      <div className="selection-header-top">
        <button className="btn-back" onClick={() => router.push('/')}>
          <ChevronLeft size={20} color={isVip ? '#C471ED' : '#4B3621'} />
        </button>
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
          <motion.div
            key={prize}
            initial={{ opacity: 0.6, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
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
          </motion.div>
          {/* Commission breakdown — transparent for players */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '5px',
          }}>
            <div style={{
              fontSize: '9px',
              fontWeight: '700',
              color: 'rgba(255,255,255,0.45)',
              letterSpacing: '0.5px',
            }}>
              Pool: {totalStake.toFixed(0)} ETB
            </div>
            <div style={{ width: '1px', height: '10px', background: 'rgba(255,255,255,0.2)' }} />
            <div style={{
              fontSize: '9px',
              fontWeight: '700',
              color: 'rgba(255,165,0,0.7)',
              letterSpacing: '0.5px',
            }}>
              House: {companyComm.toFixed(0)} ETB (25%)
            </div>
          </div>
        </div>

        {/* Right — Countdown / Player Count */}
        <div style={{ textAlign: 'right', minWidth: '90px' }}>
          {isGameRunning ? (
            <>
              <div style={{ color: '#FF7675', fontSize: '10px', fontWeight: '900', letterSpacing: '0.5px', marginBottom: '6px', textTransform: 'uppercase', animation: 'liveDot 1.5s infinite' }}>
                🔴 LIVE GAME
              </div>
              <div style={{
                fontSize: '14px',
                fontWeight: '900',
                color: '#FF7675',
                textShadow: `0 0 12px rgba(255,118,117,0.6)`,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.5px'
              }}>
                IN PROGRESS
              </div>
            </>
          ) : isLive ? (
            <>
              <div style={{
                color: 'rgba(255,255,255,0.55)',
                fontSize: '9px',
                fontWeight: '900',
                letterSpacing: '1.5px',
                marginBottom: '6px',
                textTransform: 'uppercase',
              }}>
                GAME STARTING IN
              </div>
              <div
                style={{
                  color: countdown! <= 10 ? '#E74C3C' : 'white',
                  fontSize: '24px',
                  fontWeight: '900',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.5px',
                  textShadow: countdown! <= 10 ? '0 0 15px rgba(231,76,60,0.8)' : `0 0 12px ${T.gold}44`,
                }}
              >
                {formatCountdown(countdown!)}
              </div>
            </>
          ) : game?.status === 'WAITING' ? (
            <>
              <div style={{
                color: 'rgba(255,255,255,0.55)',
                fontSize: '9px',
                fontWeight: '900',
                letterSpacing: '1.5px',
                marginBottom: '6px',
                textTransform: 'uppercase',
              }}>
                NEXT GAME IN
              </div>
              <div style={{
                color: waitingCountdown <= 10 ? '#E74C3C' : T.gold,
                fontSize: '28px',
                fontWeight: '900',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-1px',
                textShadow: waitingCountdown <= 10
                  ? '0 0 18px rgba(231,76,60,0.9)'
                  : `0 0 14px ${T.gold}66`,
                transition: 'color 0.3s, text-shadow 0.3s',
              }}>
                {String(Math.floor(waitingCountdown / 60)).padStart(2, '0')}:{String(waitingCountdown % 60).padStart(2, '0')}
              </div>
            </>
          ) : (
            <>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '9px', fontWeight: '900', letterSpacing: '1.5px', marginBottom: '6px', textTransform: 'uppercase' }}>
                GAME STATUS
              </div>
              <div style={{
                fontSize: '18px',
                fontWeight: '900',
                color: game?.status === 'RUNNING' ? '#2ECC71' : T.gold,
                textShadow: game?.status === 'RUNNING' ? '0 0 12px rgba(46,204,113,0.6)' : `0 0 12px ${T.gold}66`,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-1px'
              }}>
                {game?.status === 'RUNNING' ? '🔴 LIVE' : '✅ READY'}
              </div>
            </>
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

      {/* ── Card Grid ── */}
      <div className="grid-brown" style={{ position: 'relative' }}>
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

        {/* ── GAME ONGOING MASK: overlays entire grid when a RUNNING game is detected ── */}
        <AnimatePresence>
          {isGameRunning && (
            <motion.div
              key="ongoing-mask"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(10, 5, 2, 0.88)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '14px',
                zIndex: 20,
                textAlign: 'center',
                padding: '24px 20px',
              }}
            >
              {/* Pulsing live dot */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '12px', height: '12px', borderRadius: '50%',
                  background: '#E74C3C',
                  boxShadow: '0 0 0 0 rgba(231,76,60,0.7)',
                  animation: 'livePulse 1.4s infinite',
                }} />
                <span style={{ color: '#FF6B6B', fontSize: '11px', fontWeight: '900', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  LIVE GAME IN PROGRESS
                </span>
              </div>

              {/* Bingo balls animation */}
              <div style={{ fontSize: '36px', animation: 'bounceBalls 1.6s infinite ease-in-out' }}>🎱</div>

              <div style={{ color: 'white', fontSize: '18px', fontWeight: '900', lineHeight: 1.3 }}>
                Game Is Ongoing
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: '700', lineHeight: 1.5, maxWidth: '240px' }}>
                Bingo balls are being called right now.
                <br />
                <span style={{ color: '#F39C12', fontWeight: '900' }}>Wait for the next game</span> — your selected cartelas are reserved!
              </div>

              {ownedCardIds.length > 0 && (
                <div style={{
                  background: 'rgba(212,175,55,0.15)',
                  border: '1.5px solid rgba(212,175,55,0.4)',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  color: '#F1C40F',
                  fontSize: '11px',
                  fontWeight: '900',
                  letterSpacing: '0.5px',
                }}>
                  ✅ {ownedCardIds.length} cartela{ownedCardIds.length > 1 ? 's' : ''} reserved for next round
                </div>
              )}

              <motion.div
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: '700', letterSpacing: '1px' }}
              >
                This page will unlock automatically when the game ends
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── WAITING FOR PLAYERS BANNER: shown when countdown hits 00:00 ── */}
        <AnimatePresence>
          {gameStartedMask && !isGameRunning && (
            <motion.div
              key="waiting-mask"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                background: 'rgba(10, 5, 2, 0.92)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                borderRadius: '12px 12px 0 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                zIndex: 20,
                textAlign: 'center',
                padding: '20px 24px',
              }}
            >
              <div style={{ fontSize: '36px' }}>⏳</div>
              <div style={{ color: '#F1C40F', fontSize: '18px', fontWeight: '900', letterSpacing: '1px' }}>Waiting for Players</div>
              <motion.div
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: '700' }}
              >
                Please wait for the next game to begin...
              </motion.div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', marginTop: '2px' }}>
                ↓ You can still select your cartelas below ↓
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{ height: '250px' }} />

      {/* ── Footer ── */}
      <div className="selection-footer-smart">
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
          <button
            className={`btn-start-game ${selected.length > 0 ? 'active' : ''}`}
            disabled={selected.length === 0 || joining}
            onClick={handleStart}
            style={isGameRunning ? { background: '#E74C3C', borderBottomColor: '#C0392B', opacity: 0.9 } : undefined}
          >
            <Play size={16} fill="white" /> {(() => {
              const isSelectionChanged = selected.length !== ownedCardIds.length || selected.some(id => !ownedCardIds.includes(id));
              if (joining) return 'CONFIRMING...';
              if (isGameRunning) {
                if (!isSelectionChanged && ownedCardIds.length > 0) return 'NEXT ROUND';
                return 'RESERVE FOR NEXT ROUND';
              }
              if (isSelectionChanged) return ownedCardIds.length > 0 ? 'CONFIRM SELECTION' : 'START GAME';
              return ownedCardIds.length > 0 ? 'ENTER GAME ROOM' : 'START GAME';
            })()}
          </button>
        </div>
      </div>

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
