'use client';
import { useEffect, useState } from 'react';
import { getRooms, getWallet, getMe, register, joinGame } from '../lib/api';
import Navbar from '../components/Navbar';
import Splash from '../components/Splash';
import GameBoard from './game/GameBoard'; // We will create this
import { useToast } from '../components/Toast';
import { PREDEFINED_CARDS } from '../lib/predefinedCards';
import { 
  Target, Trophy, Play, Dices, Gift, Wallet, Zap, 
  ChevronLeft, Star, LayoutGrid, CheckCircle2 
} from 'lucide-react';

interface Room {
  id: string;
  type: 'CASUAL' | 'STANDARD' | 'JACKPOT' | 'VIP';
  ticketPrice: string;
  currentPlayers: number;
}

export default function BunkerPage() {
  const [view, setView] = useState<'LOBBY' | 'SELECT' | 'GAME'>('LOBBY');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(false);
  const [activeRoom, setActiveRoom] = useState<{type: string, price: number} | null>(null);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const { show } = useToast();

  const loadData = async (retryCount = 0) => {
    try {
      let u = await getMe().catch(async (err) => {
        if (err.response?.status === 401) {
          const twa = (window as any).Telegram?.WebApp;
          const startParam = twa ? new URLSearchParams(twa.initData).get('start_param') : null;
          return await register({ phoneNumber: '', referredById: startParam || undefined });
        }
        throw err;
      });
      if (u) {
        setUser(u);
        const [r, w] = await Promise.all([getRooms(), getWallet()]);
        setRooms(r);
        setWallet(w);
      }
    } catch (err: any) {
      if (retryCount < 5) setTimeout(() => loadData(retryCount + 1), 2000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (!sessionStorage.getItem('buna-splash-shown')) setShowSplash(true);
    // Force expand Telegram
    const twa = (window as any).Telegram?.WebApp;
    if (twa) {
      twa.ready();
      twa.expand();
    }
  }, []);

  const handleJoinGame = async () => {
    if (!activeRoom || selectedCards.length === 0 || joining) return;
    setJoining(true);
    try {
      const res = await joinGame(activeRoom.type, selectedCards);
      setActiveGameId(res.gameId);
      setView('GAME'); // INSTANT VIEW SWITCH, NO URL CHANGE
    } catch (err: any) {
      show(err.response?.data?.error || 'Join failed', 'error');
    } finally {
      setJoining(false);
    }
  };

  if (showSplash) return <Splash isLoading={loading} onFinish={() => { setShowSplash(false); sessionStorage.setItem('buna-splash-shown', 'true'); }} />;

  return (
    <div className="buna-bunker">
      {view === 'LOBBY' && (
        <div className="view-fade">
          <div className="top-nav">
            <div className="stat"><Gift size={14} className="gold" /> 0.00</div>
            <div className="stat"><Wallet size={14} className="gold" /> {(wallet?.balance || 0).toFixed(2)}</div>
          </div>
          <div className="header"><Dices size={18} /> SPIN GAMES</div>
          <div className="spin-grid">
             <div className="spin-card p">MEGA SPIN</div>
             <div className="spin-card b">LUCKY 7</div>
          </div>

          <div className="header"><Target size={18} /> BINGO GAMES</div>
          <div className="list">
            {rooms.map(room => (
              <div key={room.id} className="row">
                <div className="bet"><b>{room.ticketPrice}</b> <span>ETB</span></div>
                <div className="prize"><Trophy size={16} /> {Number(room.ticketPrice)*8}</div>
                <button className="join" onClick={() => { setActiveRoom({type: room.type, price: Number(room.ticketPrice)}); setSelectedCards([]); setView('SELECT'); }}>JOIN</button>
              </div>
            ))}
          </div>

          <div className="header"><Play size={18} /> FREE DEMO</div>
          <div className="list">
             <div className="row demo" onClick={() => { setActiveRoom({type: 'CASUAL', price: 10}); setSelectedCards([]); setView('SELECT'); }}>
                <div className="bet"><b>FREE</b> <span>TEST</span></div>
                <div className="prize">Practice Mode</div>
                <button className="join try">TRY</button>
             </div>
          </div>
          <Navbar />
        </div>
      )}

      {view === 'SELECT' && activeRoom && (
        <div className="view-fade">
          <div className="header-nav">
             <button onClick={() => setView('LOBBY')}><ChevronLeft /></button>
             <span>Pick Cards ({selectedCards.length}/3)</span>
          </div>
          <div className="grid">
            {Array.from({length: 100}, (_,i)=>i+1).map(n => (
              <div key={n} className={`cell ${selectedCards.includes(n)?'active':''}`} onClick={() => setSelectedCards(p => p.includes(n)?p.filter(x=>x!==n):p.length<3?[...p,n]:p)}>
                {n}
              </div>
            ))}
          </div>
          <div className="footer-action">
             <button className={`go ${joining||!selectedCards.length?'off':''}`} onClick={handleJoinGame} disabled={joining||!selectedCards.length}>
               {joining ? '...' : `JOIN WITH ${selectedCards.length} CARDS`}
             </button>
          </div>
        </div>
      )}

      {view === 'GAME' && activeGameId && (
        <div className="view-fade">
           <GameBoard gameId={activeGameId} onExit={() => setView('LOBBY')} />
        </div>
      )}

      <style jsx>{`
        .buna-bunker { min-height: 100vh; background: #F5ECD7; color: #5C3D1E; }
        .view-fade { animation: fin 0.2s; }
        @keyframes fin { from { opacity:0; } to { opacity:1; } }
        .top-nav { display:flex; justify-content:space-between; padding:10px 15px; background:#5C3D1E; color:white; }
        .stat { display:flex; align-items:center; gap:5px; font-weight:900; font-size:14px; }
        .gold { color:#facc15; }
        .header { padding:15px; font-weight:900; color:#C98A1A; display:flex; align-items:center; gap:8px; }
        .list { padding:0 10px; }
        .row { display:grid; grid-template-columns: 80px 1fr 100px; padding:15px; background:white; margin-bottom:5px; border-radius:10px; align-items:center; }
        .bet b { font-size:20px; }
        .bet span { font-size:10px; opacity:0.5; }
        .prize { display:flex; align-items:center; gap:5px; font-weight:800; color:#C98A1A; }
        .join { background:#22c55e; color:white; border:none; padding:8px; border-radius:8px; font-weight:900; box-shadow:0 3px 0 #16a34a; }
        
        .header-nav { padding:15px; background:#5C3D1E; color:white; display:flex; align-items:center; gap:15px; font-weight:900; }
        .header-nav button { background:none; border:none; color:white; }
        .grid { display:grid; grid-template-columns:repeat(10, 1fr); gap:5px; padding:10px; }
        .cell { aspect-ratio:1; background:white; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:900; border-radius:5px; border:1px solid #EFE4CC; }
        .cell.active { background:#C98A1A; color:white; border-color:#C98A1A; }
        .footer-action { position:fixed; bottom:0; left:0; right:0; padding:15px; background:#F5ECD7; border-top:1px solid #EFE4CC; }
        .go { width:100%; padding:15px; background:#22c55e; color:white; border:none; border-radius:10px; font-weight:900; box-shadow:0 4px 0 #16a34a; }
        .join.try { background: #3b82f6; box-shadow: 0 3px 0 #2563eb; }
        .row.demo { border: 1.5px dashed #C98A1A; background: #FFF0D0; cursor: pointer; }

        .spin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 10px 10px; }
        .spin-card { height: 70px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 14px; }
        .spin-card.p { background: linear-gradient(135deg, #a855f7, #7e22ce); }
        .spin-card.b { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
      `}</style>
    </div>
  );
}
