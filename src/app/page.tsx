'use client';
import React, { useEffect, useState } from 'react';
import { getRooms, getWallet, getMe } from '../lib/api';
import { initTelegram } from '../lib/telegram';
import { useRouter } from 'next/navigation';
import { Trophy, Gift, Wallet as WalletIcon, Target, Play, Dices, ExternalLink, ShieldCheck, History, User, ChevronDown, MoreVertical, X, Coffee } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useTheme } from '../context/ThemeContext';
import JackpotSplash from '../components/JackpotSplash';
import BunaModal from '../components/BunaModal';
import { useSocket } from '../context/SocketContext';

export default function LobbyPage() {
  const router = useRouter();
  const { T } = useTheme();
  const [user, setUser] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('lobby_user');
      if (cached) {
        try { return JSON.parse(cached); } catch (e) {}
      }
    }
    return null;
  });
  const [wallet, setWallet] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('lobby_user');
      if (cached) {
        try { return JSON.parse(cached).wallet; } catch (e) {}
      }
    }
    return null;
  });
  const [rooms, setRooms] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('lobby_rooms');
      if (cached) {
        try { return JSON.parse(cached); } catch (e) {}
      }
    }
    return [];
  });
  const [activeGame, setActiveGame] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [showJackpot, setShowJackpot] = useState(false);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const { socket } = useSocket();

  useEffect(() => {
    setMounted(true);
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
        title: 'Deposit Confirmed!',
        message: `Your deposit of ${data.amount} ETB has been approved. We've also added a ${data.bonus} ETB bonus to your wallet!`,
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
        sessionStorage.setItem('lobby_user', JSON.stringify(me));
        
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
        sessionStorage.setItem('lobby_rooms', JSON.stringify(roomsData));
      }
    } catch (e) {
      console.warn('Error refreshing lobby data:', e);
    }
  };

  const handleJoinRoom = (room: any) => {
    if (room.type.startsWith('SPIN_')) {
      setModalConfig({
        isOpen: true,
        title: 'COMING SOON!',
        message: '☕ Buna Spin Games are currently under maintenance for upgrades. Get ready for something big!',
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

  if (!mounted) return null;

  // Bot counts mirror backend houseBot.service.ts BOT_COUNTS
  const BOT_COUNTS_LOBBY: Record<string, number> = { CASUAL: 30, STANDARD: 30, PRO: 30, JACKPOT: 10, VIP: 10 };

  const bingoRooms = rooms
    .filter(r => !r.type.startsWith('SPIN_') && r.type !== 'DEMO')
    .map(r => {
      const price = Number(r.ticketPrice);
      const livePrize = Number(r.games?.[0]?.totalPrize || 0);
      const livePlayerCount = r.games?.[0]?.tickets?.length || 0;
      const botCount = BOT_COUNTS_LOBBY[r.type] ?? 30;
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
            <div style={{ fontSize: '20px', fontWeight: '900', color: T.gold, letterSpacing: '1px' }}>BUNA GAME ZONE</div>
         </div>
         <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ChevronDown size={24} color={T.gold} />
            <MoreVertical size={24} color={T.gold} />
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
          <div style={{ color: T.header, fontSize: '14px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', textTransform: 'uppercase', opacity: 0.8 }}>
            <Target size={18} color={T.gold} /> BINGO GAMES
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 120px', fontSize: '10px', fontWeight: '900', color: T.header, padding: '0 10px 8px', opacity: 0.4 }}>
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
                <div style={{ background: 'rgba(61,43,31,0.05)', color: T.header, textAlign: 'center', fontSize: '8px', fontWeight: '900', padding: '2px 0', opacity: 0.5, letterSpacing: '1px' }}>
                    JACKPOT {Number(user?.jackpot?.amount || 0).toFixed(0)} / {Number(user?.jackpot?.target || 1000).toFixed(0)}
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* ── Practice Mode (Espresso) ── */}
          <div onClick={() => router.push('/tickets/select?type=DEMO&price=0')} style={{ background: '#4B3621', padding: '15px 10px', display: 'grid', gridTemplateColumns: '80px 1fr 120px', alignItems: 'center', marginTop: '2px', borderRadius: '4px', cursor: 'pointer' }}>
              <div>
                  <div style={{ fontSize: '20px', fontWeight: '900', color: T.gold, lineHeight: '1' }}>FREE</div>
                  <div style={{ fontSize: '9px', fontWeight: '900', color: 'rgba(255,255,255,0.4)' }}>DEMO</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Play size={20} fill={T.gold} color={T.gold} />
                  <div>
                      <div style={{ fontWeight: '900', fontSize: '13px', color: 'white' }}>Practice Mode</div>
                      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>No real money</div>
                  </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '5px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: '900' }}>OPEN</button>
                  <button style={{ background: T.gold, border: 'none', color: T.header, padding: '5px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: '900' }}>TRY</button>
              </div>
          </div>
        </div>

        {/* ── SPIN GAMES ── */}
        <div style={{ padding: '20px 15px 0' }}>
          <div style={{ color: T.header, fontSize: '14px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', textTransform: 'uppercase', opacity: 0.8 }}>
            <Dices size={18} color={T.gold} /> SPIN GAMES
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 120px', fontSize: '10px', fontWeight: '900', color: T.header, padding: '0 10px 8px', opacity: 0.4 }}>
             <span>BET</span>
             <span style={{ textAlign: 'center' }}>WIN/PLAYER</span>
             <span style={{ textAlign: 'right' }}>STATUS & JOIN</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {spinRooms.map((room) => (
              <React.Fragment key={room.type}>
                <div onClick={() => handleJoinRoom(room)} style={{ background: T.cardLobby, padding: '15px 10px', display: 'grid', gridTemplateColumns: '70px 1fr 120px', alignItems: 'center', borderRadius: '4px', cursor: 'pointer' }}>
                    <div>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: T.gold, lineHeight: '1' }}>{room.price}</div>
                        <div style={{ fontSize: '9px', fontWeight: '900', color: T.textL, opacity: 0.4 }}>ETB</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        <Trophy size={20} color={T.gold} />
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '20px', fontWeight: '900', color: T.textL, lineHeight: '1' }}>{room.win}</div>
                            <div style={{ fontSize: '9px', color: T.textL, opacity: 0.4, fontWeight: 'bold' }}>{room.players} players</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                        <div style={{ background: '#4A90E2', color: 'white', fontSize: '8px', padding: '1px 6px', borderRadius: '4px', fontWeight: '900' }}>ACTIVE {room.active}</div>
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <div style={{ border: '1px solid #4CAF50', color: '#4CAF50', fontSize: '9px', padding: '2px 6px', borderRadius: '4px', fontWeight: '900' }}>READY</div>
                            <div style={{ position: 'relative' }}>
                                <button style={{ 
                                  background: 'transparent', 
                                  color: '#E67E22', 
                                  border: '2px solid #E67E22', 
                                  padding: '7px 14px', 
                                  borderRadius: '6px', 
                                  fontWeight: '900', 
                                  fontSize: '11px',
                                  opacity: 0.7
                                }}>SOON</button>
                                {room.isBonus && (
                                    <div style={{ position: 'absolute', top: '-10px', right: '-5px', background: T.gold, color: T.header, fontSize: '7px', padding: '1px 4px', borderRadius: '4px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                                        BONUS
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ── Premium Navbar ── */}
      <div style={{ position: 'fixed', bottom: 15, left: 15, right: 15, background: T.header, display: 'flex', justifyContent: 'space-around', padding: '10px 5px', borderRadius: '20px', border: `1px solid ${T.gold}`, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', zIndex: 1000 }}>
         {[
           { label: 'Game',    icon: <Play size={20} fill={T.gold} color={T.gold} />, active: true, path: '/' },
           { label: 'Scores',  icon: <Trophy size={20} color={T.gold} />, active: false, path: '/scores' },
           { label: 'History', icon: <History size={20} color={T.gold} />, active: false, path: '/history' },
           { label: 'Wallet',  icon: <WalletIcon size={20} color={T.gold} />, active: false, path: '/wallet' },
           { label: 'Profile', icon: <User size={20} color={T.gold} />, active: false, path: '/profile' },
         ].map((item) => (
           <div 
              key={item.label} 
              onClick={() => router.push(item.path)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flex: 1, opacity: item.active ? 1 : 0.5, cursor: 'pointer' }}
           >
             {item.icon}
             <span style={{ fontSize: '10px', fontWeight: '900', color: T.gold }}>{item.label}</span>
           </div>
         ))}
      </div>

      <JackpotSplash
        show={showJackpot}
        onClose={() => setShowJackpot(false)}
        jackpotAmount={Number(user?.jackpot?.amount || 0).toFixed(2)}
      />

      <BunaModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        title={modalConfig.title}
        message={modalConfig.message}
      />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;900&display=swap');
        body { background: #F5E6BE !important; margin: 0; padding: 0; }
      `}</style>
    </div>
  );
}
