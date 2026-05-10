'use client';
import React, { useEffect, useState } from 'react';
import { getRooms, getWallet, getMe } from '../lib/api';
import { initTelegram } from '../lib/telegram';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';
import { Trophy, Gift, Wallet as WalletIcon, Target, Play, Dices, ExternalLink, User, Home, List, History, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Room {
  type: string;
  price: number;
  win: number;
  players: number;
  active: number;
  isBonus?: boolean;
}

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

  const handleJoinRoom = (room: Room) => {
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

  const bingoRooms: Room[] = [
    { type: 'CASUAL', price: 10, win: 80, players: 0, active: 0 },
    { type: 'STANDARD', price: 20, win: 160, players: 0, active: 0 },
    { type: 'PRO', price: 50, win: 400, players: 0, active: 0 },
    { type: 'JACKPOT', price: 100, win: 800, players: 0, active: 0 },
  ];

  const spinRooms: Room[] = [
    { type: 'SPIN_10', price: 10, win: 80, players: 0, active: 0 },
    { type: 'SPIN_20', price: 20, win: 160, players: 0, active: 0 },
    { type: 'SPIN_50', price: 50, win: 400, players: 0, active: 0 },
    { type: 'SPIN_100', price: 100, win: 800, players: 0, active: 0 },
  ];

  return (
    <div className="lobby-container" style={{ background: '#F5E6BE', minHeight: '100vh', paddingBottom: '80px', fontFamily: 'sans-serif' }}>
      
      {/* Dark Header */}
      <div style={{ background: '#3D2B1F', color: 'white', padding: '10px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', background: '#4CAF50', borderRadius: '50%', display: 'inline-block' }}></span>
            Live
         </div>
         <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
               <Gift size={16} color="#D4AF37" /> Bonus: <span style={{ color: '#D4AF37' }}>0.00</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
               <WalletIcon size={16} color="#D4AF37" /> Balance: <span style={{ color: '#D4AF37' }}>{Number(wallet?.balance || 0).toFixed(2)}</span>
            </div>
         </div>
      </div>

      <div className="lobby-content" style={{ paddingTop: '10px' }}>
        
        {/* Active Game Banner if exists */}
        <AnimatePresence>
          {activeGame && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
              onClick={goToActiveGame}
              style={{ background: '#D4AF37', color: '#3D2B1F', padding: '12px 15px', margin: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', cursor: 'pointer' }}
            >
               <div style={{ fontWeight: '900', fontSize: '14px' }}>YOU HAVE AN ACTIVE GAME! CLICK TO JOIN</div>
               <ExternalLink size={18} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bingo Section */}
        <div style={{ padding: '10px 15px' }}>
          <div style={{ color: '#D4AF37', fontSize: '18px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
            <Target size={20} /> BINGO GAMES
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8D6E63', fontWeight: 'bold', marginBottom: '10px', padding: '0 5px' }}>
             <span>BET</span>
             <span>WIN/PLAYER</span>
             <span>STATUS & JOIN</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {bingoRooms.map((room, idx) => (
              <React.Fragment key={room.type}>
                <div style={{ background: 'white', padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ width: '60px' }}>
                        <div style={{ fontSize: '32px', fontWeight: '900', color: '#333', lineHeight: '1' }}>{room.price}</div>
                        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#666' }}>ETB</div>
                    </div>

                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '30px' }}>
                        <Trophy size={28} color="#999" />
                        <div>
                            <div style={{ fontSize: '24px', fontWeight: '900', color: '#D4AF37', lineHeight: '1' }}>{room.win}</div>
                            <div style={{ fontSize: '10px', color: '#999', fontWeight: 'bold' }}>{room.players} players</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{ background: '#4A90E2', color: 'white', fontSize: '8px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>ACTIVE {room.active}</div>
                            <div style={{ background: '#E8F5E9', color: '#4CAF50', fontSize: '8px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', textAlign: 'center', border: '1px solid #C8E6C9' }}>READY</div>
                        </div>
                        <button 
                            onClick={() => handleJoinRoom(room)}
                            style={{ background: '#2ECC71', color: 'white', border: 'none', padding: '12px 18px', borderRadius: '12px', fontWeight: '900', fontSize: '16px', boxShadow: '0 4px 0 #27AE60', cursor: 'pointer' }}
                        >
                            JOIN
                        </button>
                    </div>
                </div>
                <div style={{ background: '#EEDCBA', color: '#8D6E63', textAlign: 'center', fontSize: '9px', fontWeight: 'bold', padding: '3px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    JACKPOT 0 / 1000
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Demo Section */}
        <div style={{ background: '#3D2B1F', color: 'white', padding: '20px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '10px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '28px', fontWeight: '900', lineHeight: '1' }}>FREE</div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', opacity: 0.6 }}>DEMO</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, paddingLeft: '30px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Play size={20} fill="white" />
                </div>
                <div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px' }}>Practice Mode</div>
                    <div style={{ fontSize: '10px', opacity: 0.6 }}>No real money</div>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <button style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>OPEN</button>
                <button onClick={() => router.push('/tickets/select?type=DEMO&price=0')} style={{ background: '#D4AF37', border: 'none', color: '#3D2B1F', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>TRY</button>
            </div>
        </div>

        {/* Spin Section */}
        <div style={{ padding: '10px 15px' }}>
          <div style={{ color: '#D4AF37', fontSize: '18px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
            <Dices size={20} /> SPIN GAMES
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8D6E63', fontWeight: 'bold', marginBottom: '10px', padding: '0 5px' }}>
             <span>BET</span>
             <span>WIN/PLAYER</span>
             <span>STATUS & JOIN</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {spinRooms.map((room) => (
              <React.Fragment key={room.type}>
                <div style={{ background: 'white', padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ width: '60px' }}>
                        <div style={{ fontSize: '32px', fontWeight: '900', color: '#333', lineHeight: '1' }}>{room.price}</div>
                        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#666' }}>ETB</div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '30px' }}>
                        <Trophy size={28} color="#999" />
                        <div>
                            <div style={{ fontSize: '24px', fontWeight: '900', color: '#D4AF37', lineHeight: '1' }}>{room.win}</div>
                            <div style={{ fontSize: '10px', color: '#999', fontWeight: 'bold' }}>{room.players} players</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{ background: '#4A90E2', color: 'white', fontSize: '8px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>ACTIVE {room.active}</div>
                            <div style={{ background: '#E8F5E9', color: '#4CAF50', fontSize: '8px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', textAlign: 'center', border: '1px solid #C8E6C9' }}>READY</div>
                        </div>
                        <button 
                            onClick={() => handleJoinRoom(room)}
                            style={{ background: '#2ECC71', color: 'white', border: 'none', padding: '12px 18px', borderRadius: '12px', fontWeight: '900', fontSize: '16px', boxShadow: '0 4px 0 #27AE60', cursor: 'pointer' }}
                        >
                            JOIN
                        </button>
                    </div>
                </div>
                <div style={{ background: '#EEDCBA', color: '#8D6E63', textAlign: 'center', fontSize: '9px', fontWeight: 'bold', padding: '3px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    JACKPOT 0 / 1000
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div style={{height: '80px'}} />
    </div>
  );
}
