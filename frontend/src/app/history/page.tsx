'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { getHistory, getMyTickets, getMe } from '../../lib/api';
import Navbar from '../../components/Navbar';
import { Trophy, Gamepad2, ChevronLeft, Star, Calendar, ArrowUpRight, TrendingUp } from 'lucide-react';

interface Winner { id: string; winMode: string; prizeAmount: string; paidAt: string; game: { room: { type: string } } }
interface Ticket { id: string; isWinner: boolean; purchasedAt: string; game: { status: string; room: { type: string } } }

const MODE_ICON: Record<string, any> = { 
  ROW: '🔴', COLUMN: '🟡', DIAGONAL: '🟢', FOUR_CORNERS: '🔵', FULL_HOUSE: '💎' 
};

function HistoryContent() {
  const router = useRouter();
  const [wins, setWins] = useState<Winner[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tab, setTab] = useState<'wins' | 'games'>('games');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    Promise.all([getHistory(), getMyTickets(), getMe()])
      .then(([w, t, u]) => { 
        setWins(w); 
        setTickets(t);
        setUser(u);
      })
      .catch(err => console.error('History load failed', err))
      .finally(() => setLoading(false));
  }, []);

  const STATUS_BADGE: Record<string, { label: string; color: string }> = {
    RUNNING:   { label: 'Live',      color: '#22c55e' },
    FINISHED:  { label: 'Finished',  color: 'rgba(255,255,255,0.4)' },
    WAITING:   { label: 'Waiting',   color: 'rgba(255,255,255,0.2)' },
    COUNTDOWN: { label: 'Starting',  color: 'var(--gold-accent)'  },
    CANCELLED: { label: 'Cancelled', color: '#ef4444'   },
  };

  const totalWon = wins.reduce((s, w) => s + Number(w.prizeAmount), 0);
  const winRate = tickets.length ? ((wins.length / tickets.length) * 100).toFixed(0) : 0;

  if (loading) return <div className="loading"><div className="spinner" /><span>LOADING HISTORY...</span></div>;

  return (
    <div className="buna-history-container">
      {/* Header Navigation */}
      <div className="top-header-nav">
        <button className="btn-back-nav" onClick={() => router.push('/')}>
          <ChevronLeft size={24} />
        </button>
        <div className="title-stack">
          <h1>Game History</h1>
          <p>Your Bingo Journey</p>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="history-dashboard">
        <div className="main-stat-card">
           <div className="l"><TrendingUp size={14} /> Total Winnings</div>
           <div className="v">{totalWon.toFixed(0)} <span>ETB</span></div>
           <div className="b">Overall Profit</div>
        </div>
        <div className="mini-stats-grid">
           <div className="mini-capsule">
              <div className="l">Games</div>
              <div className="v">{tickets.length}</div>
           </div>
           <div className="mini-capsule">
              <div className="l">Wins</div>
              <div className="v gold">{wins.length}</div>
           </div>
           <div className="mini-capsule">
              <div className="l">Win Rate</div>
              <div className="v">{winRate}%</div>
           </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="pro-tab-bar">
         <button className={`tab-item ${tab === 'games' ? 'active' : ''}`} onClick={() => setTab('games')}>
            <Gamepad2 size={18} />
            <span>All Games</span>
         </button>
         <button className={`tab-item ${tab === 'wins' ? 'active' : ''}`} onClick={() => setTab('wins')}>
            <Trophy size={18} />
            <span>Wins Only</span>
         </button>
      </div>

      {/* Content Area */}
      <div className="history-list-area">
        {tab === 'games' ? (
          <div className="scroll-list">
            {tickets.length === 0 && <div className="empty-msg">No games recorded yet.</div>}
            {tickets.map(t => {
              const sb = STATUS_BADGE[t.game.status] || { label: t.game.status, color: 'gray' };
              return (
                <div key={t.id} className="history-item">
                  <div className={`item-icon ${t.isWinner ? 'win' : ''}`}>
                    {t.isWinner ? <Trophy size={20} /> : <Gamepad2 size={20} />}
                  </div>
                  <div className="item-info">
                    <div className="row-top">
                       <span className="room-type">{t.game.room.type} ROOM</span>
                       <span className="status-pill" style={{ color: sb.color, borderColor: sb.color }}>{sb.label}</span>
                    </div>
                    <div className="row-bottom">
                       <span className="date-stamp"><Calendar size={12} /> {new Date(t.purchasedAt).toLocaleDateString()}</span>
                       {t.isWinner && <span className="win-badge">WINNER!</span>}
                    </div>
                  </div>
                  <div className="item-action">
                     <ArrowUpRight size={16} opacity={0.3} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="scroll-list">
            {wins.length === 0 && <div className="empty-msg">No winning moments yet. Keep playing!</div>}
            {wins.map(w => (
              <div key={w.id} className="history-item win-highlight">
                <div className="item-icon win">
                   <Star size={20} />
                </div>
                <div className="item-info">
                  <div className="row-top">
                     <span className="room-type">{w.winMode.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="row-bottom">
                     <span className="date-stamp">{w.game.room.type} · {new Date(w.paidAt).toLocaleTimeString()}</span>
                  </div>
                </div>
                <div className="item-price">
                   <span className="plus">+</span>
                   {Number(w.prizeAmount).toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Navbar />

      <style jsx>{`
        .buna-history-container { min-height: 100vh; background: var(--bg-main); color: var(--text-main); padding-bottom: 90px; }
        
        .top-header-nav { display: flex; align-items: center; padding: 16px; gap: 16px; background: var(--bg-nav); color: white; }
        .btn-back-nav { background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .title-stack h1 { font-size: 18px; font-weight: 900; margin: 0; }
        .title-stack p { font-size: 11px; opacity: 0.7; font-weight: 700; margin: 0; text-transform: uppercase; }

        .history-dashboard { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .main-stat-card { 
          background: var(--bg-nav); color: white; border-radius: 20px; padding: 24px; 
          box-shadow: 0 15px 30px rgba(111, 78, 55, 0.2); position: relative; overflow: hidden;
        }
        .main-stat-card::after { content: ''; position: absolute; top: -50%; right: -20%; width: 200px; height: 200px; background: rgba(212, 175, 55, 0.1); border-radius: 50%; }
        .main-stat-card .l { font-size: 12px; font-weight: 800; opacity: 0.7; display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
        .main-stat-card .v { font-size: 38px; font-weight: 900; }
        .main-stat-card .v span { font-size: 14px; opacity: 0.6; }
        .main-stat-card .b { font-size: 10px; font-weight: 800; opacity: 0.5; text-transform: uppercase; margin-top: 4px; }

        .mini-stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .mini-capsule { background: var(--bg-card); padding: 12px; border-radius: 16px; text-align: center; border: 1.5px solid var(--border-light); }
        .mini-capsule .l { font-size: 8px; font-weight: 800; opacity: 0.5; text-transform: uppercase; margin-bottom: 2px; }
        .mini-capsule .v { font-size: 16px; font-weight: 900; }
        .mini-capsule .v.gold { color: var(--gold-accent); }

        .pro-tab-bar { display: flex; padding: 0 16px; gap: 12px; margin: 10px 0 20px; }
        .tab-item { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; border-radius: 14px; border: 2px solid var(--border-light); background: transparent; color: var(--text-main); font-weight: 800; font-size: 13px; cursor: pointer; transition: 0.2s; }
        .tab-item.active { background: var(--gold-accent); border-color: var(--gold-accent); color: black; box-shadow: 0 5px 15px rgba(212, 175, 55, 0.2); }

        .history-list-area { padding: 0 16px; }
        .scroll-list { display: flex; flex-direction: column; gap: 10px; }
        .empty-msg { text-align: center; padding: 40px; opacity: 0.5; font-weight: 800; font-size: 14px; }

        .history-item { 
          background: var(--bg-card); border-radius: 16px; padding: 16px; display: flex; align-items: center; gap: 16px; 
          border: 1.5px solid var(--border-light); transition: 0.2s;
        }
        .history-item.win-highlight { border-color: var(--gold-accent); background: rgba(212, 175, 55, 0.03); }
        
        .item-icon { width: 44px; height: 44px; background: var(--border-light); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); }
        .item-icon.win { background: rgba(212, 175, 55, 0.1); color: var(--gold-accent); }
        
        .item-info { flex: 1; }
        .row-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .room-type { font-size: 14px; font-weight: 900; color: var(--text-main); text-transform: uppercase; }
        .status-pill { font-size: 8px; font-weight: 900; padding: 2px 6px; border-radius: 4px; border: 1px solid; opacity: 0.8; }
        
        .row-bottom { display: flex; justify-content: space-between; align-items: center; }
        .date-stamp { font-size: 11px; font-weight: 700; opacity: 0.5; display: flex; align-items: center; gap: 4px; }
        .win-badge { font-size: 9px; font-weight: 900; color: #22c55e; }

        .item-price { font-size: 18px; font-weight: 900; color: #22c55e; }
        .item-price .plus { font-size: 12px; margin-right: 2px; }
      `}</style>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="loading"><div className="spinner" /><span>PREPARING HISTORY...</span></div>}>
      <HistoryContent />
    </Suspense>
  );
}
