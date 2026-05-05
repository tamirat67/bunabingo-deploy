'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getMe, joinGame } from '../../../lib/api';
import { ChevronLeft, RefreshCw, Play, Wallet, Trophy, Target, Zap } from 'lucide-react';

function TicketContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomType = searchParams.get('type') || 'STANDARD';
  const ticketPrice = searchParams.get('price') || '10';

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [joining, setJoining] = useState(false);
  const [occupiedCards, setOccupiedCards] = useState<number[]>([10, 42, 55, 78, 91]); 
  const [jackpot, setJackpot] = useState(808);

  const loadUser = async () => {
    try {
      const u = await getMe();
      setUser(u);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const handleJoin = async () => {
    if (!selectedCard || joining) return;
    setJoining(true);
    try {
      const res = await joinGame(roomType, selectedCard);
      router.push(`/game?id=${res.gameId}`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to join game');
    } finally {
      setJoining(false);
    }
  };

  const isLowBalance = (user?.wallet?.balance || 0) < Number(ticketPrice);

  if (loading) return <div className="loading"><div className="spinner" /><span>PREPARING CARTELAS...</span></div>;

  return (
    <div className="bingo-selection-container">
      {/* Top Header */}
      <div className="top-header-nav">
        <button className="btn-back-nav" onClick={() => router.push('/')}>
          <ChevronLeft size={24} />
        </button>
        <div className="title-stack">
          <h1>Select Cartela</h1>
          <p>{roomType} • Stake {ticketPrice}</p>
        </div>
      </div>

      {/* Stats Header Row (Addis Style) */}
      <div className="stats-capsule-row">
        <div className="capsule">
          <div className="l">Wallet</div>
          <div className="v">{(user?.wallet?.balance || 0).toFixed(0)}</div>
        </div>
        <div className="capsule">
          <div className="l">Bonus</div>
          <div className="v">0</div>
        </div>
        <div className="capsule">
          <div className="l">Active Game</div>
          <div className="v">2</div>
        </div>
        <div className="capsule active-stake">
          <div className="l">Stake</div>
          <div className="v">{ticketPrice}</div>
        </div>
      </div>

      {/* Jackpot Bar */}
      <div className="jackpot-card">
        <div className="jack-top">
          <div className="label"><Zap size={14} className="zap" /> JACKPOT</div>
          <div className="count">{jackpot} / 1000</div>
        </div>
        <div className="progress-track">
          <div className="progress-bar" style={{ width: `${(jackpot/1000)*100}%` }}></div>
        </div>
      </div>

      {/* Low Balance Alert */}
      {isLowBalance && (
        <div className="topup-alert-box">
          <p>⚠️ Please top up your wallet. If you already have and are still seeing this, please refresh the page.</p>
        </div>
      )}

      {/* 1-100 Cartela Grid */}
      <div className="grid-scroll-area">
        <div className="cartela-100-grid">
          {Array.from({ length: 100 }, (_, i) => i + 1).map((num) => {
            const isOccupied = occupiedCards.includes(num);
            const isSelected = selectedCard === num;
            return (
              <div 
                key={num} 
                className={`cartela-item ${isOccupied ? 'held' : ''} ${isSelected ? 'chosen' : ''}`}
                onClick={() => !isOccupied && setSelectedCard(num)}
              >
                {num}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Footer */}
      <div className="selection-footer-bar">
        <button className="btn-footer-refresh" onClick={loadUser}>
          <RefreshCw size={18} />
          <span>Refresh</span>
        </button>
        <button 
          className={`btn-footer-start ${(!selectedCard || joining || isLowBalance) ? 'locked' : ''}`}
          onClick={handleJoin}
          disabled={!selectedCard || joining || isLowBalance}
        >
          <Play size={18} />
          <span>{joining ? 'JOINING...' : 'START GAME'}</span>
        </button>
      </div>

      <style jsx>{`
        .bingo-selection-container { min-height: 100vh; background: var(--bg-main); color: var(--text-main); padding-bottom: 120px; transition: 0.3s; }
        
        .top-header-nav { display: flex; align-items: center; padding: 16px; gap: 16px; background: var(--bg-nav); color: white; }
        .btn-back-nav { background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .title-stack h1 { font-size: 18px; font-weight: 900; margin: 0; }
        .title-stack p { font-size: 11px; opacity: 0.7; font-weight: 700; margin: 0; text-transform: uppercase; }

        .stats-capsule-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 16px; }
        .capsule { background: var(--bg-card); color: var(--text-main); border-radius: 14px; padding: 10px 4px; text-align: center; border: 1.5px solid var(--border-light); box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        .capsule.active-stake { border-color: var(--gold-accent); background: var(--bg-nav); color: white; }
        .capsule .l { font-size: 8px; font-weight: 800; text-transform: uppercase; opacity: 0.5; margin-bottom: 2px; }
        .capsule .v { font-size: 15px; font-weight: 900; }

        .jackpot-card { background: var(--bg-card); margin: 0 16px 16px; border-radius: 16px; padding: 12px; border: 1px solid var(--border-light); }
        .jack-top { display: flex; justify-content: space-between; font-size: 11px; font-weight: 900; margin-bottom: 6px; }
        .jack-top .label { display: flex; align-items: center; gap: 4px; color: var(--gold-accent); }
        .progress-track { height: 8px; background: var(--jackpot-bg); border-radius: 99px; overflow: hidden; }
        .progress-bar { height: 100%; background: var(--gold-accent); border-radius: 99px; box-shadow: 0 0 10px var(--gold-accent); }

        .topup-alert-box { background: rgba(154, 3, 30, 0.1); color: var(--red); margin: 0 16px 16px; padding: 14px; border-radius: 14px; border: 1px solid rgba(154, 3, 30, 0.2); text-align: center; }
        .topup-alert-box p { font-size: 12px; font-weight: 800; margin: 0; line-height: 1.5; }

        .grid-scroll-area { padding: 0 12px; }
        .cartela-100-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 6px; }
        .cartela-item { 
          aspect-ratio: 1; background: var(--bg-card); border: 1.5px solid var(--border-light); border-radius: 8px; 
          display: flex; align-items: center; justify-content: center; 
          font-size: 13px; font-weight: 900; color: var(--text-main); cursor: pointer;
          transition: 0.2s;
        }
        .cartela-item.held { background: #6F4E37; color: white; opacity: 0.5; cursor: not-allowed; border: none; }
        .cartela-item.chosen { background: #22c55e; color: white; border-color: #22c55e; transform: scale(1.1); z-index: 2; box-shadow: 0 0 15px rgba(34, 197, 94, 0.4); }
        
        .selection-footer-bar { position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg-main); padding: 20px 16px; display: flex; gap: 12px; border-top: 1px solid var(--border-light); }
        .btn-footer-refresh { flex: 1; background: #3b82f6; color: white; border: none; border-radius: 14px; padding: 16px; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 5px 0 #2563eb; cursor: pointer; }
        .btn-footer-start { flex: 1; background: #22c55e; color: white; border: none; border-radius: 14px; padding: 16px; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 5px 0 #16a34a; cursor: pointer; }
        .btn-footer-start.locked { opacity: 0.5; filter: grayscale(1); box-shadow: none; transform: translateY(2px); cursor: not-allowed; }
        .btn-footer-refresh:active, .btn-footer-start:not(.locked):active { transform: translateY(2px); box-shadow: none; }
      `}</style>
    </div>
  );
}

export default function TicketSelectPage() {
  return (
    <Suspense fallback={<div className="loading"><div className="spinner" /><span>LOADING CARDS...</span></div>}>
      <TicketContent />
    </Suspense>
  );
}
