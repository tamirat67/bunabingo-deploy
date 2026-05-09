'use client';
import { useEffect, useState } from 'react';
import { getHistory } from '../../lib/api';
import Navbar from '../../components/Navbar';
import { History as HistoryIcon, ChevronRight, Trophy, Ban } from 'lucide-react';

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    // getHistory().then(setHistory).catch(() => {});
    // Fallback demo data
    setHistory([
      { id: '1', type: 'STANDARD', stake: 10, win: 592, date: '2024-05-07 18:30', status: 'WON' },
      { id: '2', type: 'PRO', stake: 50, win: 0, date: '2024-05-07 15:45', status: 'LOST' },
      { id: '3', type: 'CASUAL', stake: 10, win: 100, date: '2024-05-06 20:10', status: 'WON' },
    ]);
  }, []);

  return (
    <div className="scores-container"> {/* Reusing container padding */}
      <div className="wallet-header">
        <span>Game History</span>
        <HistoryIcon size={24} />
      </div>

      <div className="leader-list" style={{marginTop: '20px'}}>
        {history.map((item, i) => (
          <div key={item.id} className="leader-row" style={{padding: '16px'}}>
            <div className="leader-info">
              <div className="row-avatar" style={{background: item.status === 'WON' ? 'var(--olive-accent)' : 'var(--terracotta)'}}>
                {item.status === 'WON' ? <Trophy size={20} /> : <Ban size={20} />}
              </div>
              <div className="leader-name">
                <span className="name-txt">{item.type} Game</span>
                <span className="phone-sub">{item.date}</span>
              </div>
            </div>
            <div style={{textAlign: 'right'}}>
              <div className="leader-score" style={{color: item.status === 'WON' ? 'var(--olive-accent)' : 'inherit'}}>
                {item.status === 'WON' ? `+${item.win}` : `-${item.stake}`}
              </div>
              <div style={{fontSize: '10px', opacity: 0.5, fontWeight: 'bold'}}>{item.status}</div>
            </div>
          </div>
        ))}
        {history.length === 0 && <div className="empty-state">No game history yet</div>}
      </div>
    </div>
  );
}
