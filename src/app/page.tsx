'use client';
import React, { useEffect, useState } from 'react';
import { getRooms, getWallet, getMe } from '../lib/api';
import { initTelegram } from '../lib/telegram';
import { useRouter } from 'next/navigation';
import { Trophy, Gift, Wallet as WalletIcon, Target, Play, Dices, ExternalLink, ShieldCheck } from 'lucide-react';
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

  // Use dynamic data from API or fall back to defaults
  const bingoRooms: Room[] = rooms.filter(r => !r.type.startsWith('SPIN_')).map(r => ({
    type: r.type,
    price: Number(r.ticketPrice),
    win: Number(r.ticketPrice) * 8,
    players: r.games?.[0]?.tickets?.length || 0,
    active: r.isActive ? 1 : 0
  }));

  const spinRooms: Room[] = rooms.filter(r => r.type.startsWith('SPIN_')).map(r => ({
    type: r.type,
    price: Number(r.ticketPrice),
    win: Number(r.ticketPrice) * 8,
    players: r.games?.[0]?.tickets?.length || 0,
    active: r.isActive ? 1 : 0
  }));

  return (
    <div className="lobby-container" style={{ background: '#F5E6BE', minHeight: '100vh', paddingBottom: '80px', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Buna Game Zone Header */}
      <div style={{ background: '#3D2B1F', color: 'white', padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #D4AF37' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#D4AF37', fontWeight: '900', fontSize: '18px' }}>
            <ShieldCheck size={24} />
            BUNA GAME ZONE
         </div>
         <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
               <WalletIcon size={16} color="#D4AF37" />
               <span style={{ color: '#D4AF37', fontWeight: '900' }}>{Number(wallet?.balance || 0).toFixed(0)} ETB</span>
            </div>
         </div>
      </div>

      <div className="lobby-content" style={{ paddingTop: '10px' }}>
        
        <AnimatePresence>
          {activeGame && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              onClick={goToActiveGame}
              style={{ background: 'linear-gradient(90deg, #D4AF37, #B8860B)', color: '#3D2B1F', padding: '12px 15px', margin: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 15px rgba(212,175,55,0.4)', cursor: 'pointer' }}
            >
               <div style={{ fontWeight: '900', fontSize: '13px' }}>🎯 ACTIVE TOURNAMENT IN PROGRESS! CLICK TO RE-JOIN</div>
               <ExternalLink size={18} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bingo Section */}
        <div style={{ padding: '10px 15px' }}>
          <div style={{ color: '#3D2B1F', fontSize: '16px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', opacity: 0.8 }}>
            <Target size={20} color="#D4AF37" /> BINGO TOURNAMENTS
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {bingoRooms.length > 0 ? bingoRooms.map((room) => (
                <div key={room.type} onClick={() => handleJoinRoom(room)} style={{ background: 'white', padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '16px', boxShadow: '0 4px 12px rgba(61,43,31,0.05)', cursor: 'pointer', border: '1px solid rgba(212,175,55,0.2)' }}>
                    <div style={{ width: '60px' }}>
                        <div style={{ fontSize: '28px', fontWeight: '900', color: '#3D2B1F', lineHeight: '1' }}>{room.price}</div>
                        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#D4AF37' }}>ETB</div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '20px' }}>
                        <Trophy size={24} color="#D4AF37" />
                        <div>
                            <div style={{ fontSize: '20px', fontWeight: '900', color: '#3D2B1F', lineHeight: '1' }}>{room.win} ETB</div>
                            <div style={{ fontSize: '10px', color: '#8D6E63', fontWeight: 'bold' }}>{room.players} players joined</div>
                        </div>
                    </div>
                    <button style={{ background: '#27AE60', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '10px', fontWeight: '900', fontSize: '14px', boxShadow: '0 4px 0 #1E8449' }}>JOIN</button>
                </div>
            )) : <div style={{ textAlign: 'center', padding: '40px', color: '#8D6E63' }}>Loading tournaments...</div>}
          </div>
        </div>

        {/* Spin Section */}
        <div style={{ padding: '20px 15px 10px' }}>
          <div style={{ color: '#3D2B1F', fontSize: '16px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', opacity: 0.8 }}>
            <Dices size={20} color="#D4AF37" /> SPIN RAFFLES
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {spinRooms.map((room) => (
                <div key={room.type} onClick={() => handleJoinRoom(room)} style={{ background: 'white', padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '16px', boxShadow: '0 4px 12px rgba(61,43,31,0.05)', cursor: 'pointer', border: '1px solid rgba(212,175,55,0.2)' }}>
                    <div style={{ width: '60px' }}>
                        <div style={{ fontSize: '28px', fontWeight: '900', color: '#3D2B1F', lineHeight: '1' }}>{room.price}</div>
                        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#D4AF37' }}>ETB</div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '20px' }}>
                        <div style={{ width: '32px', height: '32px', background: '#3D2B1F', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Play size={16} fill="#D4AF37" color="#D4AF37" />
                        </div>
                        <div>
                            <div style={{ fontSize: '20px', fontWeight: '900', color: '#3D2B1F', lineHeight: '1' }}>{room.win} ETB</div>
                            <div style={{ fontSize: '10px', color: '#8D6E63', fontWeight: 'bold' }}>{room.players} tickets sold</div>
                        </div>
                    </div>
                    <button style={{ background: '#D4AF37', color: '#3D2B1F', border: 'none', padding: '10px 15px', borderRadius: '10px', fontWeight: '900', fontSize: '14px', boxShadow: '0 4px 0 #B8860B' }}>SPIN</button>
                </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{height: '100px'}} />
    </div>
  );
}
