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

  const handleOpenSelect = (type: string, price: number) => {
    setActiveRoom({ type, price });
    setSelectedCards([]);
    setView('SELECT');
    window.scrollTo(0, 0);
  };

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
          <div className="section-title">
             <Target size={18} className="icon" />
             <span>BINGO GAMES</span>
          </div>

          <div className="table-header">
             <div className="h-col">BET</div>
             <div className="h-col c">WIN/PLAYER</div>
             <div className="h-col r">STATUS & JOIN</div>
          </div>

          <div className="games-list">
             {rooms.map((room, idx) => (
               <div key={room.id} className="game-row-container">
                  {idx > 0 && <div className="jack-divider">JACKPOT 0 / 1000</div>}
                  <div className="game-row">
                     <div className="col-bet">
                        <div className="amount">{room.ticketPrice}</div>
                        <div className="unit">ETB</div>
                     </div>
                     <div className="col-win">
                        <Trophy size={18} className="gold" />
                        <div className="win-stack">
                           <div className="win-val gold">{Number(room.ticketPrice) * 8}</div>
                           <div className="player-count">0 players</div>
                        </div>
                     </div>
                     <div className="col-status">
                        <div className="badges">
                           <span className="badge-active">ACTIVE 0</span>
                           <span className="badge-ready">READY</span>
                        </div>
                        <div className="btn-wrap">
                           {idx % 2 === 0 && <span className="btn-bonus-tag">BONUS</span>}
                           <button className="btn-join" onClick={() => { setActiveRoom({type: room.type, price: Number(room.ticketPrice)}); setSelectedCards([]); setView('SELECT'); }}>JOIN</button>
                        </div>
                     </div>
                  </div>
               </div>
             ))}
          </div>

          {/* Demo Section */}
          <div className="game-row-container demo-container">
              <div className="jack-divider">PRACTICE ZONE</div>
              <div className="game-row demo-row" onClick={() => { setActiveRoom({type: 'CASUAL', price: 10}); setSelectedCards([]); setView('SELECT'); }}>
                 <div className="col-bet">
                    <div className="amount">FREE</div>
                    <div className="unit">DEMO</div>
                 </div>
                 <div className="col-win">
                    <Play size={20} className="gold" />
                    <div className="win-stack">
                       <div className="win-val">Practice Mode</div>
                       <div className="player-count">No real money</div>
                    </div>
                 </div>
                 <div className="col-status">
                    <button className="btn-open-small">OPEN</button>
                    <button className="btn-try">TRY</button>
                 </div>
              </div>
          </div>

          {/* Spin Games Section */}
          <div className="section-title">
             <Zap size={18} className="icon" />
             <span>SPIN GAMES</span>
          </div>

          <div className="games-list">
             {[10, 20, 50].map((price, idx) => (
                <div key={idx} className="game-row-container">
                   {idx > 0 && <div className="jack-divider">JACKPOT 0 / 1000</div>}
                   <div className="game-row">
                      <div className="col-bet">
                         <div className="amount">{price}</div>
                         <div className="unit">ETB</div>
                      </div>
                      <div className="col-win">
                         <Trophy size={18} className="gold" />
                         <div className="win-stack">
                            <div className="win-val gold">0</div>
                            <div className="player-count">0 players</div>
                         </div>
                      </div>
                      <div className="col-status">
                         <div className="badges">
                            <span className="badge-active">ACTIVE 0</span>
                            <span className="badge-ready">READY</span>
                         </div>
                         <div className="btn-wrap">
                            <span className="btn-bonus-tag">BONUS</span>
                            <button className="btn-join spin-btn">JOIN</button>
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
        .buna-bunker { min-height: 100vh; background: #6F4E37; color: #5C3D1E; padding-bottom: 90px; }
        .view-fade { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* TOP NAV */
        .top-nav-pro { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(0,0,0,0.1); border-bottom: 1px solid rgba(255,255,255,0.1); }
        .nav-left { display: flex; align-items: center; gap: 6px; }
        .live-dot { width: 8px; height: 8px; background: #4ade80; border-radius: 50%; box-shadow: 0 0 8px #4ade80; }
        .live-txt { color: #F5ECD7; font-size: 12px; font-weight: 800; opacity: 0.8; }
        .pulse { animation: pulse 2s infinite; }
        .nav-right { display: flex; gap: 15px; }
        .stat-item { display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 900; color: white; }
        .gold { color: #facc15; }
        .lbl { opacity: 0.6; font-size: 11px; }

        /* SECTION HEADERS */
        .section-title { padding: 20px 16px 12px; display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 900; color: #F5ECD7; text-shadow: 0 1px 2px rgba(0,0,0,0.2); }
        .table-header { display: grid; grid-template-columns: 70px 1fr 130px; padding: 0 16px 8px; color: #F5ECD7; font-size: 10px; font-weight: 900; opacity: 0.6; }
        .h-col.c { text-align: center; }
        .h-col.r { text-align: right; }

        /* GAME ROWS */
        .games-list { padding: 0 10px; }
        .game-row-container { margin-bottom: 8px; }
        .game-row { display: grid; grid-template-columns: 70px 1fr 130px; padding: 14px 12px; background: #F5ECD7; border-radius: 12px; align-items: center; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.2); }
        .jack-divider { text-align: center; font-size: 9px; font-weight: 900; color: #F5ECD7; padding: 4px 0; opacity: 0.5; }
        
        .col-bet .amount { font-size: 24px; font-weight: 900; color: #6F4E37; line-height: 1; }
        .col-bet .unit { font-size: 10px; font-weight: 800; color: #6F4E37; opacity: 0.6; }
        
        .col-win { display: flex; align-items: center; gap: 10px; border-left: 1px solid rgba(111, 78, 55, 0.1); padding-left: 15px; }
        .win-stack .win-val { font-size: 20px; font-weight: 900; color: #6F4E37; }
        .win-stack .player-count { font-size: 10px; color: #6F4E37; opacity: 0.5; font-weight: 700; }
        
        .col-status { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
        .badges { display: flex; gap: 4px; }
        .badge-active { background: #3b82f6; color: white; font-size: 8px; font-weight: 900; padding: 2px 6px; border-radius: 4px; }
        .badge-ready { background: #6F4E37; color: #facc15; font-size: 8px; font-weight: 900; padding: 2px 6px; border-radius: 4px; }
        
        .btn-wrap { position: relative; }
        .btn-bonus-tag { position: absolute; top: -14px; right: 0; background: #facc15; color: #6F4E37; font-size: 7px; font-weight: 900; padding: 2px 6px; border-radius: 4px; border: 1px solid #6F4E37; }
        .btn-join { background: #22c55e; color: white; border: none; padding: 8px 22px; border-radius: 10px; font-weight: 900; font-size: 14px; box-shadow: 0 3px 0 #16a34a; cursor: pointer; }
        .btn-join:active { transform: translateY(2px); box-shadow: none; }
        .spin-btn { background: #8b5cf6; box-shadow: 0 3px 0 #7c3aed; }

        /* DEMO SPECIFIC */
        .demo-container { padding: 0 10px; }
        .demo-row { background: #FFF0D0; border: 1.5px dashed #6F4E37; cursor: pointer; }
        .btn-open-small { background: rgba(111, 78, 55, 0.1); border: 1px solid rgba(111, 78, 55, 0.2); color: #6F4E37; font-size: 10px; font-weight: 900; padding: 4px 10px; border-radius: 6px; margin-right: 5px; }
        .btn-try { background: #4b5563; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 900; font-size: 12px; }

        /* SELECTION VIEW */
        .header-nav-pro { display: flex; align-items: center; gap: 15px; padding: 16px; background: rgba(0,0,0,0.1); color: white; }
        .back-btn { background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 12px; }
        .header-title h1 { font-size: 18px; font-weight: 900; margin: 0; }
        .header-title p { font-size: 11px; opacity: 0.7; margin: 0; }
        
        .select-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 12px; }
        .stat-pill { background: #F5ECD7; border-radius: 12px; padding: 8px; text-align: center; border: 1px solid rgba(0,0,0,0.05); }
        .stat-pill .l { font-size: 8px; font-weight: 800; opacity: 0.5; display: block; }
        .stat-pill .v { font-size: 14px; font-weight: 900; color: #6F4E37; }
        .gold-pill { background: #facc15; border-color: #6F4E37; }

        .grid-area { padding: 0 10px; margin-bottom: 120px; }
        .card-grid-100 { display: grid; grid-template-columns: repeat(10, 1fr); gap: 5px; }
        .grid-cell { aspect-ratio: 1; background: #F5ECD7; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900; position: relative; border: 1px solid rgba(0,0,0,0.05); }
        .grid-cell.active { background: #facc15; color: #6F4E37; border-color: #6F4E37; transform: scale(1.05); z-index: 2; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .check-badge { position: absolute; top: -3px; right: -3px; color: #22c55e; background: white; border-radius: 50%; }

        .action-bar-fixed { position: fixed; bottom: 0; left: 0; right: 0; background: #6F4E37; padding: 10px 15px 30px; border-top: 1px solid rgba(255,255,255,0.1); display:flex; flex-direction:column; gap:10px; }
        .preview-row { display:flex; gap:8px; overflow-x:auto; padding-bottom:5px; }
        .mini-pattern { background:#F5ECD7; border-radius:8px; padding:5px; width:70px; flex-shrink:0; }
        .p-num { font-size:8px; font-weight:900; text-align:center; color:#6F4E37; margin-bottom:2px; }
        .p-grid { display:grid; grid-template-columns:repeat(5, 1fr); gap:1px; }
        .p-cell { aspect-ratio:1; background:white; font-size:5px; display:flex; align-items:center; justify-content:center; font-weight:900; }
        .p-cell.f { background:#FFF0D0; }
        .btn-go { width: 100%; padding: 16px; background: #22c55e; color: white; border: none; border-radius: 14px; font-weight: 900; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 5px 0 #16a34a; }
        .btn-go.locked { opacity: 0.5; box-shadow: none; transform: translateY(2px); }

        @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
