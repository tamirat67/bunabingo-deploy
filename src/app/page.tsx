'use client';
import React, { useEffect, useState } from 'react';
import { scopedSessionStorage } from '../lib/storage';
import { api, getRooms, getWallet, getMe } from '../lib/api';
import { initTelegram, getLanguage, setLanguage } from '../lib/telegram';
import t from '../lib/i18n';
import { useRouter } from 'next/navigation';
import { Trophy, Gift, Wallet as WalletIcon, Target, Play, Dices, ShieldCheck, History, User, ChevronDown, MoreVertical, X, Coffee, Plane, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useTheme } from '../context/ThemeContext';
import JackpotSplash from '../components/JackpotSplash';
import BunaModal from '../components/BunaModal';
import WeeklyBlastModal from '../components/WeeklyBlastModal';
import WeeklyBlastFab from '../components/WeeklyBlastFab';
import LoginModal from '../components/LoginModal';
import { useSocket } from '../context/SocketContext';

export default function LobbyPage() {
  const router = useRouter();
  const { T } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  // Hydrate from cache only on client to avoid Next.js SSR mismatch
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
        const cachedUser = scopedSessionStorage.getItem('lobby_user');
        if (cachedUser) {
          try { 
             const parsed = JSON.parse(cachedUser);
             setUser(parsed);
             if (parsed.wallet) setWallet(parsed.wallet);
          } catch (e) {}
        }
        const cachedRooms = scopedSessionStorage.getItem('lobby_rooms');
        if (cachedRooms) {
          try { setRooms(JSON.parse(cachedRooms)); } catch(e){}
        }
    }
  }, []);
  const [activeGame, setActiveGame] = useState<any>(null);
  const [langToggle, setLangToggle] = useState(0);

  useEffect(() => {
    const handleLangChange = () => setLangToggle(prev => prev + 1);
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);
  const [showJackpot, setShowJackpot] = useState(false);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const { socket } = useSocket();

  // ── Weekly Blast ───────────────────────────────────────────────
  const [weeklyBlastStatus, setWeeklyBlastStatus] = useState<{active: boolean, hasParticipated: boolean} | null>(null);
  const [showWeeklyBlast, setShowWeeklyBlast] = useState(false);

  useEffect(() => {
    api.get('/weekly-blast/current')
      .then(res => res.data)
      .then(data => {
        if (!data.error) {
          setWeeklyBlastStatus(data);
          if (data.active && !data.hasParticipated) {
            setShowWeeklyBlast(true);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    initTelegram();
    refreshData();
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Real-time Updates
  useEffect(() => {
    if (!socket) return;

    socket.on('balance-updated', (data: { newBalance: string }) => {
      setWallet((prev: any) => ({
        ...prev,
        balance: parseFloat(data.newBalance)
      }));
    });

    socket.on('bonus-updated', (data: { bonusBalance: string }) => {
      setUser((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          wallet: { ...prev.wallet, bonusBalance: parseFloat(data.bonusBalance) }
        };
      });
    });

    socket.on('deposit-approved', (data: { amount: string, bonus: string }) => {
      setModalConfig({
        isOpen: true,
        title: t('depositConfirmedTitle'),
        message: (t('depositConfirmedMsg') as (a: string, b: string) => string)(data.amount, data.bonus),
        type: 'success' as any
      });
    });

    socket.on('jackpot-updated', (data: { amount: string, target: string }) => {
      setUser((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          jackpot: {
            ...prev.jackpot,
            amount: data.amount,
            target: data.target
          }
        };
      });
    });

    return () => {
      socket.off('balance-updated');
      socket.off('bonus-updated');
      socket.off('deposit-approved');
      socket.off('jackpot-updated');
    };
  }, [socket]);

  const refreshData = async () => {
    try {
      // Fetch both player info and room info in parallel for maximum loading speed
      const [me, roomsData] = await Promise.all([
        getMe().catch(() => null),
        getRooms().catch(() => [])
      ]);

      if (me) {
        setUser(me);
        setWallet(me.wallet); // me already includes wallet
        scopedSessionStorage.setItem('lobby_user', JSON.stringify(me));
        
        // Show jackpot splash if not seen
        if (!me.hasSeenJackpot) {
          setShowJackpot(true);
        }

        if (me.tickets && me.tickets.length > 0) {
           const latestTicket = me.tickets[0];
           if (latestTicket.game.status !== 'FINISHED' && latestTicket.game.status !== 'CANCELLED') {
              setActiveGame(latestTicket.game);
           } else {
              setActiveGame(latestTicket.game.status === 'FINISHED' ? null : activeGame);
           }
        }
      }

      if (roomsData && roomsData.length > 0) {
        setRooms(roomsData);
        scopedSessionStorage.setItem('lobby_rooms', JSON.stringify(roomsData));
      }
    } catch (e) {
      console.warn('Error refreshing lobby data:', e);
    }
  };

  const handleJoinRoom = (room: any) => {
    if (room.type.startsWith('SPIN_')) {
      setModalConfig({
        isOpen: true,
        title: t('comingSoon') as string,
        message: t('spinUnavailable') as string,
        type: 'info'
      });
      return;
    }
    router.push(`/tickets/select?type=${room.type}&price=${room.price}`);
  };

  const goToActiveGame = () => {
    if (!activeGame) return;
    if (activeGame.room.type.startsWith('SPIN_')) {
      router.push(`/play/spin?id=${activeGame.id}`);
    } else {
      router.push(`/game?id=${activeGame.id}&type=${activeGame.room.type}&price=${activeGame.room.ticketPrice}`);
    }
  };


  // Bot counts mirror backend houseBot.service.ts BOT_COUNTS
  const BOT_COUNTS_LOBBY: Record<string, number> = { CASUAL: 30, STANDARD: 30, PRO: 30, JACKPOT: 10, VIP: 10 };

  const bingoRooms = rooms
    .filter(r => !r.type.startsWith('SPIN_') && r.type !== 'DEMO')
    .map(r => {
      const price = Number(r.ticketPrice);
      const livePrize = Number(r.games?.[0]?.totalPrize || 0);
      const livePlayerCount = r.games?.[0]?.tickets?.length || 0;
      const botCount = r.expectedBotCount ?? 30;
      // Prize floor = (bots + live players, min 1) × price × 75% — scales with lobby activity
      const minPrize = Math.round((botCount + Math.max(1, livePlayerCount)) * price * 0.75);
      return {
        id: r.id,
        type: r.type,
        price: price || 10,
        win: Math.max(livePrize, minPrize),
        players: livePlayerCount,
        active: r.games?.filter((g: any) => g.status === 'RUNNING').length || 0,
        isBonus: ['CASUAL', 'JACKPOT'].includes(r.type),
        isVip: ['JACKPOT', 'VIP'].includes(r.type),
      };
    })
    .sort((a, b) => a.price - b.price);

  const spinRooms = rooms
    .filter(r => r.type.startsWith('SPIN_'))
    .map(r => {
      const price = Number(r.ticketPrice);
      const livePrize = Number(r.games?.[0]?.totalPrize || 0);
      return {
        id: r.id,
        type: r.type,
        price: price,
        win: Math.max(livePrize, price * 8),
        players: r.games?.[0]?.tickets?.length || 0,
        active: r.games?.filter((g: any) => g.status === 'RUNNING').length || 0,
        isBonus: r.type === 'SPIN_10' || r.type === 'SPIN_100'
      };
    })
    .sort((a, b) => a.price - b.price);

  const demoRoom = rooms.find(r => r.type === 'DEMO');

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: '90px', fontFamily: "'Outfit', sans-serif" }}>
      
      {/* ── Espresso Header ── */}
      <div style={{ background: T.header, padding: '12px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${T.gold}` }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Coffee size={24} color={T.gold} />
            <div style={{ fontSize: '20px', fontWeight: '900', color: T.gold, letterSpacing: '1px' }}>
              {mounted && getLanguage() === 'am' ? 'ቡና ጌም ዞን' : 'BUNA GAME ZONE'}
            </div>
         </div>
         <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
           {(!user && mounted) && (
             <button 
               onClick={() => setShowLogin(true)}
               style={{ 
                 background: T.gold, color: T.header, border: 'none', 
                 padding: '4px 12px', borderRadius: '6px', fontSize: '12px', 
                 fontWeight: 'bold', cursor: 'pointer' 
               }}
             >
               Log in
             </button>
           )}
           <div onClick={() => setLanguage(getLanguage() === 'en' ? 'am' : 'en')} style={{ cursor: 'pointer', display: 'flex', border: `1px solid ${T.gold}`, borderRadius: '6px', overflow: 'hidden', fontSize: '10px', fontWeight: 'bold' }}>
             <div style={{ padding: '3px 8px', background: (!mounted || getLanguage() === 'en') ? T.gold : 'transparent', color: (!mounted || getLanguage() === 'en') ? T.header : T.gold }}>EN</div>
             <div style={{ padding: '3px 8px', background: (mounted && getLanguage() === 'am') ? T.gold : 'transparent', color: (mounted && getLanguage() === 'am') ? T.header : T.gold }}>AM</div>
           </div>
         </div>
      </div>

      {/* ── Wallet & Bonus Stats ── */}
      <div style={{ background: T.header, padding: '10px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.gold}22` }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4CAF50', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}>
            <div style={{ width: '6px', height: '6px', background: '#4CAF50', borderRadius: '50%', boxShadow: '0 0 5px #4CAF50' }} />
            Live
         </div>
         <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: T.gold, fontSize: '12px', fontWeight: '900' }}>
               <Gift size={14} color={T.gold} /> BONUS: <span style={{ color: T.textL }}>{Number(user?.wallet?.bonusBalance || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4CAF50', fontSize: '12px', fontWeight: '900' }}>
               <WalletIcon size={14} color="#4CAF50" /> BALANCE: <span style={{ color: T.textL }}>{Number(wallet?.balance || 0).toFixed(2)}</span>
            </div>
         </div>
      </div>

      <div className="lobby-content" style={{ paddingTop: '15px' }}>
        
        <AnimatePresence>
          {activeGame && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              onClick={goToActiveGame}
              style={{ background: 'linear-gradient(90deg, #D4AF37, #B8860B)', color: '#3D2B1F', padding: '12px 15px', margin: '0 15px 15px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 15px rgba(212,175,55,0.4)', cursor: 'pointer', fontWeight: '900' }}
            >
               <div style={{ fontSize: '12px' }}>🎯 TOURNAMENT IN PROGRESS! TAP TO RE-JOIN</div>
               <ExternalLink size={18} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── BINGO GAMES ── */}
        <div style={{ padding: '0 15px' }}>
          <div style={{ color: T.brownLobby, fontSize: '14px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', textTransform: 'uppercase', opacity: 0.8 }}>
            <Target size={18} color={T.gold} /> BINGO GAMES
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 120px', fontSize: '10px', fontWeight: '900', color: T.brownLobby, padding: '0 10px 8px', opacity: 0.4 }}>
             <span>BET</span>
             <span style={{ textAlign: 'center' }}>WIN/PLAYER</span>
             <span style={{ textAlign: 'right' }}>STATUS & JOIN</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {bingoRooms.map((room) => (
              <React.Fragment key={room.type}>
                <div
                  onClick={() => handleJoinRoom(room)}
                  style={{
                    background: room.isVip
                      ? 'linear-gradient(135deg, #2C1A4A 0%, #3D2B1F 60%, #2C1A4A 100%)'
                      : T.cardLobby,
                    padding: '15px 10px',
                    display: 'grid',
                    gridTemplateColumns: '70px 1fr 120px',
                    alignItems: 'center',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    border: room.isVip ? '1px solid rgba(180,130,255,0.25)' : 'none',
                  }}
                >
                    <div style={{ position: 'relative' }}>
                        {room.isVip && (
                          <div style={{
                            position: 'absolute',
                            top: '-18px',
                            left: '-4px',
                            background: 'linear-gradient(90deg, #7B2FBE, #C471ED)',
                            color: 'white',
                            fontSize: '7px',
                            padding: '2px 5px',
                            borderRadius: '4px',
                            fontWeight: '900',
                            letterSpacing: '1px',
                            boxShadow: '0 2px 6px rgba(123,47,190,0.5)',
                          }}>👑 VIP</div>
                        )}
                        <div style={{ fontSize: '24px', fontWeight: '900', color: room.isVip ? '#C471ED' : T.gold, lineHeight: '1' }}>{room.price}</div>
                        <div style={{ fontSize: '9px', fontWeight: '900', color: T.textL, opacity: 0.4 }}>ETB</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        <Trophy size={20} color={room.isVip ? '#C471ED' : T.gold} />
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '20px', fontWeight: '900', color: room.isVip ? '#C471ED' : T.gold, lineHeight: '1' }}>{Number(room.win).toFixed(0)}</div>
                            <div style={{ fontSize: '9px', color: T.textL, opacity: 0.4, fontWeight: 'bold' }}>{room.players} players</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                        <div style={{ background: '#4A90E2', color: 'white', fontSize: '8px', padding: '1px 6px', borderRadius: '4px', fontWeight: '900' }}>ACTIVE {room.active}</div>
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <div style={{ border: '1px solid #4CAF50', color: '#4CAF50', fontSize: '9px', padding: '2px 6px', borderRadius: '4px', fontWeight: '900' }}>READY</div>
                            <div style={{ position: 'relative' }}>
                                <button style={{
                                  background: room.isVip ? 'linear-gradient(90deg, #7B2FBE, #C471ED)' : '#27AE60',
                                  color: 'white',
                                  border: 'none',
                                  padding: '8px 16px',
                                  borderRadius: '6px',
                                  fontWeight: '900',
                                  fontSize: '13px',
                                  boxShadow: room.isVip ? '0 3px 0 #5A1F9E' : '0 3px 0 #1E8449',
                                }}>JOIN</button>
                                {room.isBonus && !room.isVip && (
                                    <div style={{ position: 'absolute', top: '-10px', right: '-5px', background: T.gold, color: T.header, fontSize: '7px', padding: '1px 4px', borderRadius: '4px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                                        BONUS
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div style={{ background: 'rgba(61,43,31,0.05)', color: T.brownLobby, textAlign: 'center', fontSize: '8px', fontWeight: '900', padding: '2px 0', opacity: 0.5, letterSpacing: '1px' }}>
                    JACKPOT {Number(user?.jackpot?.amount || 0).toFixed(0)} / {Number(user?.jackpot?.target || 1000).toFixed(0)}
                </div>
              </React.Fragment>
            ))}
          </div>

        </div>
        </div>

        {/* ── BUNA HOT 5 (777 FRUIT SLOT) CARD ── */}
        <div style={{ padding: '0 15px', marginBottom: '12px', marginTop: '16px' }}>
          <div
            onClick={() => router.push('/play/slot')}
            style={{
              background: 'linear-gradient(135deg, #2D0505 0%, #1A0202 50%, #3B0909 100%)',
              borderRadius: '12px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              border: '1px solid rgba(255, 69, 0, 0.4)',
              boxShadow: '0 4px 20px rgba(255, 69, 0, 0.2), inset 0 0 15px rgba(255,215,0,0.05)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Fiery top border glow */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
              background: 'linear-gradient(90deg, transparent, #FF4500, #FFD700, #FF4500, transparent)',
              boxShadow: '0 0 10px #FF4500'
            }} />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Slot Machine Window Visual */}
              <div style={{
                background: 'linear-gradient(180deg, #FDFBF7 0%, #E6E1D6 100%)',
                padding: '6px 8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                boxShadow: 'inset 0 4px 8px rgba(0,0,0,0.4), 0 0 8px rgba(255,215,0,0.3)',
                border: '2px solid #D4AF37',
                position: 'relative'
              }}>
                <div style={{ position: 'absolute', top: '-2px', bottom: '-2px', left: '33%', width: '1px', background: 'rgba(0,0,0,0.1)' }} />
                <div style={{ position: 'absolute', top: '-2px', bottom: '-2px', right: '33%', width: '1px', background: 'rgba(0,0,0,0.1)' }} />
                {/* 777 Icons — mimicking the red/gold 7 requested */}
                <div style={{ fontSize: '18px', filter: 'drop-shadow(1px 1px 0px #D4AF37)', display: 'flex', gap: '4px' }}>
                  <span style={{ color: '#D32F2F', fontWeight: '900', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>7</span>
                  <span style={{ color: '#D32F2F', fontWeight: '900', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>7</span>
                  <span style={{ color: '#D32F2F', fontWeight: '900', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>7</span>
                </div>
              </div>
              
              <div>
                <div style={{ 
                  fontSize: '17px', 
                  fontWeight: '900', 
                  color: '#FFD700', 
                  lineHeight: '1.1', 
                  letterSpacing: '0.5px',
                  textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                }}>
                  MULTI HOT 5
                </div>
                <div style={{ 
                  fontSize: '10px', 
                  color: '#FFAB40', 
                  fontWeight: '700', 
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  🍒 🍋 🍉 CLASSIC SLOT
                </div>
              </div>
            </div>
            
            <div style={{
              background: 'linear-gradient(180deg, #FF9800, #F57C00)',
              color: '#FFF',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '900',
              border: '1px solid #FFE0B2',
              boxShadow: '0 4px 0 #E65100, 0 4px 10px rgba(255,152,0,0.4)',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)'
            }}>
              SPIN
            </div>
          </div>
        </div>

        {/* ── AVIATOR CARD ── */}
        <div style={{ padding: '0 15px', marginBottom: '12px', marginTop: '16px' }}>
          <div
            onClick={() => router.push('/play/aviator')}
            style={{
              background: 'linear-gradient(135deg, #1a0a2e 0%, #0d1b2a 60%, #1a0a1a 100%)',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              border: '1px solid rgba(231,76,60,0.3)',
              boxShadow: '0 4px 20px rgba(231,76,60,0.15)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
              background: 'linear-gradient(90deg, transparent, #e74c3c, transparent)',
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%',
                background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Plane size={22} color="#e74c3c" />
              </div>
              <div>
                <div style={{ fontWeight: '900', fontSize: '15px', color: '#fff', letterSpacing: '0.5px' }}>AVIATOR</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: '700' }}>Crash game — ቁማር & Cash Out!</div>
              </div>
            </div>
            <div style={{
              background: 'linear-gradient(90deg, #e74c3c, #c0392b)',
              color: '#fff', fontSize: '12px', fontWeight: '900',
              padding: '8px 16px', borderRadius: '8px',
              boxShadow: '0 3px 0 #922b21',
            }}>FLY ✈️</div>
          </div>
        </div>

        {/* ── FAST KENO CARD ── */}
        <div style={{ padding: '0 15px', marginBottom: '16px' }}>
          <div
            onClick={() => router.push('/keno')}
            style={{
              background: 'linear-gradient(135deg, #0a1f14 0%, #05100a 60%, #0c2618 100%)',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              border: '1px solid rgba(34,197,94,0.3)',
              boxShadow: '0 4px 20px rgba(34,197,94,0.15)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
              background: 'linear-gradient(90deg, transparent, #22c55e, transparent)',
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%',
                background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'inset 0 0 10px rgba(34,197,94,0.2)',
              }}>
                <Dices size={24} color="#4ade80" />
              </div>
              <div>
                <div style={{ fontWeight: '900', fontSize: '15px', color: '#fff', letterSpacing: '0.5px' }}>FAST KENO</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: '700' }}>Draw every minute — Win up to 30,000!</div>
              </div>
            </div>
            <div style={{
              background: 'linear-gradient(90deg, #22c55e, #16a34a)',
              color: '#fff', fontSize: '12px', fontWeight: '900',
              padding: '8px 16px', borderRadius: '8px',
              boxShadow: '0 3px 0 #15803d',
            }}>PLAY 🎱</div>
          </div>
        </div>

        {/* ── CHICKEN ROAD CARD ── */}
        <div style={{ padding: '0 15px', marginBottom: '16px' }}>
          <div
            onClick={() => router.push('/play/chicken-road')}
            style={{
              background: 'linear-gradient(135deg, #1a0a06 0%, #2d1200 60%, #1a0a00 100%)',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              border: '1px solid rgba(212,175,55,0.35)',
              boxShadow: '0 4px 20px rgba(212,175,55,0.12)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Gold top accent line */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
              background: 'linear-gradient(90deg, transparent, #d4af37, #ff7b00, #d4af37, transparent)',
              boxShadow: '0 0 8px rgba(212,175,55,0.6)',
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Chicken icon */}
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%',
                background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '26px',
                boxShadow: 'inset 0 0 10px rgba(212,175,55,0.1)',
              }}>
                🐔
              </div>
              <div>
                <div style={{ fontWeight: '900', fontSize: '15px', color: '#d4af37', letterSpacing: '0.5px' }}>
                  CHICKEN ROAD
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', fontWeight: '700' }}>
                  Risk & Reward — Cash out before the fire!
                </div>
              </div>
            </div>
            <div style={{
              background: 'linear-gradient(180deg, #d4af37, #a07c10)',
              color: '#1a0a06', fontSize: '12px', fontWeight: '900',
              padding: '8px 14px', borderRadius: '8px',
              boxShadow: '0 3px 0 #6b5210, 0 4px 10px rgba(212,175,55,0.35)',
            }}>RUN 🐔</div>
          </div>
        </div>

      <JackpotSplash
        show={showJackpot}
        onClose={() => setShowJackpot(false)}
        jackpotAmount={Number(user?.jackpot?.amount || 0).toFixed(2)}
      />

      {/* Weekly Blast floating widget — always visible so users can check Saturday rewards */}
      {!showWeeklyBlast && (
        <WeeklyBlastFab onClick={() => setShowWeeklyBlast(true)} />
      )}

      {/* Weekly Blast Modal */}
      {showWeeklyBlast && (
        <WeeklyBlastModal
          onClose={() => setShowWeeklyBlast(false)}
          onRewardClaimed={(amount) => {
            setWeeklyBlastStatus(prev => prev ? { ...prev, hasParticipated: true } : null);
            // ✅ FIX: update balance immediately so user sees their reward without refresh
            if (amount > 0) {
              setWallet((prev: any) => prev ? { ...prev, balance: (prev.balance || 0) + amount } : prev);
            }
          }}
        />
      )}

      <LoginModal 
        isOpen={showLogin} 
        onClose={() => setShowLogin(false)} 
        onLoginSuccess={() => window.location.reload()} 
      />

      <BunaModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        title={modalConfig.title}
        message={modalConfig.message}
      />

    </div>
  );
}
