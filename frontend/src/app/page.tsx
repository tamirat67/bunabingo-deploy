'use client';
import { useEffect, useState } from 'react';
import { getRooms, getWallet, getMe, verifyPhone } from '../lib/api';
import { initTelegram } from '../lib/telegram';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';
import RegistrationOverlay from '../components/RegistrationOverlay';
import { Trophy, Gift, Wallet as WalletIcon, Target, PlayCircle, Dices } from 'lucide-react';

interface Room {
  type: string;
  price: number;
  players: number;
  win: number;
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
    getWallet().then(setWallet).catch(() => {});
    getRooms().then(setRooms).catch(() => {});
  }, []);

  if (!mounted) return null;

  const bingoRooms: Room[] = [
    { type: 'DEMO', price: 0, win: 0, players: 0, active: 1, isBonus: true },
    { type: 'CASUAL', price: 10, win: 592, players: 74, active: 0, isBonus: true },
    { type: 'STANDARD', price: 20, win: 0, players: 0, active: 0 },
    { type: 'PRO', price: 50, win: 0, players: 0, active: 1 },
    { type: 'JACKPOT', price: 100, win: 0, players: 0, active: 0 },
  ];

  const spinRooms: Room[] = [
    { type: 'CASUAL', price: 10, win: 0, players: 0, active: 0, isBonus: true },
    { type: 'STANDARD', price: 20, win: 0, players: 0, active: 0 },
    { type: 'PRO', price: 50, win: 0, players: 0, active: 1 },
  ];

  const handleJoinRoom = (room: Room) => {
    if (room.isBonus && room.price === 0) return; // Demo handled separately
    
    if (!user?.phoneNumber) {
      const app = (window as any).Telegram?.WebApp;
      if (app) {
        app.requestContact(async (ok: boolean, response: any) => {
          if (ok && response?.responseLine) {
            try {
              const res = await verifyPhone(response);
              setUser(res.user);
              router.push(`/tickets/select?type=${room.type}&stake=${room.price}`);
            } catch (err) {
              alert('Verification failed. Please try again.');
            }
          }
        });
      } else {
        alert('Please open in Telegram to play.');
      }
      return;
    }
    
    router.push(`/tickets/select?type=${room.type}&stake=${room.price}`);
  };

  const renderGameRow = (room: Room, isSpin = false) => (
    <div key={`${isSpin ? 'spin' : 'bingo'}-${room.price}`} onClick={() => handleJoinRoom(room)}>
      {room.price === 20 && <div className="jackpot-bar">JACKPOT 508 / 1000</div>}
      
      <div className="game-row" style={{ opacity: room.price === 0 || room.active ? 1 : 0.7 }}>
        <div className="bet-col">
          <span className="bet-amount">{room.price === 0 ? '🎮' : room.price}</span>
          <span className="bet-label">{room.price === 0 ? 'DEMO' : 'ETB'}</span>
        </div>
        
        <div className="win-col">
          <Trophy size={20} className={room.win > 0 ? 'trophy-gold' : 'trophy-muted'} style={{ opacity: room.win > 0 ? 1 : 0.3 }} />
          <div className="win-info">
            <div className="win-amount" style={{ color: room.win > 0 ? 'var(--gold)' : 'white', opacity: room.win > 0 ? 1 : 0.5 }}>{room.win}</div>
            <div className="player-count">{room.players} players</div>
          </div>
        </div>

        <div className="action-col">
          <div className="status-badges">
            <span className="badge badge-active">ACTIVE {room.active}</span>
            <span className="badge badge-ready">READY</span>
          </div>
          <button 
            className={`btn-join ${isSpin ? 'purple' : ''}`}
            onClick={() => window.location.href = `/tickets/select?type=${room.type}&price=${room.price}`}
          >
            {room.isBonus ? '🎁 BONUS JOIN' : 'JOIN'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="lobby-container">
      <div className="lobby-header">
        <div className="live-indicator">
          <span className="live-dot pulse"></span>
          <span>Live</span>
        </div>
        <div className="stats-bar">
          <div className="stat-item bonus">
            <Gift size={14} />
            <span>Bonus: 0.00</span>
          </div>
          <div className="stat-item balance">
            <WalletIcon size={14} />
            <span>Balance: {(wallet?.balance ?? 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="section-title">
        <Target size={18} color="#ef5350" />
        <span>BINGO GAMES</span>
      </div>

      <div className="table-headers" style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px', padding: '0 16px', fontSize: '10px', opacity: 0.6, fontWeight: 'bold', marginBottom: '8px' }}>
        <div>BET</div>
        <div>WIN/PLAYER</div>
        <div style={{ textAlign: 'right' }}>STATUS & JOIN</div>
      </div>

      <div className="rooms-stack">
        {bingoRooms.map(r => renderGameRow(r))}
      </div>

      <div className="demo-section" style={{ marginTop: '10px' }}>
        <div className="jackpot-bar">JACKPOT 0 / 1000</div>
        <div className="demo-row">
          <div className="demo-info">
            <div className="bet-col">
              <span className="bet-amount">FREE</span>
              <span className="bet-label">DEMO</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PlayCircle size={20} opacity={0.5} />
              <div>
                <div className="demo-title">Practice Mode</div>
                <div className="demo-sub">No real money</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-try" style={{ background: 'rgba(255,255,255,0.2)' }}>OPEN</button>
            <button className="btn-try">TRY</button>
          </div>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: '20px' }}>
        <Dices size={18} color="#ffa726" />
        <span>SPIN GAMES</span>
      </div>

      <div className="rooms-stack">
        {spinRooms.map(r => renderGameRow(r, true))}
      </div>
    </div>
  );
}
