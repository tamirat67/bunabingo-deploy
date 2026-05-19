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
  const prevOccupied = useRef<number[]>([]);
  
  // Fake Player Simulation Logic
  useEffect(() => {
    if (game?.status !== 'RUNNING' && fakePlayersCount < 200) {
      const timer = setTimeout(() => {
        const newPlayers = Math.floor(Math.random() * 3) + 1; // Adds 1 to 3 players at a time
        setFakePlayersCount(prev => Math.min(prev + newPlayers, 200));
      }, Math.random() * 1000 + 500); // Wait 0.5s to 1.5s between additions
      return () => clearTimeout(timer);
    }
  }, [fakePlayersCount, game?.status]);
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

  const loadGameData = useCallback(() => {
    if (!activeGameId) return;
    getGame(activeGameId).then(g => {
      setGame(g);
      if (g.endTime && g.serverTime) {
        const offset = g.serverTime - Date.now();
        setServerOff(offset);
        setEndTime(g.endTime);
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
      if (res.gameId) {
        setActiveGameId(res.gameId);
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

      socket.on('countdown-tick', (d: any) => {
        setCountdown(d.secondsRemaining);
      });
    }

    return () => {
      if (socket) {
        socket.off('occupied-sync');
        socket.off('countdown-start');
        socket.off('countdown-tick');
      }
    };
  }, [roomType, activeGameId, socket, loadGameData, user?.id]);

  useEffect(() => {
    setSelected(prev => prev.filter(id => !occupied.includes(id)));
  }, [occupied]);

  const toggleSelect = (num: number) => {
    // 1. If the card is owned/occupied by another player
    if (occupied.includes(num)) {
      showAlert('Card Taken', 'This card has just been purchased by another player! Please choose a free card.', 'error');
      return;
    }

    // 2. Normal select/deselect flow (freely allow changing owned cards)
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
    if (newCardsToBuy.length > 0 && balance < totalCost && roomType !== 'DEMO') {
      setModal({
        isOpen: true,
        title: 'Insufficient Balance',
        message: `You need ${totalCost} ETB to purchase ${newCardsToBuy.length} new card(s). You currently have ${Number(balance).toFixed(2)} ETB.`,
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
      if (roomType.startsWith('SPIN_')) router.push(`/play/spin?id=${res.gameId}&stake=${stake}`);
      else router.push(`/game?id=${res.gameId}&type=${roomType}&price=${stake}`);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to join';
      showAlert('Join Failed', msg, 'error');
    } finally {
      setJoining(false);
    }
  };

  const balance = user?.wallet?.balance || 0;
  const isSpin = roomType.startsWith('SPIN_');
  const isVip = roomType === 'VIP' || roomType === 'JACKPOT' || stake >= 100;
  const isDark = activeThemeKey === 'DARK' || activeThemeKey === 'GRAY';

  const displayPlayerCount = playerCount + fakePlayersCount;
  const basePrize = game?.totalPrize
    ? Number(game.totalPrize)
    : Math.max(stake * 2, (playerCount || 1) * stake * 0.8);
  const prize = basePrize + (fakePlayersCount * stake * 0.8);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isLive = countdown !== null && countdown > 0;
  const urgencyColor = countdown !== null && countdown <= 10 ? '#E74C3C' : T.gold;
  const occupiedCount = occupied.filter(id => !ownedCardIds.includes(id)).length;

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
        <div className="capsule-white"><div className="l">BONUS</div><div className="v">0</div></div>
        <div className="capsule-white"><div className="l">PLAYERS</div><div className="v">{displayPlayerCount}</div></div>
        <div className="capsule-brown total-box"><div className="l" style={{ color: 'rgba(255,255,255,0.5)' }}>STAKE</div><div className="v">{stake}</div></div>
      </div>

      {/* ── PREMIUM JACKPOT + COUNTDOWN BANNER ── */}
      <div style={{
        background: isDark
          ? 'linear-gradient(135deg, #0F0A02 0%, #1C1208 50%, #0F0A02 100%)'
          : 'linear-gradient(135deg, #1C1208 0%, #2D1F0A 60%, #1C1208 100%)',
        border: `2px solid ${urgencyColor}`,
        borderRadius: '18px',
        padding: '14px 18px',
        margin: '8px 0 10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px ${urgencyColor}22, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}>
        {/* Shimmer sweep */}
        <div className="jackpot-shimmer" />

        {/* Left — Jackpot Amount */}
        <div>
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
            marginBottom: '8px',
            letterSpacing: '1.2px',
            boxShadow: `0 2px 8px ${urgencyColor}66`,
          }}>
            <Trophy size={9} /> JACKPOT LIVE
          </div>
          <motion.div
            key={prize}
            initial={{ opacity: 0.6, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              color: 'white',
              fontSize: '30px',
              fontWeight: '900',
              lineHeight: 1,
              letterSpacing: '-0.5px',
              textShadow: `0 0 20px ${urgencyColor}66`,
            }}
          >
            {prize.toFixed(0)} ETB
          </motion.div>
        </div>

        {/* Right — Countdown / Player Count */}
        <div style={{ textAlign: 'right', minWidth: '90px' }}>
          {isLive ? (
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
              <motion.div
                key={countdown}
                initial={{ scale: 1.15, color: countdown! <= 10 ? '#E74C3C' : 'white' }}
                animate={{ scale: 1, color: countdown! <= 10 ? '#E74C3C' : 'white' }}
                transition={{ duration: 0.2 }}
                style={{
                  fontSize: '30px',
                  fontWeight: '900',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.5px',
                  textShadow: countdown! <= 10 ? '0 0 15px rgba(231,76,60,0.8)' : `0 0 12px ${T.gold}44`,
                }}
              >
                {formatCountdown(countdown!)}
              </motion.div>
            </>
          ) : (
            <>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '9px', fontWeight: '900', letterSpacing: '1.5px', marginBottom: '6px', textTransform: 'uppercase' }}>
                {game?.status === 'WAITING' ? 'PLAYERS JOINED' : 'GAME STATUS'}
              </div>
              <div style={{
                fontSize: game?.status === 'WAITING' ? '28px' : '18px',
                fontWeight: '900',
                color: game?.status === 'RUNNING' ? '#2ECC71' : T.gold,
                textShadow: game?.status === 'RUNNING' ? '0 0 12px rgba(46,204,113,0.6)' : `0 0 12px ${T.gold}66`,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-1px'
              }}>
                {game?.status === 'RUNNING' ? '🔴 LIVE' : game?.status === 'WAITING' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                    <Users size={18} /> {displayPlayerCount.toLocaleString()}
                  </span>
                ) : '✅ READY'}
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
        padding: '6px 4px',
        marginBottom: '6px',
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
            padding: '5px 10px',
            marginBottom: '8px',
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
      <div className="grid-brown">
        {Array.from({ length: isVip ? 50 : 250 }, (_, i) => i + 1).map(num => {
          const isOccupied = occupied.includes(num);
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

      <div style={{ height: '300px' }} />

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
          >
            <Play size={16} fill="white" /> {(() => {
              const isSelectionChanged = selected.length !== ownedCardIds.length || selected.some(id => !ownedCardIds.includes(id));
              if (joining) return 'CONFIRMING...';
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
