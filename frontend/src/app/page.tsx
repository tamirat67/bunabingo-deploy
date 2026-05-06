'use client';
import { useEffect, useState } from 'react';
import { getRooms, getWallet, getMe, register } from '../lib/api';
import Navbar from '../components/Navbar';
import Splash from '../components/Splash';
import { useRouter } from 'next/navigation';
import { useToast } from '../components/Toast';
import { Target, Trophy, Play, Dices, Gift, Wallet, Zap } from 'lucide-react';

interface Room {
  id: string;
  type: 'CASUAL' | 'STANDARD' | 'JACKPOT' | 'VIP';
  ticketPrice: string;
  currentPlayers: number;
}

// Global flag to ensure splash only shows once per session
let hasShownSplash = false;

export default function LobbyPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(!hasShownSplash);
  const router = useRouter();
  const { show } = useToast();

  const loadData = async (retryCount = 0) => {
    try {
      let u;
      try {
        u = await getMe();
      } catch (err: any) {
        if (err.response?.status === 401) {
          const twa = (window as any).Telegram?.WebApp;
          const startParam = twa ? new URLSearchParams(twa.initData).get('start_param') : null;
          u = await register({ phoneNumber: '', referredById: startParam || undefined });
        } else {
          throw err;
        }
      }

      if (u) {
        const [r, w] = await Promise.all([getRooms(), getWallet()]);
        setRooms(r);
        setWallet(w);
      }
    } catch (err: any) {
      console.error('Lobby load failed', err);
      if (retryCount < 5) {
        setTimeout(() => loadData(retryCount + 1), 2000);
      }
    } finally {
      if (retryCount === 0 || rooms.length > 0) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleJoin = (type: string, price: number) => {
    // Hard navigation is more reliable in Telegram webviews
    window.location.href = `/tickets/select?type=${type}&price=${price}`;
  };

  const roomConfig = [
    { type: 'CASUAL', price: 10, label: 'Casual' },
    { type: 'STANDARD', price: 20, label: 'Standard' },
    { type: 'PRO', price: 50, label: 'Pro' },
    { type: 'JACKPOT', price: 100, label: 'Jackpot' },
  ];

  return (
    <div className="lobby-container">
      {showSplash && <Splash isLoading={loading} onFinish={() => {
        setShowSplash(false);
        hasShownSplash = true;
      }} />}
      
      <div className="lobby-nav-top">
        <div className="top-left">
           <span className="live-dot pulse"></span>
           <span className="live-txt">Live</span>
        </div>
        <div className="top-right">
           <div className="top-stat">
              <Gift size={16} className="gold-icon" />
              <span className="lbl">Bonus:</span>
              <span className="val yellow">0.00</span>
           </div>
           <div className="top-stat">
              <Wallet size={16} className="gold-icon" />
              <span className="lbl">Balance:</span>
              <span className="val">{(wallet?.balance || 0).toFixed(2)}</span>
           </div>
        </div>
      </div>

      <div className="section-header-simple">
        <Target size={18} className="icon-coffee" />
        <span>BINGO GAMES</span>
      </div>

      <div className="table-headers">
        <div className="h-bet">BET</div>
        <div className="h-win">WIN/PLAYER</div>
        <div className="h-status">STATUS & JOIN</div>
      </div>

      <div className="rooms-stack">
        {roomConfig.map((room, idx) => (
          <div key={`bingo-${room.type}`} className="room-item-wrapper">
            {idx > 0 && <div className="jackpot-divider">JACKPOT 0 / 1000</div>}
            <div className="room-row-simple">
              <div className="col-bet-simple">
                <div className="v">{room.price}</div>
                <div className="l">ETB</div>
                <div className="room-tag">{room.label}</div>
              </div>
              
              <div className="col-win-simple">
                <Trophy size={20} className="trophy-gold" />
                <div className="win-info">
                   <div className="v yellow">{room.price * 8}</div>
                   <div className="p">0 players</div>
                </div>
              </div>

              <div className="col-action-simple">
                <div className="badges-stack">
                  <div className="badge-active">ACTIVE 0</div>
                  <div className="badge-ready">READY</div>
                </div>
                <button className="btn-join-simple" onClick={() => handleJoin(room.type, room.price)}>JOIN</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* DEMO ROW */}
      <div className="demo-section-simple">
        <div className="jackpot-divider">JACKPOT 0 / 1000</div>
        <div className="demo-row-simple" onClick={() => handleJoin('CASUAL', 0)}>
           <div className="demo-left">
              <div className="f">FREE</div>
              <div className="d">DEMO</div>
           </div>
           <div className="demo-mid">
              <Play size={18} className="p-icon" />
              <div className="m-info">
                 <div className="t">Practice Mode</div>
                 <div className="s">No real money</div>
              </div>
           </div>
           <div className="demo-right">
              <button className="btn-open-mini">OPEN</button>
              <button className="btn-try-mini">TRY</button>
           </div>
        </div>
      </div>

      <div className="section-header-simple mt-20">
        <Dices size={18} className="icon-coffee" />
        <span>SPIN GAMES</span>
      </div>

      <div className="rooms-stack">
        {roomConfig.map((room, idx) => (
          <div key={`spin-${room.type}`} className="room-item-wrapper">
             {idx > 0 && <div className="jackpot-divider">JACKPOT 0 / 1000</div>}
             <div className="room-row-simple">
                <div className="col-bet-simple">
                  <div className="v">{room.price}</div>
                  <div className="l">ETB</div>
                </div>
                <div className="col-win-simple">
                  <Trophy size={20} className="trophy-muted" />
                  <div className="win-info">
                     <div className="v">0</div>
                     <div className="p">0 players</div>
                  </div>
                </div>
                <div className="col-action-simple">
                  <div className="badges-stack">
                    <div className="badge-active">ACTIVE 0</div>
                    <div className="badge-ready">READY</div>
                  </div>
                  <button className="btn-join-simple outline" onClick={() => show('Coming soon!', 'info')}>JOIN</button>
                </div>
             </div>
          </div>
        ))}
      </div>

      <Navbar />

      <style jsx>{`
        .lobby-container { min-height: 100vh; background: var(--bg-main); padding-bottom: 100px; color: var(--text-main); transition: all 0.3s; }
        
        .lobby-nav-top { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--bg-nav); color: white; border-bottom: 1px solid var(--border-light); }
        .top-left { display: flex; align-items: center; gap: 6px; }
        .live-dot { width: 8px; height: 8px; background: #4ade80; border-radius: 50%; }
        .live-txt { font-size: 12px; font-weight: 800; opacity: 0.8; }
        .pulse { animation: pulse 2s infinite; }
        
        .top-right { display: flex; gap: 15px; }
        .top-stat { display: flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 900; }
        .gold-icon { color: #facc15; opacity: 0.8; }
        .yellow { color: #facc15; }
        .lbl { opacity: 0.6; font-size: 11px; }

        .section-header-simple { padding: 20px 16px 10px; display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 900; color: var(--gold-accent); letter-spacing: 0.5px; }
        .icon-coffee { color: var(--gold-accent); }
        .mt-20 { margin-top: 10px; }
        
        .table-headers { display: grid; grid-template-columns: 80px 1fr 120px; padding: 0 16px 8px; font-size: 11px; font-weight: 800; opacity: 0.4; }
        
        .room-row-simple { display: grid; grid-template-columns: 80px 1fr 120px; padding: 16px; align-items: center; border-bottom: 1px solid var(--border-light); background: var(--bg-card); }
        .col-bet-simple { text-align: left; }
        .col-bet-simple .v { font-size: 28px; font-weight: 900; line-height: 1; color: var(--text-main); }
        .col-bet-simple .l { font-size: 10px; font-weight: 800; opacity: 0.6; }
        .room-tag { font-size: 9px; font-weight: 900; color: var(--gold-accent); text-transform: uppercase; margin-top: 4px; }

        .col-win-simple { display: flex; align-items: center; gap: 10px; padding: 0 10px; }
        .win-info .v { font-size: 20px; font-weight: 900; line-height: 1; }
        .win-info .p { font-size: 10px; opacity: 0.5; font-weight: 700; }
        .trophy-gold { color: #D4AF37; }
        .trophy-muted { color: #ccc; }

        .col-action-simple { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
        .badges-stack { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .badge-active { background: #3b82f6; color: white; font-size: 8px; font-weight: 900; padding: 2px 6px; border-radius: 4px; }
        .badge-ready { background: var(--jackpot-bg); color: #22c55e; font-size: 9px; font-weight: 900; padding: 4px 8px; border-radius: 6px; }

        .btn-join-simple { background: #22c55e; color: white; border: none; padding: 10px 18px; border-radius: 12px; font-weight: 900; font-size: 14px; cursor: pointer; box-shadow: 0 4px 0 #16a34a; }
        .btn-join-simple.outline { background: transparent; color: #22c55e; border: 2px solid #22c55e; box-shadow: none; padding: 8px 16px; }
        .btn-join-simple:active { transform: translateY(2px); box-shadow: none; }

        .jackpot-divider { background: var(--jackpot-bg); color: var(--text-main); font-size: 9px; font-weight: 900; text-align: center; padding: 3px; letter-spacing: 1px; border-top: 1px solid var(--border-light); border-bottom: 1px solid var(--border-light); opacity: 0.8; }

        /* DEMO SIMPLE */
        .demo-row-simple { display: flex; align-items: center; justify-content: space-between; padding: 20px 16px; background: var(--bg-nav); color: white; cursor: pointer; border-bottom: 1px solid var(--border-light); }
        .demo-left .f { font-size: 24px; font-weight: 900; line-height: 1; }
        .demo-left .d { font-size: 10px; opacity: 0.6; letter-spacing: 2px; }
        .demo-mid { display: flex; align-items: center; gap: 10px; }
        .p-icon { opacity: 0.5; color: var(--gold-accent); }
        .m-info .t { font-size: 15px; font-weight: 900; }
        .m-info .s { font-size: 10px; opacity: 0.6; font-weight: 700; }
        .demo-right { display: flex; gap: 6px; }
        .btn-open-mini { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 6px 12px; border-radius: 8px; font-size: 10px; font-weight: 900; }
        .btn-try-mini { background: var(--gold-accent); border: none; color: black; padding: 6px 12px; border-radius: 8px; font-size: 10px; font-weight: 900; box-shadow: 0 4px 0 #b8962f; }

        @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
