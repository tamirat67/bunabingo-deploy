'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getMe, joinGame } from '../../../lib/api';
import { PREDEFINED_CARDS } from '../../../lib/predefinedCards';
import { ChevronLeft, RefreshCw, Play, Zap, X, Star, LayoutGrid, CheckCircle2 } from 'lucide-react';

function TicketContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomType = searchParams.get('type') || 'STANDARD';
  const ticketPrice = searchParams.get('price') || '10';

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [joining, setJoining] = useState(false);
  const [occupiedCards, setOccupiedCards] = useState<number[]>([]); 
  const [jackpot, setJackpot] = useState(808);
  const [dismissAlert, setDismissAlert] = useState(false);

  const loadUser = async () => {
    try {
      const u = await getMe();
      setUser(u);
      setDismissAlert(false); 
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const handleToggleCard = (num: number) => {
    setSelectedCards(prev => {
      if (prev.includes(num)) {
        return prev.filter(id => id !== num);
      }
      if (prev.length >= 3) return prev; // Hard limit of 3
      return [...prev, num];
    });
  };

  const handleJoin = async () => {
    if (selectedCards.length === 0 || joining) return;
    setJoining(true);
    try {
      const res = await joinGame(roomType, selectedCards);
      router.push(`/game?id=${res.gameId}`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to join game');
    } finally {
      setJoining(false);
    }
  };

  const totalCost = selectedCards.length * Number(ticketPrice);
  const isLowBalance = (user?.wallet?.balance || 0) < totalCost;

  if (loading) return <div className="loading"><div className="spinner" /><span>PREPARING CARTELAS...</span></div>;

  return (
    <div className="bingo-selection-container">
      {/* Top Header */}
      <div className="top-header-nav">
        <button className="btn-back-nav" onClick={() => router.push('/')}>
          <ChevronLeft size={24} />
        </button>
        <div className="title-stack">
          <h1>Buna Bingo</h1>
          <p>{roomType} • Stake {ticketPrice}</p>
        </div>
      </div>

      {/* Stats Header Row */}
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
          <div className="l">Cards</div>
          <div className="v">{selectedCards.length} / 3</div>
        </div>
        <div className="capsule active-stake">
          <div className="l">Total</div>
          <div className="v">{totalCost}</div>
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
      {isLowBalance && !dismissAlert && (
        <div className="topup-alert-box dismissible">
          <div className="alert-content">
             <p>⚠️ Please top up your wallet. Total cost: {totalCost} ETB.</p>
          </div>
          <button className="btn-dismiss-alert" onClick={() => setDismissAlert(true)}>
             <X size={16} />
          </button>
        </div>
      )}

      {/* 1-100 Cartela Grid */}
      <div className="grid-scroll-area">
        <div className="cartela-100-grid">
          {Array.from({ length: 100 }, (_, i) => i + 1).map((num) => {
            const isOccupied = occupiedCards.includes(num);
            const isSelected = selectedCards.includes(num);
            return (
              <div 
                key={num} 
                className={`cartela-item ${isOccupied ? 'held' : ''} ${isSelected ? 'chosen' : ''}`}
                onClick={() => !isOccupied && handleToggleCard(num)}
              >
                {isSelected && <CheckCircle2 size={10} className="check-badge" />}
                {num}
              </div>
            );
          })}
        </div>
      </div>

      {/* INLINE PREVIEW & ACTION ZONE */}
      <div className="inline-action-zone">
         <div className="preview-column">
            {selectedCards.length > 0 ? (
              <div className="patterns-horizontal-scroll">
                {selectedCards.map((cardId) => {
                  const pattern = PREDEFINED_CARDS[cardId];
                  return (
                    <div key={cardId} className="inline-pattern-box">
                      <div className="pattern-label">#{cardId}</div>
                      <div className="pattern-mini-grid">
                        {pattern?.map((row, ri) => (
                          row.map((num, ci) => (
                            <div key={`${ri}-${ci}`} className={`mini-cell ${num === 0 ? 'free' : ''}`}>
                              {num === 0 ? <Star size={10} fill="var(--gold-accent)" color="var(--gold-accent)" /> : num}
                            </div>
                          ))
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-preview-box">
                 <LayoutGrid size={32} opacity={0.2} />
                 <span>Pick up to 3 cards</span>
              </div>
            )}
         </div>

         <div className="actions-column">
            <button className="btn-refresh-inline" onClick={loadUser}>
              <RefreshCw size={18} />
              <span>Refresh</span>
            </button>
            <button 
              className={`btn-start-inline ${(joining || isLowBalance || selectedCards.length === 0) ? 'locked' : ''}`}
              onClick={handleJoin}
              disabled={joining || isLowBalance || selectedCards.length === 0}
            >
              <Play size={18} />
              <span>{joining ? 'JOINING...' : `JOIN WITH ${selectedCards.length} ${selectedCards.length === 1 ? 'CARD' : 'CARDS'}`}</span>
            </button>
         </div>
      </div>

      <style jsx>{`
        .bingo-selection-container { min-height: 100vh; background: var(--bg-main); color: var(--text-main); padding-bottom: 220px; transition: 0.3s; position: relative; }
        
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

        .topup-alert-box.dismissible { background: rgba(154, 3, 30, 0.1); color: var(--red); margin: 0 16px 16px; padding: 14px; border-radius: 14px; border: 1px solid rgba(154, 3, 30, 0.2); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .alert-content p { font-size: 12px; font-weight: 800; margin: 0; line-height: 1.5; }
        .btn-dismiss-alert { background: rgba(154, 3, 30, 0.1); border: none; color: var(--red); width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }

        .grid-scroll-area { padding: 0 12px; margin-bottom: 20px; }
        .cartela-100-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 6px; }
        .cartela-item { 
          aspect-ratio: 1; background: var(--bg-card); border: 1.5px solid var(--border-light); border-radius: 8px; 
          display: flex; align-items: center; justify-content: center; 
          font-size: 13px; font-weight: 900; color: var(--text-main); cursor: pointer;
          transition: 0.2s; position: relative;
        }
        .check-badge { position: absolute; top: -4px; right: -4px; color: #22c55e; background: white; border-radius: 50%; }
        .cartela-item.held { background: #6F4E37; color: white; opacity: 0.5; cursor: not-allowed; border: none; }
        .cartela-item.chosen { background: var(--gold-accent); color: black; border-color: var(--gold-accent); transform: scale(1.05); z-index: 2; box-shadow: 0 0 15px rgba(212, 175, 55, 0.4); }
        
        /* INLINE ACTION ZONE */
        .inline-action-zone { 
           position: fixed; bottom: 0; left: 0; right: 0; 
           background: var(--bg-main); border-top: 1px solid var(--border-light);
           padding: 12px 16px 24px; display: grid; grid-template-columns: 1fr 150px; gap: 12px;
           box-shadow: 0 -10px 30px rgba(0,0,0,0.05); z-index: 1000;
        }
        
        .preview-column { display: flex; overflow-x: auto; scrollbar-width: none; }
        .preview-column::-webkit-scrollbar { display: none; }
        .patterns-horizontal-scroll { display: flex; gap: 8px; }
        
        .inline-pattern-box { background: var(--bg-card); border: 1.5px solid var(--gold-accent); border-radius: 12px; padding: 8px; width: 110px; flex-shrink: 0; }
        .pattern-label { font-size: 9px; font-weight: 900; text-align: center; margin-bottom: 4px; color: var(--gold-accent); text-transform: uppercase; }
        .pattern-mini-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2px; }
        .mini-cell { aspect-ratio: 1; background: white; border-radius: 2px; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 900; color: #4B3621; border: 1px solid rgba(0,0,0,0.05); }
        .theme-dark .mini-cell { background: #374151; color: #f3f4f6; border-color: #4b5563; }
        .mini-cell.free { background: rgba(212, 175, 55, 0.1); }

        .empty-preview-box { background: var(--bg-card); border-radius: 12px; border: 1.5px dashed var(--border-light); height: 100px; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--text-main); opacity: 0.5; text-align: center; }
        .empty-preview-box span { font-size: 10px; font-weight: 800; padding: 0 10px; }

        .actions-column { display: flex; flex-direction: column; gap: 8px; justify-content: center; }
        .btn-refresh-inline { background: #3b82f6; color: white; border: none; border-radius: 10px; padding: 10px; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 0 #2563eb; cursor: pointer; font-size: 12px; }
        .btn-start-inline { background: #22c55e; color: white; border: none; border-radius: 10px; padding: 14px; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 5px 0 #16a34a; cursor: pointer; font-size: 13px; line-height: 1.2; }
        .btn-start-inline.locked { opacity: 0.5; filter: grayscale(1); box-shadow: none; transform: translateY(2px); cursor: not-allowed; }
        .btn-refresh-inline:active, .btn-start-inline:not(.locked):active { transform: translateY(2px); box-shadow: none; }
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
