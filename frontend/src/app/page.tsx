'use client';
import { useEffect, useState } from 'react';
import { getRooms, getWallet, getMe, register, joinGame } from '../lib/api';
import Navbar from '../components/Navbar';
import Splash from '../components/Splash';
import GameBoard from './game/GameBoard';
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

export default function BunaLobbyPage() {
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
    const twa = (window as any).Telegram?.WebApp;
    if (twa) { twa.ready(); twa.expand(); }
  }, []);

  const handleToggleCard = (num: number) => {
    setSelectedCards(prev => {
      if (prev.includes(num)) return prev.filter(id => id !== num);
      if (prev.length < 3) return [...prev, num];
      return prev;
    });
  };

  const handleJoinGame = async () => {
    if (!activeRoom || selectedCards.length === 0 || joining) return;
    setJoining(true);
    try {
      const res = await joinGame(activeRoom.type, selectedCards);
      setActiveGameId(res.gameId);
      setView('GAME');
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
          {/* Top Status Bar */}
          <div className="top-nav-pro">
            <div className="nav-left">
              <span className="live-dot pulse"></span>
              <span className="live-txt">Live</span>
            </div>
            <div className="nav-right">
              <div className="stat-item">
                <Gift size={16} className="gold" />
                <span className="lbl">Bonus:</span>
                <span className="val gold">0.00</span>
              </div>
              <div className="stat-item">
                <Wallet size={16} className="gold" />
                <span className="lbl">Balance:</span>
                <span className="val">{(wallet?.balance || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Bingo Games Section */}
          <div className="section-title-bar">
             <Target size={16} className="icon gold" />
             <span>BINGO GAMES</span>
          </div>

          <div className="table-header-labels">
             <div className="h-l">BET</div>
             <div className="h-l c">WIN/PLAYER</div>
             <div className="h-l r">STATUS & JOIN</div>
          </div>

          <div className="games-stack">
             {rooms.map((room, idx) => (
               <div key={room.id} className="row-wrapper">
                  {idx > 0 && <div className="jackpot-line">JACKPOT 0 / 1000</div>}
                  <div className="buna-row">
                     <div className="c-bet">
                        <div className="amt">{room.ticketPrice}</div>
                        <div className="unit">ETB</div>
                     </div>
                     <div className="c-win">
                        <Trophy size={18} className="gold-icon" />
                        <div className="win-content">
                           <div className="win-num gold">{Number(room.ticketPrice) * 8}</div>
                           <div className="win-sub">0 players</div>
                        </div>
                     </div>
                     <div className="c-action">
                        <div className="badge-col">
                           <span className="b-active">ACTIVE 0</span>
                           <span className="b-ready">READY</span>
                        </div>
                        <div className="btn-box">
                           {idx % 2 === 0 && <span className="bonus-pill">BONUS</span>}
                           <button className="join-btn" onClick={() => { setActiveRoom({type: room.type, price: Number(room.ticketPrice)}); setSelectedCards([]); setView('SELECT'); }}>JOIN</button>
                        </div>
                     </div>
                  </div>
               </div>
             ))}
          </div>

          {/* Demo Section (Dark Bar) */}
          <div className="demo-strip">
              <div className="jackpot-line">JACKPOT 0 / 1000</div>
              <div className="demo-inner" onClick={() => { setActiveRoom({type: 'CASUAL', price: 10}); setSelectedCards([]); setView('SELECT'); }}>
                 <div className="c-bet">
                    <div className="amt white">FREE</div>
                    <div className="unit white">DEMO</div>
                 </div>
                 <div className="c-win">
                    <Play size={20} className="white" />
                    <div className="win-content">
                       <div className="win-num white">Practice Mode</div>
                       <div className="win-sub white op">No real money</div>
                    </div>
                 </div>
                 <div className="c-action h">
                    <button className="btn-open">OPEN</button>
                    <button className="btn-try-gold">TRY</button>
                 </div>
              </div>
          </div>

          {/* Spin Games Section */}
          <div className="section-title-bar mt">
             <Dices size={16} className="icon gold" />
             <span>SPIN GAMES</span>
          </div>

          <div className="table-header-labels">
             <div className="h-l">BET</div>
             <div className="h-l c">WIN/PLAYER</div>
             <div className="h-l r">STATUS & JOIN</div>
          </div>

          <div className="games-stack">
             {[10, 20, 50, 100].map((price, idx) => (
                <div key={idx} className="row-wrapper">
                   {idx > 0 && <div className="jackpot-line">JACKPOT 0 / 1000</div>}
                   <div className="buna-row">
                      <div className="c-bet">
                         <div className="amt">{price}</div>
                         <div className="unit">ETB</div>
                      </div>
                      <div className="c-win">
                         <Trophy size={18} className="gold-icon" />
                         <div className="win-content">
                            <div className="win-num gold">0</div>
                            <div className="win-sub">0 players</div>
                         </div>
                      </div>
                      <div className="c-action">
                         <div className="badge-col">
                            <span className="b-active">ACTIVE 0</span>
                            <span className="b-ready">READY</span>
                         </div>
                         <div className="btn-box">
                            <span className="bonus-pill">BONUS</span>
                            <button className="join-btn spin">JOIN</button>
                         </div>
                      </div>
                   </div>
                </div>
             ))}
          </div>

          <Navbar />
        </div>
      )}

      {view === 'SELECT' && activeRoom && (
        <div className="view-fade">
          <div className="header-nav-pro">
             <button className="back-btn" onClick={() => setView('LOBBY')}><ChevronLeft size={24} /></button>
             <div className="header-title">
                <h1>Pick Cartelas</h1>
                <p>{activeRoom.type} • {activeRoom.price} ETB</p>
             </div>
          </div>
          
          <div className="select-stats">
             <div className="stat-pill"><span className="l">Wallet</span><span className="v">{(wallet?.balance || 0).toFixed(0)}</span></div>
             <div className="stat-pill"><span className="l">Selected</span><span className="v">{selectedCards.length}/3</span></div>
             <div className="stat-pill gold-pill"><span className="l">Total</span><span className="v">{selectedCards.length * activeRoom.price}</span></div>
          </div>

          <div className="grid-area">
            <div className="card-grid-100">
              {Array.from({length: 100}, (_,i)=>i+1).map(n => (
                <div 
                  key={n} 
                  className={`grid-cell ${selectedCards.includes(n)?'active':''}`} 
                  onClick={() => handleToggleCard(n)}
                >
                  {selectedCards.includes(n) && <CheckCircle2 size={10} className="check-badge" />}
                  {n}
                </div>
              ))}
            </div>
          </div>

          <div className="action-bar-fixed">
             <div className="preview-row">
                {selectedCards.map(id => (
                  <div key={id} className="mini-pattern">
                     <div className="p-num">#{id}</div>
                     <div className="p-grid">
                        {PREDEFINED_CARDS[id]?.map((row, ri) => row.map((n, ci) => (
                          <div key={`${ri}-${ci}`} className={`p-cell ${n===0?'f':''}`}>
                            {n===0 ? <Star size={6} fill="#6F4E37" /> : n}
                          </div>
                        )))}
                     </div>
                  </div>
                ))}
             </div>
             <button className={`btn-go ${joining||!selectedCards.length?'locked':''}`} onClick={handleJoinGame} disabled={joining||!selectedCards.length}>
               <Play size={20} />
               <span>{joining ? '...' : `JOIN WITH ${selectedCards.length} CARDS`}</span>
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
        .buna-bunker { min-height: 100vh; background: #F5ECD7; color: #5C3D1E; padding-bottom: 90px; }
        .view-fade { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* TOP NAV */
        .top-nav-pro { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #6F4E37; color: white; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .nav-left { display: flex; align-items: center; gap: 6px; }
        .live-dot { width: 8px; height: 8px; background: #4ade80; border-radius: 50%; box-shadow: 0 0 8px #4ade80; }
        .live-txt { color: #F5ECD7; font-size: 12px; font-weight: 800; opacity: 0.8; }
        .pulse { animation: pulse 2s infinite; }
        .nav-right { display: flex; gap: 15px; }
        .stat-item { display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 900; color: white; }
        .gold { color: #facc15; }
        .lbl { opacity: 0.6; font-size: 11px; }

        /* HEADER BARS */
        .section-title-bar { background: #F5ECD7; padding: 12px 16px; display: flex; align-items: center; gap: 8px; font-weight: 900; color: #C98A1A; font-size: 14px; }
        .mt { margin-top: 10px; }
        .table-header-labels { display: grid; grid-template-columns: 70px 1fr 130px; padding: 0 16px 8px; color: #C98A1A; font-size: 10px; font-weight: 900; opacity: 0.6; }
        .h-l.c { text-align: center; }
        .h-l.r { text-align: right; }

        /* ROWS */
        .games-stack { padding: 0 10px; }
        .buna-row { display: grid; grid-template-columns: 70px 1fr 130px; padding: 12px; background: white; border-radius: 12px; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .jackpot-line { text-align: center; font-size: 9px; font-weight: 900; color: #6F4E37; padding: 6px 0; opacity: 0.4; letter-spacing: 1px; }
        
        .c-bet .amt { font-size: 26px; font-weight: 900; color: #6F4E37; line-height: 1; }
        .c-bet .amt.white { color: white; }
        .c-bet .unit { font-size: 10px; font-weight: 800; color: #6F4E37; opacity: 0.6; }
        .c-bet .unit.white { color: white; opacity: 0.8; }
        
        .c-win { display: flex; align-items: center; gap: 10px; padding-left: 10px; }
        .win-num { font-size: 22px; font-weight: 900; }
        .win-num.gold { color: #C98A1A; }
        .win-num.white { color: white; font-size: 18px; }
        .win-sub { font-size: 10px; opacity: 0.5; font-weight: 700; }
        .win-sub.white { color: white; opacity: 0.9; }
        .op { opacity: 0.7; }
        
        .c-action { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .c-action.h { flex-direction: row; align-items: center; justify-content: flex-end; gap: 6px; }
        .badge-col { display: flex; gap: 4px; }
        .b-active { background: #3b82f6; color: white; font-size: 8px; font-weight: 900; padding: 2px 6px; border-radius: 4px; }
        .b-ready { background: #22c55e; color: white; font-size: 8px; font-weight: 900; padding: 2px 6px; border-radius: 4px; }
        
        .btn-box { position: relative; }
        .bonus-pill { position: absolute; top: -14px; right: 0; background: #facc15; color: #6F4E37; font-size: 7px; font-weight: 900; padding: 2px 6px; border-radius: 4px; border: 1px solid #6F4E37; }
        .join-btn { background: #22c55e; color: white; border: none; padding: 10px 24px; border-radius: 12px; font-weight: 900; font-size: 15px; box-shadow: 0 4px 0 #16a34a; cursor: pointer; }
        .join-btn:active { transform: translateY(2px); box-shadow: none; }
        .join-btn.spin { background: #8b5cf6; box-shadow: 0 4px 0 #7c3aed; }

        /* DEMO STRIP */
        .demo-strip { margin: 10px 0; }
        .demo-inner { margin: 0 10px; display: grid; grid-template-columns: 70px 1fr 130px; padding: 15px 12px; background: #6F4E37; border-radius: 12px; align-items: center; cursor: pointer; }
        .btn-open { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; font-size: 10px; font-weight: 900; padding: 6px 12px; border-radius: 8px; }
        .btn-try-gold { background: #facc15; color: #6F4E37; border: none; padding: 10px 18px; border-radius: 10px; font-weight: 900; font-size: 13px; }

        /* SELECTION */
        .header-nav-pro { display: flex; align-items: center; gap: 15px; padding: 16px; background: #6F4E37; color: white; }
        .back-btn { background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 12px; }
        .header-title h1 { font-size: 18px; font-weight: 900; margin: 0; }
        .header-title p { font-size: 11px; opacity: 0.7; margin: 0; }
        .select-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 12px; }
        .stat-pill { background: white; border-radius: 12px; padding: 8px; text-align: center; }
        .stat-pill .l { font-size: 8px; font-weight: 800; opacity: 0.5; display: block; }
        .stat-pill .v { font-size: 14px; font-weight: 900; color: #6F4E37; }
        .gold-pill { background: #facc15; }
        .grid-area { padding: 0 10px; margin-bottom: 120px; }
        .card-grid-100 { display: grid; grid-template-columns: repeat(10, 1fr); gap: 5px; }
        .grid-cell { aspect-ratio: 1; background: white; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900; position: relative; border: 1px solid rgba(0,0,0,0.05); }
        .grid-cell.active { background: #6F4E37; color: white; }
        .check-badge { position: absolute; top: -3px; right: -3px; color: #22c55e; background: white; border-radius: 50%; }
        .action-bar-fixed { position: fixed; bottom: 0; left: 0; right: 0; background: #6F4E37; padding: 10px 15px 30px; border-top: 1px solid rgba(255,255,255,0.1); display:flex; flex-direction:column; gap:10px; }
        .preview-row { display:flex; gap:8px; overflow-x:auto; padding-bottom:5px; }
        .mini-pattern { background:#F5ECD7; border-radius:8px; padding:5px; width:70px; flex-shrink:0; }
        .p-num { font-size:8px; font-weight:900; text-align:center; color:#6F4E37; margin-bottom:2px; }
        .p-grid { display:grid; grid-template-columns:repeat(5, 1fr); gap:1px; }
        .p-cell { aspect-ratio:1; background:white; font-size:5px; display:flex; align-items:center; justify-content:center; font-weight:900; }
        .p-cell.f { background:#FFF0D0; }
        .btn-go { width: 100%; padding: 16px; background: #22c55e; color: white; border: none; border-radius: 14px; font-weight: 900; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 5px 0 #16a34a; }

        @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
