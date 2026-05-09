'use client';
import React, { useEffect, useState } from 'react';
import { getRooms, getWallet, getMe, verifyPhone } from '../lib/api';
import { initTelegram } from '../lib/telegram';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';
import { Trophy, Gift, Wallet as WalletIcon, Target, Play, Dices } from 'lucide-react';

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    initTelegram();
    getMe().then(setUser);
    getWallet().then(setWallet);
    getRooms().then(setRooms);
  }, []);

  const handleJoinRoom = (room: Room) => {
    router.push(`/tickets/select?type=${room.type}&stake=${room.price}`);
  };

  if (!mounted) return null;

  const bingoRooms: Room[] = [
    { type: 'DEMO', price: 0, win: 0, players: 0, active: 1, isBonus: true },
    { type: 'CASUAL', price: 10, win: 80, players: 0, active: 0, isBonus: true },
    { type: 'STANDARD', price: 20, win: 160, players: 0, active: 0 },
    { type: 'PRO', price: 50, win: 400, players: 0, active: 0 },
    { type: 'JACKPOT', price: 100, win: 800, players: 0, active: 0 },
  ];

  return (
    <div className="lobby-container">
      <div className="lobby-header-stats">
        <div className="live-box"><span className="dot-green"></span> Live</div>
        <div className="stats-group">
          <div className="stat"><Gift size={14} color="#D4AF37" /> Bonus: <span className="gold-text">{(Number(0)).toFixed(2)}</span></div>
          <div className="stat"><WalletIcon size={14} /> Balance: <span className="gold-text">{Number(wallet?.balance || 0).toFixed(2)}</span></div>
        </div>
      </div>

      <div className="lobby-content">
        <div className="section-header">
          <Target size={20} color="#D4AF37" /> <span className="title-gold">BINGO GAMES</span>
        </div>
        
        <div className="table-header-labels">
          <span>BET</span>
          <span style={{paddingLeft: '40px'}}>WIN/PLAYER</span>
          <span style={{textAlign: 'right'}}>STATUS & JOIN</span>
        </div>

        <div className="games-list">
          {bingoRooms.map((room) => {
            const isDemo = room.type === 'DEMO';
            if (isDemo) return (
              <div key="demo" className="demo-row-premium" onClick={() => handleJoinRoom(room)}>
                <div className="demo-left">
                  <div className="f">FREE</div>
                  <div className="d">DEMO</div>
                </div>
                <div className="demo-mid">
                  <div className="p"><Play size={16} fill="white" /> Practice Mode</div>
                  <div className="n">No real money</div>
                </div>
                <div className="demo-right">
                  <button className="btn-open">OPEN</button>
                  <button className="btn-try">TRY</button>
                </div>
              </div>
            );

            return (
              <React.Fragment key={room.type}>
                <div className="bingo-row-fit" onClick={() => handleJoinRoom(room)}>
                  <div className="bet-part">
                    <div className="num">{room.price}</div>
                    <div className="unit">ETB</div>
                  </div>
                  <div className="prize-part">
                    <Trophy size={24} color="#8D6E63" />
                    <div className="p-info">
                      <div className="val">{room.win}</div>
                      <div className="cnt">{room.players} players</div>
                    </div>
                  </div>
                  <div className="action-part">
                    <div className="badges">
                      <div className="b-active">ACTIVE {room.active}</div>
                      <div className="b-ready">READY</div>
                    </div>
                    <button className="btn-join-3d">JOIN</button>
                  </div>
                </div>
                <div className="jackpot-divider">JACKPOT 0 / 1000</div>
              </React.Fragment>
            );
          })}
        </div>

        <div className="section-header" style={{marginTop: '20px'}}>
          <Dices size={20} color="#D4AF37" /> <span className="title-gold">SPIN GAMES</span>
        </div>
        <div className="table-header-labels">
          <span>BET</span>
          <span style={{paddingLeft: '40px'}}>WIN/PLAYER</span>
          <span style={{textAlign: 'right'}}>STATUS & JOIN</span>
        </div>
        
        <div className="games-list">
          {[10, 20, 50, 100].map((stake) => (
            <div key={stake} className="bingo-row-fit spin-row" onClick={() => router.push(`/play/spin?stake=${stake}`)}>
              <div className="bet-part">
                <div className="num">{stake}</div>
                <div className="unit">ETB</div>
              </div>
              <div className="prize-part">
                <Trophy size={24} color="#8D6E63" />
                <div className="p-info">
                  <div className="val">WHEEL</div>
                  <div className="cnt">Instant Win</div>
                </div>
              </div>
              <div className="action-part">
                <div className="badges">
                  <div className="b-active">LIVE 24/7</div>
                  <div className="b-ready">READY</div>
                </div>
                <button className="btn-join-3d spin-btn">SPIN</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
