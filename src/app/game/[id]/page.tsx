'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Trophy, RefreshCw, LogOut, Star, Zap, Users, Clock, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getGame, getMyCard, claimBingo } from '../../../lib/api';
import { PREDEFINED_CARDS } from '../../../lib/predefinedCards';
import { useSocket } from '../../../context/SocketContext';
import { initTelegram } from '../../../lib/telegram';
import api from '../../../lib/api';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomType = searchParams.get('type') || 'STANDARD';
  const stake = parseFloat(searchParams.get('price') || '20');
  const gameId = params.id as string;

  const [mounted, setMounted] = useState(false);
  const [game, setGame] = useState<any>(null);
  const [myCard, setMyCard] = useState<number[][] | null>(null);
  const [cardId, setCardId] = useState<number | null>(null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [drawnSequence, setDrawnSequence] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [currentCall, setCurrentCall] = useState<number | null>(null);
  const [playerCount, setPlayerCount] = useState<number>(0);
  const [totalPrize, setTotalPrize] = useState<number>(0);
  const [gameStatus, setGameStatus] = useState<string>('WAITING');
  const [serverOff, setServerOff] = useState<number>(0);
  const [claimingBingo, setClaimingBingo] = useState<boolean>(false);
  const [bingoResult, setBingoResult] = useState<any>(null);
  const [winners, setWinners] = useState<any[]>([]);
  const [showWinnerModal, setShowWinnerModal] = useState<boolean>(false);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [showNewNumber, setShowNewNumber] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [totalStake, setTotalStake] = useState<number>(0);
  const [hasClaimed, setHasClaimed] = useState<boolean>(false);
  const [canClaim, setCanClaim] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { socket, isConnected } = useSocket();
  const gameIdRef = useRef(gameId);
  // Guard: only emit join-game once per socket connection to avoid duplicate syncs
  const joinedGameRef = useRef<string | null>(null);

  useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);

  // Initialize
  useEffect(() => {
    setMounted(true);
    initTelegram();
    
    // Initial load (marks isLoading=false when done)
    loadGameData(true);
    
    // Poll for game state every 5s as fallback
    const pollInterval = setInterval(() => {
      loadGameData();
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [gameId]);

  const loadGameData = async (initial = false) => {
    try {
      const [gameData, cardData] = await Promise.all([
        getGame(gameId).catch(() => null),
        getMyCard(gameId).catch(() => null)
      ]);

      if (!gameData && initial) {
        setLoadError('Could not load the game. Please go back and try again.');
        setIsLoading(false);
        return;
      }

      if (gameData) {
        setGame(gameData);
        setGameStatus(gameData.status);
        setPlayerCount(gameData.tickets?.length || 0);
        setTotalPrize(Number(gameData.totalPrize) || 0);
        setTotalStake(gameData.tickets?.length * stake || 0);
        
        // Server time sync
        if (gameData.serverTime) {
          setServerOff(gameData.serverTime - Date.now());
        }

        // Handle countdown
        if (gameData.status === 'COUNTDOWN' && gameData.endTime && gameData.serverTime) {
          const offset = gameData.serverTime - Date.now();
          setEndTime(gameData.endTime);
          const remaining = Math.max(0, Math.ceil((gameData.endTime - Date.now() - offset) / 1000));
          if (remaining > 0) setCountdown(remaining);
        }

        // Handle already-called numbers from draw history
        if (gameData.drawHistory && gameData.drawHistory.length > 0) {
          const numbers = gameData.drawHistory.map((d: any) => d.number);
          const sequences = gameData.drawHistory.map((d: any) => d.sequence);
          setCalledNumbers(prev => {
            const merged = new Set([...prev, ...numbers]);
            return Array.from(merged);
          });
          if (numbers.length > 0) {
            setCurrentCall(numbers[numbers.length - 1]);
            setDrawnSequence(Math.max(...sequences));
          }
        }
      }

      // Set player's card
      if (cardData) {
        if (cardData.card) {
          setMyCard(cardData.card.rows || cardData.card);
          setCardId(cardData.card.id);
        } else if (cardData.cards && cardData.cards.length > 0) {
          // Handle array of cards (multiple tickets)
          const firstCard = cardData.cards[0];
          setMyCard(firstCard.rows || firstCard);
          setCardId(firstCard.id);
        }
      }

      if (initial) setIsLoading(false);
    } catch (err) {
      console.error('Failed to load game data:', err);
      if (initial) {
        setLoadError('Connection error. Please go back and try again.');
        setIsLoading(false);
      }
    }
  };

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    // Guard: only emit join-game once per socket connection per game.
    // Without this, the effect re-runs on every render (socket ref change, gameId),
    // causing the server to send multiple mid-countdown syncs per second.
    const joinKey = `${socket.id}:${gameId}`;
    if (joinedGameRef.current !== joinKey) {
      joinedGameRef.current = joinKey;
      socket.emit('join-game', gameId);
    }

    // Countdown events
    socket.on('countdown-start', (data: any) => {
      if (data.serverTime) {
        setServerOff(data.serverTime - Date.now());
      }
      if (data.endTime) {
        setEndTime(data.endTime);
        const remaining = Math.max(0, Math.ceil((data.endTime - Date.now() - (data.serverTime - Date.now())) / 1000));
        if (remaining > 0) setCountdown(remaining);
        setGameStatus('COUNTDOWN');
      } else if (data.seconds) {
        setCountdown(data.seconds);
        setGameStatus('COUNTDOWN');
      }
    });

    socket.on('countdown-tick', (data: any) => {
      if (data.endTime && data.serverTime) {
        const offset = data.serverTime - Date.now();
        setEndTime(data.endTime);
        const remaining = Math.max(0, Math.ceil((data.endTime - Date.now() - offset) / 1000));
        setCountdown(remaining > 0 ? remaining : null);
      } else if (typeof data.secondsRemaining === 'number') {
        setCountdown(data.secondsRemaining);
      }
      if (typeof data.playerCount === 'number') {
        setPlayerCount(data.playerCount);
      }
    });

    socket.on('game-started', (data: any) => {
      setGameStatus('RUNNING');
      setCountdown(null);
      setEndTime(null);
      setCalledNumbers([]);
      setDrawnSequence(0);
      setCurrentCall(null);
      setBingoResult(null);
      setHasClaimed(false);
      setCanClaim(false);
      setWinners([]);
      setShowWinnerModal(false);
      if (data.playerCount) setPlayerCount(data.playerCount);
      if (data.prizePool) setTotalPrize(Number(data.prizePool));
    });

    // Number drawn event
    socket.on('number-drawn', (data: any) => {
      setCalledNumbers(prev => [...prev, data.number]);
      setDrawnSequence(data.sequence);
      setCurrentCall(data.number);
      setLastCalledNumber(data.number);
      setShowNewNumber(true);
      setTimeout(() => setShowNewNumber(false), 2000);
      
      // Check if player can claim after new number
      if (calledNumbers.length >= 4) {
        checkCanClaim([...calledNumbers, data.number]);
      }
    });

    // Winner announced
    socket.on('winner-announced', (data: any) => {
      setWinners(prev => [...prev, data]);
      setShowWinnerModal(true);
    });

    // Game finished
    socket.on('game-finished', (data: any) => {
      setGameStatus('FINISHED');
      setCountdown(null);
      setEndTime(null);
      
      // Load final game data
      setTimeout(() => loadGameData(), 1000);
      
      // Auto-close winner modal after 15s
      if (data.winners && data.winners.length > 0) {
        setWinners(data.winners);
        setShowWinnerModal(true);
      }
    });

    // Prize received
    socket.on('prize-received', (data: any) => {
      setBingoResult({ won: true, prize: data.amount, mode: data.mode });
    });

    return () => {
      socket.off('countdown-start');
      socket.off('countdown-tick');
      socket.off('game-started');
      socket.off('number-drawn');
      socket.off('winner-announced');
      socket.off('game-finished');
      socket.off('prize-received');
      socket.emit('leave-game', gameId);
    };
  }, [socket, gameId]);

  // Local countdown ticker
  useEffect(() => {
    if (endTime === null || gameStatus === 'RUNNING') return;

    const timer = setInterval(() => {
      const now = Date.now() + serverOff;
      const rem = Math.max(0, Math.ceil((endTime - now) / 1000));
      setCountdown(rem > 0 ? rem : null);
    }, 100);

    return () => clearInterval(timer);
  }, [endTime, serverOff, gameStatus]);

  // Check if player can claim BINGO
  const checkCanClaim = (numbers: number[]) => {
    if (!myCard || hasClaimed) return;

    const rows = myCard;
    const called = numbers;

    // Check each win mode
    const winModes = ['ROW', 'COLUMN', 'DIAGONAL', 'FOUR_CORNERS', 'FULL_HOUSE'];

    for (const mode of winModes) {
      if (checkWinMode(rows, called, mode)) {
        setCanClaim(true);
        return;
      }
    }
    setCanClaim(false);
  };

  const checkWinMode = (rows: number[][], called: number[], mode: string): boolean => {
    const calledSet = new Set(called);

    switch (mode) {
      case 'ROW':
        return rows.some(row => row.every(cell => cell === 0 || calledSet.has(cell)));
      case 'COLUMN':
        for (let col = 0; col < 5; col++) {
          const colValues = rows.map(row => row[col]);
          if (colValues.every(cell => cell === 0 || calledSet.has(cell))) return true;
        }
        return false;
      case 'DIAGONAL':
        const diag1 = rows.map((row, i) => row[i]).every(cell => cell === 0 || calledSet.has(cell));
        const diag2 = rows.map((row, i) => row[4 - i]).every(cell => cell === 0 || calledSet.has(cell));
        return diag1 || diag2;
      case 'FOUR_CORNERS':
        return calledSet.has(rows[0][0]) && calledSet.has(rows[0][4]) &&
               calledSet.has(rows[4][0]) && calledSet.has(rows[4][4]);
      case 'FULL_HOUSE':
        return rows.every(row => row.every(cell => cell === 0 || calledSet.has(cell)));
      default:
        return false;
    }
  };

  // Handle BINGO claim
  const handleBingo = async () => {
    if (claimingBingo || hasClaimed || !canClaim) return;
    
    setClaimingBingo(true);
    setErrorMsg(null);

    try {
      const result = await claimBingo(gameId);
      
      if (result.won) {
        setBingoResult(result);
        setHasClaimed(true);
      } else {
        setErrorMsg('No winning pattern detected. Keep playing!');
        setTimeout(() => setErrorMsg(null), 3000);
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to claim bingo';
      setErrorMsg(errMsg);
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setClaimingBingo(false);
    }
  };

  // Handle leave game
  const handleLeave = async () => {
    try {
      await api.post(`/games/${gameId}/leave`);
    } catch (e) {
      console.error('Failed to leave game', e);
    }
    router.push('/');
  };

  // Show loading spinner while initial data is being fetched
  if (!mounted || isLoading) {
    return (
      <div style={{
        background: '#1C1208',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        fontFamily: "'Outfit', sans-serif",
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: '4px solid rgba(212,175,55,0.2)',
          borderTopColor: '#D4AF37',
          animation: 'spin 0.9s linear infinite',
        }} />
        <div style={{ color: '#D4AF37', fontSize: '14px', fontWeight: '700', opacity: 0.8 }}>
          Loading game…
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Show error state if game failed to load
  if (loadError) {
    return (
      <div style={{
        background: '#1C1208',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '20px',
        fontFamily: "'Outfit', sans-serif",
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '40px' }}>⚠️</div>
        <div style={{ color: '#F5E6BE', fontSize: '16px', fontWeight: '700' }}>Game Not Found</div>
        <div style={{ color: 'rgba(245,230,190,0.6)', fontSize: '13px', maxWidth: '280px', lineHeight: 1.5 }}>
          {loadError}
        </div>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'linear-gradient(135deg, #D4AF37, #B8860B)',
            color: '#1C1208',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 28px',
            fontSize: '14px',
            fontWeight: '900',
            cursor: 'pointer',
            marginTop: '8px',
          }}
        >
          ← Back to Lobby
        </button>
      </div>
    );
  }

  // Bingo columns for calling board
  const bingoColumns = {
    B: Array.from({ length: 15 }, (_, i) => i + 1),
    I: Array.from({ length: 15 }, (_, i) => i + 16),
    N: Array.from({ length: 15 }, (_, i) => i + 31),
    G: Array.from({ length: 15 }, (_, i) => i + 46),
    O: Array.from({ length: 15 }, (_, i) => i + 61),
  };

  // Get column letter for a number
  const getColumn = (num: number): string => {
    if (num <= 15) return 'B';
    if (num <= 30) return 'I';
    if (num <= 45) return 'N';
    if (num <= 60) return 'G';
    return 'O';
  };

  // Calculate prize breakdown
  const houseEdge = Math.round(totalStake * 0.30);
  const companyComm = Math.round(totalStake * 0.20);
  const prizePool = Math.max(totalPrize, Math.round(totalStake * 0.70));

  // Status colors
  const getStatusColor = () => {
    switch (gameStatus) {
      case 'WAITING': return '#4CAF50';
      case 'COUNTDOWN': return countdown !== null && countdown <= 5 ? '#E74C3C' : '#FFA500';
      case 'RUNNING': return '#E74C3C';
      case 'FINISHED': return '#9E9E9E';
      default: return '#9E9E9E';
    }
  };

  const getStatusText = () => {
    switch (gameStatus) {
      case 'WAITING': return 'WAITING';
      case 'COUNTDOWN': return countdown !== null ? `STARTING ${countdown}s` : 'COUNTDOWN';
      case 'RUNNING': return 'LIVE';
      case 'FINISHED': return 'FINISHED';
      default: return gameStatus;
    }
  };

  return (
    <div style={{ 
      background: '#1C1208', 
      minHeight: '100vh', 
      color: '#F5E6BE',
      fontFamily: "'Outfit', sans-serif",
      padding: '10px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '10px'
      }}>
        <button 
          onClick={() => router.push('/')}
          style={{
            background: 'rgba(212,175,55,0.1)',
            border: '1px solid rgba(212,175,55,0.3)',
            borderRadius: '10px',
            padding: '8px 12px',
            color: '#D4AF37',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            fontWeight: '900'
          }}
        >
          ← Back
        </button>
        <div style={{ 
          fontSize: '18px', 
          fontWeight: '900', 
          color: '#D4AF37',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Trophy size={20} color="#D4AF37" /> BUNA BINGO
        </div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
          #{cardId || '---'}
        </div>
      </div>

      {/* Top Info Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '6px',
        marginBottom: '10px'
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '10px',
          padding: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', fontWeight: '700' }}>ROOM</div>
          <div style={{ fontSize: '14px', fontWeight: '900', color: '#D4AF37' }}>{roomType}</div>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '10px',
          padding: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', fontWeight: '700' }}>DERASH</div>
          <div style={{ fontSize: '14px', fontWeight: '900', color: '#D4AF37' }}>{calledNumbers.length}</div>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '10px',
          padding: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', fontWeight: '700' }}>PLAYERS</div>
          <div style={{ fontSize: '14px', fontWeight: '900', color: '#D4AF37' }}>{playerCount}</div>
        </div>
      </div>

      {/* Prize & Status Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #2D1F0A 0%, #3D2B1F 100%)',
        border: `2px solid ${getStatusColor()}`,
        borderRadius: '12px',
        padding: '10px',
        marginBottom: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', fontWeight: '700', marginBottom: '4px' }}>PRIZE POOL</div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#D4AF37' }}>{prizePool.toFixed(0)} ETB</div>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>
            Stake: {totalStake.toFixed(0)} | House: {houseEdge.toFixed(0)} (30%)
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ 
            fontSize: '12px', 
            fontWeight: '900', 
            color: getStatusColor(),
            textShadow: `0 0 10px ${getStatusColor()}66`
          }}>
            {getStatusText()}
          </div>
          {countdown !== null && gameStatus === 'COUNTDOWN' && (
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
              Starting in {countdown}s
            </div>
          )}
        </div>
      </div>

      {/* Main Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '10px'
      }}>
        {/* Calling Board */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '12px',
          padding: '10px',
          border: '1px solid rgba(212,175,55,0.2)'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '3px',
            marginBottom: '10px'
          }}>
            {['B', 'I', 'N', 'G', 'O'].map(col => (
              <div key={col} style={{
                background: col === 'N' ? '#D4AF37' : '#3D2B1F',
                color: col === 'N' ? '#1C1208' : '#D4AF37',
                textAlign: 'center',
                padding: '6px',
                borderRadius: '6px',
                fontWeight: '900',
                fontSize: '14px'
              }}>
                {col}
              </div>
            ))}
          </div>
          
          {/* Numbers Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '3px'
          }}>
            {Object.entries(bingoColumns).map(([col, nums]) => (
              <div key={col}>
                {nums.map(n => (
                  <div
                    key={n}
                    style={{
                      background: calledNumbers.includes(n)
                        ? col === 'N' ? '#B8860B' : '#D4AF37'
                        : 'rgba(255,255,255,0.05)',
                      color: calledNumbers.includes(n)
                        ? (col === 'N' ? '#1C1208' : '#1C1208')
                        : 'rgba(255,255,255,0.7)',
                      textAlign: 'center',
                      padding: '4px 2px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: calledNumbers.includes(n) ? '900' : '600',
                      marginBottom: '2px',
                      border: calledNumbers.includes(n) ? 'none' : '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    {n}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Current Call Display */}
        <motion.div
          key={currentCall}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            background: 'linear-gradient(135deg, #D4AF37, #B8860B)',
            borderRadius: '12px',
            padding: '15px',
            textAlign: 'center',
            marginBottom: '10px'
          }}
        >
          <div style={{ fontSize: '10px', color: 'rgba(61,43,31,0.7)', fontWeight: '700', marginBottom: '4px' }}>
            CURRENT CALL
          </div>
          <div style={{
            fontSize: '48px',
            fontWeight: '900',
            color: '#1C1208',
            lineHeight: 1
          }}>
            {currentCall || '-'}
          </div>
          {currentCall && (
            <div style={{
              fontSize: '12px',
              color: 'rgba(61,43,31,0.7)',
              fontWeight: '700',
              marginTop: '4px'
            }}>
              {getColumn(currentCall)}-{currentCall}
            </div>
          )}
        </motion.div>

        {/* Player's Card */}
        {myCard && (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '12px',
            padding: '10px',
            border: '1px solid rgba(212,175,55,0.2)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: '900', color: '#D4AF37' }}>
                YOUR CARD #{cardId}
              </div>
              <div style={{
                background: '#27AE60',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '10px',
                fontWeight: '900'
              }}>
                {stake} ETB
              </div>
            </div>

            {/* Card Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '3px',
              marginBottom: '3px'
            }}>
              {['B', 'I', 'N', 'G', 'O'].map(col => (
                <div key={col} style={{
                  background: col === 'N' ? 'rgba(212,175,55,0.3)' : 'rgba(212,175,55,0.1)',
                  color: '#D4AF37',
                  textAlign: 'center',
                  padding: '4px',
                  borderRadius: '4px',
                  fontWeight: '900',
                  fontSize: '11px'
                }}>
                  {col}
                </div>
              ))}
            </div>

            {/* Card Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '3px'
            }}>
              {myCard.map((row, ri) => (
                row.map((cell, ci) => {
                  const isCalled = cell !== 0 && calledNumbers.includes(cell);
                  return (
                    <div
                      key={`${ri}-${ci}`}
                      style={{
                        background: isCalled ? '#27AE60' : 'rgba(255,255,255,0.05)',
                        color: isCalled ? 'white' : (cell === 0 ? '#D4AF37' : '#F5E6BE'),
                        textAlign: 'center',
                        padding: '8px 4px',
                        borderRadius: '4px',
                        fontWeight: '900',
                        fontSize: '12px',
                        border: isCalled ? 'none' : (cell === 0 ? '1px solid rgba(212,175,55,0.3)' : '1px solid rgba(255,255,255,0.1)'),
                        minHeight: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {cell === 0 ? (
                        <Star size={14} color="#D4AF37" fill="#D4AF37" />
                      ) : (
                        cell
                      )}
                    </div>
                  );
                })
              ))}
            </div>
          </div>
        )}

        {/* Progress Indicator */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '8px',
          padding: '8px',
          marginBottom: '10px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '10px',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '4px'
          }}>
            <span>Numbers Called: {calledNumbers.length}/75</span>
            <span>{Math.round((calledNumbers.length / 75) * 100)}%</span>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '4px',
            height: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#D4AF37',
              width: `${(calledNumbers.length / 75) * 100}%`,
              height: '100%',
              transition: 'width 0.3s'
            }} />
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div style={{
        position: 'fixed',
        bottom: '10px',
        left: '10px',
        right: '10px',
        display: 'flex',
        gap: '8px'
      }}>
        <button
          onClick={handleBingo}
          disabled={!canClaim || claimingBingo || hasClaimed || gameStatus !== 'RUNNING'}
          style={{
            flex: 1,
            background: canClaim && gameStatus === 'RUNNING' 
              ? 'linear-gradient(135deg, #27AE60, #1E8449)' 
              : '#555',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '14px',
            fontSize: '16px',
            fontWeight: '900',
            cursor: canClaim && gameStatus === 'RUNNING' ? 'pointer' : 'not-allowed',
            boxShadow: canClaim && gameStatus === 'RUNNING' ? '0 4px 0 #1E8449' : 'none',
            opacity: claimingBingo ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Trophy size={18} /> 
          {claimingBingo ? 'CLAIMING...' : hasClaimed ? 'CLAIMED ✓' : canClaim ? 'BINGO!' : 'WAITING...'}
        </button>
        
        <button
          onClick={handleLeave}
          style={{
            background: 'rgba(231,76,60,0.2)',
            color: '#E74C3C',
            border: '1px solid #E74C3C',
            borderRadius: '12px',
            padding: '14px 16px',
            fontSize: '12px',
            fontWeight: '900',
            cursor: 'pointer'
          }}
        >
          <LogOut size={16} />
        </button>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: 'fixed',
              bottom: '80px',
              left: '10px',
              right: '10px',
              background: '#E74C3C',
              color: 'white',
              padding: '10px 15px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: '700',
              textAlign: 'center'
            }}
          >
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Winner Modal */}
      <AnimatePresence>
        {showWinnerModal && winners.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px'
            }}
            onClick={() => setShowWinnerModal(false)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              style={{
                background: 'linear-gradient(135deg, #1C1208 0%, #3D2B1F 100%)',
                border: '2px solid #D4AF37',
                borderRadius: '16px',
                padding: '20px',
                maxWidth: '350px',
                width: '100%',
                textAlign: 'center'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>🎉</div>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#D4AF37', marginBottom: '10px' }}>
                GAME FINISHED!
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '5px' }}>
                  TOTAL PRIZE
                </div>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#27AE60' }}>
                  {prizePool.toFixed(0)} ETB
                </div>
              </div>

              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
                WINNERS ({winners.length})
              </div>

              <div style={{ maxHeight: '200px', overflow: 'auto', marginBottom: '15px' }}>
                {winners.map((winner, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    padding: '8px',
                    marginBottom: '4px',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: '12px', color: 'white' }}>
                      {winner.userId === 'house' ? '🤖 House Bot' : `Player ${i + 1}`}
                    </span>
                    <span style={{ fontSize: '12px', color: '#D4AF37', fontWeight: '900' }}>
                      {winner.prizeAmount?.toFixed(0) || winner.prize?.toFixed(0) || '?'} ETB
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  setShowWinnerModal(false);
                  router.push('/');
                }}
                style={{
                  background: '#D4AF37',
                  color: '#1C1208',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: '900',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                BACK TO LOBBY
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BINGO Result Toast */}
      <AnimatePresence>
        {bingoResult?.won && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            style={{
              position: 'fixed',
              top: '20px',
              left: '10px',
              right: '10px',
              background: 'linear-gradient(135deg, #27AE60, #1E8449)',
              color: 'white',
              padding: '15px',
              borderRadius: '12px',
              textAlign: 'center',
              zIndex: 1000,
              boxShadow: '0 8px 32px rgba(39,174,96,0.4)'
            }}
          >
            <div style={{ fontSize: '24px', marginBottom: '4px' }}>🎊 BINGO! 🎊</div>
            <div style={{ fontSize: '14px' }}>
              You won <strong>{bingoResult.prize?.toFixed(0) || '?'} ETB</strong>
              {bingoResult.mode && ` (${bingoResult.mode})`}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;900&display=swap');
        body { background: #1C1208 !important; margin: 0; }
      `}</style>
    </div>
  );
}