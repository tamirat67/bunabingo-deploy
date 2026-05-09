'use client';
import { useEffect, useState } from 'react';
import { getLeaderboard } from '../../lib/api';
import Navbar from '../../components/Navbar';

export default function ScoresPage() {
  const [board, setBoard] = useState('score');
  const [time, setTime] = useState('today');
  const [players, setPlayers] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    getLeaderboard(time).then(setPlayers).catch(() => {
      // Fallback to demo data if API fails
      setPlayers([
        { firstName: 'HI 5', phoneNumber: '251981234501', wins: 39 },
        { firstName: 'Medu', phoneNumber: '251921234677', wins: 21 },
        { firstName: 'Ablel', phoneNumber: '251981234848', wins: 20 },
      ]);
    });
  }, [time, mounted]);

  if (!mounted) return null;

  const maskPhone = (phone: string) => {
    if (!phone) return '****';
    return `${phone.slice(0, 5)}**${phone.slice(-5)}`;
  };

  const colors = ['#ffa726', '#66bb6a', '#42a5f5', '#ef5350', '#ab47bc'];

  return (
    <div className="scores-container">
      <div className="board-toggle">
        <div className={`toggle-pill ${board === 'score' ? 'active' : ''}`} onClick={() => setBoard('score')}>Score Board</div>
        <div className={`toggle-pill ${board === 'bonus' ? 'active' : ''}`} onClick={() => setBoard('bonus')}>Bonus Board</div>
      </div>

      <div className="time-filters">
        <div className={`time-pill ${time === 'today' ? 'active' : ''}`} onClick={() => setTime('today')}>Today</div>
        <div className={`time-pill ${time === 'week' ? 'active' : ''}`} onClick={() => setTime('week')}>This Week</div>
        <div className={`time-pill ${time === 'month' ? 'active' : ''}`} onClick={() => setTime('month')}>This Month</div>
      </div>

      <div className="top-avatars">
        {players.slice(0, 5).map((p, i) => (
          <div key={i} className="mini-avatar" style={{background: colors[i % colors.length]}}>
            {p.firstName?.slice(0, 2).toUpperCase() || 'P'}
          </div>
        ))}
      </div>

      <div style={{textAlign: 'center', fontSize: '13px', fontWeight: 'bold', margin: '10px 0'}}>Top Players (100)</div>

      <div className="leader-list">
        {players.map((p, i) => (
          <div key={i} className="leader-row">
            <div className="leader-info">
              <div className="row-avatar" style={{background: colors[i % colors.length]}}>
                {p.firstName?.slice(0, 2).toUpperCase() || 'P'}
              </div>
              <div className="leader-name">
                <span className="name-txt">{p.firstName}</span>
                <span className="phone-sub">{maskPhone(p.phoneNumber)}</span>
              </div>
            </div>
            <div className="leader-score">{p.wins || 0}</div>
          </div>
        ))}
        {players.length === 0 && <div className="empty-state">Loading leaderboard...</div>}
      </div>
    </div>
  );
}
