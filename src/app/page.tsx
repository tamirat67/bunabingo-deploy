'use client';
import React, { useEffect, useState } from 'react';
import { getRooms, getWallet, getMe } from '../lib/api';
import { initTelegram } from '../lib/telegram';
import { useRouter } from 'next/navigation';
import { Trophy, Gift, Wallet as WalletIcon, Target, Play, Dices, ExternalLink, ShieldCheck, History, User, ChevronDown, MoreVertical, X, Coffee } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Coffee, Gold & Espresso Theme (Buna Game Zone) ──────────────────
const T = {
  bg:      '#F5E6BE',   // Cream
  header:  '#3D2B1F',   // Espresso (Dark coffee)
  gold:    '#D4AF37',   // Gold
  goldDk:  '#B8860B',   // Deep gold
  brown:   '#4B3621',   // Coffee
  card:    '#3D2B1F',   // Espresso row background
  textL:   '#F5E6BE',   // Cream text for dark backgrounds
};

export default function LobbyPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [activeGame, setActiveGame] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    initTelegram();
    refreshData();
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, []);

  const refreshData = async () => {
    try {
      const me = await getMe();
      setUser(me);
      getWallet().then(setWallet);
      getRooms().then(setRooms);

      if (me.tickets && me.tickets.length > 0) {
         const latestTicket = me.tickets[0];
         if (latestTicket.game.status !== 'FINISHED' && latestTicket.game.status !== 'CANCELLED') {
            setActiveGame(latestTicket.game);
         } else {
            setActiveGame(null);
         }
      }
    } catch (e) {}
  };

  const handleJoinRoom = (room: any) => {
    router.push(`/tickets/select?type=${room.type}&price=${room.price}`);
  };

  const goToActiveGame = () => {
    if (!activeGame) return;
    if (activeGame.room.type.startsWith('SPIN_')) {
      router.push(`/play/spin?id=${activeGame.id}`);
    } else {
      router.push(`/game?id=${activeGame.id}`);
    }
  };

  if (!mounted) return null;

  const bingoRooms = rooms
    .filter(r => !r.type.startsWith('SPIN_') && r.type !== 'DEMO')
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
        isBonus: ['CASUAL', 'JACKPOT'].includes(r.type)
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
        win: Math.max(livePrize, price * 8), // Show at least 8x multiplier
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
      <div style={{ background: '#2D1B14', padding: '10px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(212,175,55,0.1)' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4CAF50', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}>
            <div style={{ width: '6px', height: '6px', background: '#4CAF50', borderRadius: '50%', boxShadow: '0 0 5px #4CAF50' }} />
            Live
         </div>
         <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: T.gold, fontSize: '12px', fontWeight: '900' }}>
               <Gift size={14} color={T.gold} /> BONUS: <span style={{ color: 'white' }}>0.00</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4CAF50', fontSize: '12px', fontWeight: '900' }}>
               <WalletIcon size={14} color="#4CAF50" /> BALANCE: <span style={{ color: 'white' }}>{Number(wallet?.balance || 0).toFixed(2)}</span>
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
                <div onClick={() => handleJoinRoom(room)} style={{ background: T.card, padding: '15px 10px', display: 'grid', gridTemplateColumns: '70px 1fr 120px', alignItems: 'center', borderRadius: '4px', cursor: 'pointer' }}>
                    <div>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: T.gold, lineHeight: '1' }}>{room.price}</div>
                        <div style={{ fontSize: '9px', fontWeight: '900', color: 'rgba(255,255,255,0.4)' }}>ETB</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        <Trophy size={20} color={T.gold} />
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '20px', fontWeight: '900', color: T.gold, lineHeight: '1' }}>{Number(room.win).toFixed(0)}</div>
                            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>{room.players} players</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                        <div style={{ background: '#4A90E2', color: 'white', fontSize: '8px', padding: '1px 6px', borderRadius: '4px', fontWeight: '900' }}>ACTIVE {room.active}</div>
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <div style={{ border: '1px solid #4CAF50', color: '#4CAF50', fontSize: '9px', padding: '2px 6px', borderRadius: '4px', fontWeight: '900' }}>READY</div>
                            <div style={{ position: 'relative' }}>
                                <button style={{ background: '#27AE60', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: '900', fontSize: '13px', boxShadow: '0 3px 0 #1E8449' }}>JOIN</button>
                                {room.isBonus && (
                                    <div style={{ position: 'absolute', top: '-10px', right: '-5px', background: T.gold, color: T.header, fontSize: '7px', padding: '1px 4px', borderRadius: '4px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                                        BONUS
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div style={{ background: 'rgba(61,43,31,0.05)', color: T.header, textAlign: 'center', fontSize: '8px', fontWeight: '900', padding: '2px 0', opacity: 0.5, letterSpacing: '1px' }}>
                    JACKPOT 0 / 1000
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
                <div onClick={() => handleJoinRoom(room)} style={{ background: T.card, padding: '15px 10px', display: 'grid', gridTemplateColumns: '70px 1fr 120px', alignItems: 'center', borderRadius: '4px', cursor: 'pointer' }}>
                    <div>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: T.gold, lineHeight: '1' }}>{room.price}</div>
                        <div style={{ fontSize: '9px', fontWeight: '900', color: 'rgba(255,255,255,0.4)' }}>ETB</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        <Trophy size={20} color={T.gold} />
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '20px', fontWeight: '900', color: 'white', lineHeight: '1' }}>{room.win}</div>
                            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>{room.players} players</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                        <div style={{ background: '#4A90E2', color: 'white', fontSize: '8px', padding: '1px 6px', borderRadius: '4px', fontWeight: '900' }}>ACTIVE {room.active}</div>
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <div style={{ border: '1px solid #4CAF50', color: '#4CAF50', fontSize: '9px', padding: '2px 6px', borderRadius: '4px', fontWeight: '900' }}>READY</div>
                            <div style={{ position: 'relative' }}>
                                <button style={{ background: 'transparent', color: '#27AE60', border: '2px solid #27AE60', padding: '7px 14px', borderRadius: '6px', fontWeight: '900', fontSize: '13px' }}>JOIN</button>
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

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;900&display=swap');
        body { background: #F5E6BE !important; margin: 0; padding: 0; }
      `}</style>
    </div>
  );
}
