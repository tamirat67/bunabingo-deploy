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

  // ─── Poll every 2s: getOccupiedCards is the SINGLE source of truth for isGameRunning ───
  // This handles all cases: page refresh during game, missed socket events, etc.
  useEffect(() => {
    const syncRunningState = () => {
      getOccupiedCards(roomType, activeGameId).then(res => {
        setIsInitializing(false);
        if (!res) return;

        const wasRunning = isGameRunning;
        const nowRunning = !!res.isGameRunning;

        // Update isGameRunning based on authoritative server response
        if (nowRunning !== wasRunning) {
          setIsGameRunning(nowRunning);
          if (!nowRunning && wasRunning) {
            // Game just finished — release the overlay
            setLiveGameDismissed(true);
          }
          if (nowRunning && !wasRunning) {
            // Game just started — show the overlay
            setLiveGameDismissed(false);
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
      }).catch(() => {});
    };

    // Run immediately on mount / dependency change to catch refresh-during-game
    syncRunningState();

    // Then poll every 2s continuously (covers WAITING, COUNTDOWN, RUNNING states)
    const poll = setInterval(() => {
      syncRunningState();
      if (!isGameRunning) loadGameData(); // keep countdown/game data fresh when not running
    }, 2000);

    return () => clearInterval(poll);
  }, [roomType, activeGameId, isGameRunning, loadGameData, socket]);

  // Lock body scroll when game is running (overlay is active)
  useEffect(() => {
    if (isGameRunning) {
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100vh';
    } else {
      document.body.style.overflow = '';
      document.body.style.height = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.height = '';
    };
  }, [isGameRunning]);

  const toggleSelect = (num: number) => {
    if (isGameRunning || isInitializing) return;
    
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

  const handleStart = async () => {
    if (isGameRunning || isInitializing || selected.length === 0 || joining) return;
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

    // ── Hard block: do not allow purchase if game is currently RUNNING ──
    if (isGameRunning) {
      setModal({
        isOpen: true,
        title: '🔴 Game In Progress!',
        message: 'A bingo game is currently live. Cartela selling is stopped. Please wait for the game to finish — the page will unlock automatically!',
        type: 'info',
      });
      setJoining(false);
      return;
    }

    try {
      const res = await joinGame(roomType, selected);

      if (typeof window !== 'undefined' && res.gameId && res.tickets) {
        sessionStorage.setItem(`game_tickets_${res.gameId}`, JSON.stringify(res.tickets));
      }
      if (roomType.startsWith('SPIN_')) router.push(`/play/spin?id=${res.gameId}&stake=${stake}`);
      else router.push(`/game?id=${res.gameId}&type=${roomType}&price=${stake}`);
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
                GAME STATUS
              </div>
              <motion.div
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                style={{
                  color: T.gold,
                  fontSize: '18px',
                  fontWeight: '900',
                  letterSpacing: '-0.5px',
                  textShadow: `0 0 14px ${T.gold}66`,
                }}
              >
                WAITING ....
              </motion.div>
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

        {/* Ongoing mask moved to full screen top-level placement below */}
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
          <button
            className={`btn-start-game ${selected.length > 0 && !isGameRunning && !isInitializing ? 'active' : ''}`}
            disabled={selected.length === 0 || joining || isGameRunning || isInitializing}
            onClick={handleStart}
            style={(isGameRunning || isInitializing) ? { background: '#555', borderBottomColor: '#333', opacity: 0.6, cursor: 'not-allowed' } : undefined}
          >
            <Play size={16} fill="white" /> {(() => {
              if (joining) return 'CONFIRMING...';
              if (isGameRunning) return '🔴 GAME LIVE — WAIT';
              if (isInitializing) return 'LOADING...';
              const isSelectionChanged = selected.length !== ownedCardIds.length || selected.some(id => !ownedCardIds.includes(id));
              if (isSelectionChanged) return ownedCardIds.length > 0 ? 'CONFIRM SELECTION' : 'START GAME';
              return ownedCardIds.length > 0 ? 'ENTER GAME ROOM' : 'START GAME';
            })()}
          </button>
        </div>
      </div>

      {/* ── FULL SCREEN GAME ONGOING MASK ── */}
      <AnimatePresence>
        {isGameRunning && (
          <motion.div
            key="ongoing-mask-fullscreen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: isVip 
                ? 'radial-gradient(circle at top, #2D1442 0%, #1C0A35 60%, #0F041A 100%)' 
                : T.bg, // 100% solid theme-matched background (Standard: cream/coffee-dark, VIP: purple-gold)
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '20px',
              zIndex: 99999,
              textAlign: 'center',
              padding: '24px',
            }}
          >
            {/* Clock icon in circle */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Clock size={28} color={isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)"} />
            </div>

            {/* Main Amharic message */}
            <div style={{
              color: isDark ? 'white' : '#2C3E50',
              fontSize: '18px',
              fontWeight: '950',
              lineHeight: 1.4,
              letterSpacing: '0.3px',
            }}>
              ጨዋታው በመካሄድ ላይ ነው...
            </div>

            {/* Sub message */}
            <div style={{
              color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
              fontSize: '13px',
              fontWeight: '700',
              lineHeight: 1.5,
              maxWidth: '240px',
            }}>
              እባኮትን ቀጣዩ ዙር እስኪጀምር ይጠብቁ!
            </div>

            {/* English sub-line */}
            <motion.div
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
              style={{
                color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                fontSize: '11px',
                fontWeight: '700',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                marginTop: '4px',
              }}
            >
              Game Currently Live — Wait for Next Round
            </motion.div>

            {/* Lobby / Refresh buttons inside the overlay */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', width: '100%', maxWidth: '280px', justifyContent: 'center' }}>
              <button
                onClick={() => router.push('/')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  height: '42px',
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  color: isDark ? 'white' : '#2C3E50',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'}`,
                  borderRadius: '14px',
                  fontWeight: '900',
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                }}
              >
                🏠 Lobby
              </button>
              <button
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
                  borderRadius: '14px',
                  fontWeight: '900',
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(0,168,232,0.2)'
                }}
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
