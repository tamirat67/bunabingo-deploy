'use client';
import { useEffect, useState } from 'react';
import { getRooms, getWallet, getMe } from '../lib/api';
import Navbar from '../components/Navbar';
import Onboarding from '../components/Onboarding';
import { useRouter } from 'next/navigation';
import { useToast } from '../components/Toast';
import { Target, Trophy, Play, Dices, Gift, Wallet, Zap, Sparkles } from 'lucide-react';

interface Room {
  id: string;
  type: 'CASUAL' | 'STANDARD' | 'JACKPOT' | 'VIP';
  ticketPrice: string;
  currentPlayers: number;
}

export default function LobbyPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const router = useRouter();
  const { show } = useToast();

  const loadData = async () => {
    try {
      const [u] = await Promise.all([getMe()]);
      if (!u || !u.id) {
        setShowOnboarding(true);
      } else {
        const [r, w] = await Promise.all([getRooms(), getWallet()]);
        setRooms(r);
        setWallet(w);
        setShowOnboarding(false);
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        setShowOnboarding(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleJoin = (type: string, price: string) => {
    router.push(`/tickets/select?type=${type}&price=${price}`);
  };

  if (loading) return <div className="loading"><div className="spinner" /><span>BUNA BINGO...</span></div>;

  return (
    <div className="lobby-container">
      {showOnboarding && <Onboarding onSuccess={loadData} />}

      <div className="lobby-nav">
        <div className="nav-left">
          <span className="live-dot pulse"></span>
          <span className="live-lbl">Live</span>
        </div>
        <div className="nav-title">BUNA BINGO</div>
        <div className="nav-right">
          <div className="nav-stat">
             <Gift size={16} className="yellow" />
             <span className="val">0</span>
          </div>
          <div className="nav-stat">
             <Wallet size={16} />
             <span className="val">{Number(wallet?.balance || 0).toFixed(0)}</span>
          </div>
        </div>
      </div>

      <div className="section-header">
        <Target size={20} className="coffee-icon" />
        <span className="title">BINGO GAMES</span>
      </div>

      <div className="column-headers">
        <span>BET</span>
        <span>WIN/PLAYER</span>
        <span>STATUS & JOIN</span>
      </div>

      <div className="game-list">
        {[10, 20, 50, 100].map((price) => (
          <div key={`bingo-${price}`}>
            <div className="room-row">
              <div className="col-bet">
                <div className="v">{price}</div>
                <div className="l">ETB</div>
              </div>
              <div className="col-win">
                <div className="win-main">
                  <Trophy size={28} className="trophy-gold" />
                  <div className="win-stack">
                    <div className="win-val">{price * 8}</div>
                    <div className="win-count">0 players</div>
                  </div>
                </div>
              </div>
              <div className="col-status">
                <div className="badge active">ACTIVE 0</div>
                <button className="btn-join" onClick={() => handleJoin('STANDARD', price.toString())}>JOIN</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* INDEPENDENT CENTERED DEMO SECTION */}
      <div className="demo-center-section">
        <div className="demo-card">
          <div className="demo-card-inner">
            <div className="demo-header">
              <Sparkles size={18} className="sparkle" />
              <span>FREE PRACTICE MODE</span>
              <Sparkles size={18} className="sparkle" />
            </div>
            <h2 className="demo-title">Master the Game</h2>
            <p className="demo-desc">Play a full bingo match for free and learn the winning patterns.</p>
            <button className="btn-join-demo" onClick={() => handleJoin('CASUAL', '0')}>
              <Zap size={18} /> START FREE DEMO
            </button>
          </div>
        </div>
      </div>

      <div className="section-header sp-mt">
        <Dices size={20} className="coffee-icon" />
        <span className="title">SPIN GAMES</span>
      </div>

      <div className="game-list">
        {[10, 20, 50, 100].map((price) => (
          <div key={`spin-${price}`}>
            <div className="room-row">
              <div className="col-bet">
                <div className="v">{price}</div>
                <div className="l">ETB</div>
              </div>
              <div className="col-win">
                <div className="win-main">
                  <Trophy size={28} className="trophy-muted" />
                  <div className="win-stack">
                    <div className="win-val">0</div>
                    <div className="win-count">0 players</div>
                  </div>
                </div>
              </div>
              <div className="col-status">
                <div className="badge active">ACTIVE 0</div>
                <button className="btn-join outline" onClick={() => show(`Spin coming soon!`, 'info')}>JOIN</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Navbar />

      <style jsx>{`
        .lobby-container { min-height: 100vh; background: #F5E6BE; padding-bottom: 90px; color: #000; }
        
        .lobby-nav { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #6F4E37; color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .nav-left { display: flex; align-items: center; gap: 6px; }
        .live-dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; }
        .pulse { animation: pulse 2s infinite; }
        .nav-title { font-weight: 900; letter-spacing: 1.5px; font-size: 14px; text-transform: uppercase; }

        .nav-right { display: flex; gap: 14px; }
        .nav-stat { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 900; }
        .yellow { color: #facc15; }

        .section-header { padding: 24px 16px 12px; display: flex; align-items: center; gap: 8px; }
        .section-header .title { font-size: 16px; font-weight: 900; color: #6F4E37; letter-spacing: 0.5px; }
        .coffee-icon { color: #6F4E37; }
        .sp-mt { margin-top: 10px; }

        .column-headers { display: grid; grid-template-columns: 80px 1fr 100px; padding: 0 16px 8px; font-size: 11px; font-weight: 800; opacity: 0.5; color: #000; }

        .room-row { display: grid; grid-template-columns: 80px 1fr 100px; background: #FFF9E6; padding: 14px 16px; align-items: center; border-bottom: 1px solid #E6D5A8; }
        
        .col-bet { text-align: center; border-right: 1px solid #E6D5A8; color: #4B3621; }
        .col-bet .v { font-size: 26px; font-weight: 900; line-height: 1; }
        .col-bet .l { font-size: 10px; opacity: 0.8; font-weight: 800; margin-top: 2px; }

        .col-win { padding: 0 16px; }
        .win-main { display: flex; align-items: center; gap: 12px; }
        .trophy-gold { color: #D4AF37; }
        .trophy-muted { color: #ccc; }
        .win-stack { display: flex; flex-direction: column; }
        .win-val { font-size: 22px; font-weight: 900; color: #000; line-height: 1.1; }
        .win-count { font-size: 11px; opacity: 0.6; font-weight: 700; }

        .col-status { display: flex; flex-direction: column; align-items: center; gap: 5px; }
        .badge.active { background: #22c55e; color: white; font-size: 9px; font-weight: 900; padding: 2px 8px; border-radius: 99px; }
        
        .btn-join { width: 100%; border: none; padding: 9px; border-radius: 8px; font-weight: 900; font-size: 14px; cursor: pointer; transition: all 0.2s; background: #22c55e; color: white; box-shadow: 0 4px 0 #16a34a; }
        .btn-join.outline { background: transparent; color: #22c55e; border: 2.5px solid #22c55e; box-shadow: none; padding: 6.5px; }
        .btn-join:active { transform: translateY(2px); box-shadow: none; }

        /* DEMO CENTERED STYLES */
        .demo-center-section { padding: 24px 16px; }
        .demo-card { background: #6F4E37; border-radius: 28px; padding: 24px; box-shadow: 0 15px 35px rgba(111, 78, 55, 0.25); border: 2px solid #E6D5A8; }
        .demo-card-inner { text-align: center; color: #F5E6BE; }
        .demo-header { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 11px; font-weight: 900; letter-spacing: 2px; opacity: 0.6; margin-bottom: 12px; }
        .sparkle { color: #facc15; }
        .demo-title { font-size: 24px; font-weight: 900; margin-bottom: 8px; }
        .demo-desc { font-size: 13px; font-weight: 700; opacity: 0.7; margin-bottom: 24px; max-width: 250px; margin-left: auto; margin-right: auto; line-height: 1.4; }
        .btn-join-demo { width: 100%; background: #22c55e; color: white; border: none; padding: 16px; border-radius: 16px; font-weight: 900; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 6px 0 #16a34a; cursor: pointer; }
        .btn-join-demo:active { transform: translateY(2px); box-shadow: none; }
      `}</style>
    </div>
  );
}
