'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { getLeaderboard } from '../../lib/api';
import Navbar from '../../components/Navbar';
import { Trophy, ChevronLeft, Star } from 'lucide-react';

interface Leader {
  id: string;
  name: string;
  tgId: string;
  score: number;
  amount: number;
  rank: number;
}

function ScoresContent() {
  const router = useRouter();
  const [boardType, setBoardType] = useState<'score' | 'bonus'>('score');
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month'>('today');
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScores = async () => {
    setLoading(true);
    try {
      const data = await getLeaderboard(timeframe);
      setLeaders(data);
    } catch (err) {
      console.error('Failed to load leaderboard', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScores();
  }, [timeframe]);

  if (loading && leaders.length === 0) return <div className="loading"><div className="spinner" /><span>SYNCING SCORES...</span></div>;

  return (
    <div className="buna-scores-container">
      {/* Top Navigation */}
      <div className="top-header-nav">
        <button className="btn-back-nav" onClick={() => router.push('/')}>
          <ChevronLeft size={24} />
        </button>
        <div className="title-stack">
          <h1>Leaderboard</h1>
          <p>Top Winners</p>
        </div>
      </div>

      {/* Board Switcher */}
      <div className="board-switcher">
         <button className={`sw-item ${boardType === 'score' ? 'active' : ''}`} onClick={() => setBoardType('score')}>
            Score Board
         </button>
         <button className={`sw-item ${boardType === 'bonus' ? 'active' : ''}`} onClick={() => setBoardType('bonus')}>
            Bonus Board
         </button>
      </div>

      {/* Timeframe Filter */}
      <div className="timeframe-filter">
         {(['today', 'week', 'month'] as const).map(tf => (
           <button key={tf} className={`tf-btn ${timeframe === tf ? 'active' : ''}`} onClick={() => setTimeframe(tf)}>
              {tf.charAt(0).toUpperCase() + tf.slice(1)}
           </button>
         ))}
      </div>

      {/* Top 3 Spotlight */}
      <div className="top-spotlight">
         <div className="spot-item s2">
            <div className="avatar-circle">{leaders[1]?.name.charAt(0) || '?'}</div>
            <div className="rank-badge">2</div>
            <div className="name">{leaders[1]?.name || '---'}</div>
         </div>
         <div className="spot-item s1">
            <div className="avatar-circle gold-border">{leaders[0]?.name.charAt(0) || '?'}</div>
            <div className="rank-badge gold">1</div>
            <div className="name">{leaders[0]?.name || '---'}</div>
         </div>
         <div className="spot-item s3">
            <div className="avatar-circle">{leaders[2]?.name.charAt(0) || '?'}</div>
            <div className="rank-badge">3</div>
            <div className="name">{leaders[2]?.name || '---'}</div>
         </div>
      </div>

      {/* Ranking List */}
      <div className="ranking-list-section">
         <div className="list-hdr">Top Players (100)</div>
         <div className="ranking-scroll">
            {leaders.length === 0 && !loading && (
              <div className="empty-scores">No wins recorded for this period yet.</div>
            )}
            {leaders.map((player) => (
              <div key={player.id} className="rank-card">
                 <div className={`rank-initial ${player.rank <= 3 ? 'top' : ''}`}>
                    {player.name.charAt(0)}
                 </div>
                 <div className="player-details">
                    <div className="p-name">{player.name}</div>
                    <div className="p-id">{player.tgId}</div>
                 </div>
                 <div className="player-score">
                    {player.score}
                 </div>
              </div>
            ))}
         </div>
      </div>

      <Navbar />

      <style jsx>{`
        .buna-scores-container { min-height: 100vh; background: var(--bg-main); color: var(--text-main); padding-bottom: 90px; }
        
        .top-header-nav { display: flex; align-items: center; padding: 16px; gap: 16px; background: var(--bg-nav); color: white; }
        .btn-back-nav { background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .title-stack h1 { font-size: 18px; font-weight: 900; margin: 0; }
        .title-stack p { font-size: 11px; opacity: 0.7; font-weight: 700; margin: 0; text-transform: uppercase; }

        .board-switcher { display: flex; padding: 16px; gap: 10px; }
        .sw-item { flex: 1; padding: 14px; border-radius: 12px; border: none; background: var(--bg-card); color: var(--text-main); font-weight: 800; font-size: 13px; opacity: 0.5; transition: 0.2s; }
        .sw-item.active { background: var(--gold-accent); color: black; opacity: 1; box-shadow: 0 5px 15px rgba(212, 175, 55, 0.2); }

        .timeframe-filter { display: flex; padding: 0 16px 20px; gap: 10px; justify-content: space-between; }
        .tf-btn { flex: 1; padding: 8px; border: none; background: transparent; color: var(--text-main); font-weight: 800; font-size: 12px; opacity: 0.4; border-radius: 99px; }
        .tf-btn.active { background: rgba(111, 78, 55, 0.1); opacity: 1; color: var(--coffee-dark); }

        .top-spotlight { display: flex; justify-content: center; align-items: flex-end; padding: 20px; gap: 15px; margin-bottom: 20px; }
        .spot-item { display: flex; flex-direction: column; align-items: center; position: relative; }
        .s1 { transform: translateY(-15px); }
        
        .avatar-circle { width: 60px; height: 60px; background: var(--bg-nav); border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
        .avatar-circle.gold-border { width: 80px; height: 80px; font-size: 32px; border: 4px solid var(--gold-accent); }
        
        .rank-badge { position: absolute; bottom: 15px; right: -5px; width: 22px; height: 22px; background: #94a3b8; border-radius: 50%; color: white; font-size: 11px; font-weight: 900; display: flex; align-items: center; justify-content: center; border: 2px solid white; }
        .rank-badge.gold { background: var(--gold-accent); width: 28px; height: 28px; font-size: 14px; bottom: 25px; }
        
        .name { margin-top: 8px; font-size: 11px; font-weight: 800; opacity: 0.8; max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .ranking-list-section { padding: 0 16px; }
        .list-hdr { font-size: 11px; font-weight: 800; opacity: 0.5; margin-bottom: 12px; text-align: center; text-transform: uppercase; letter-spacing: 1px; }
        
        .ranking-scroll { display: flex; flex-direction: column; gap: 8px; }
        .rank-card { background: var(--bg-card); border-radius: 16px; padding: 12px 16px; display: flex; align-items: center; gap: 16px; border: 1.5px solid var(--border-light); }
        
        .rank-initial { width: 40px; height: 40px; border-radius: 50%; background: #94a3b8; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; }
        .rank-initial.top { background: var(--gold-accent); color: black; }
        
        .player-details { flex: 1; }
        .p-name { font-size: 15px; font-weight: 900; }
        .p-id { font-size: 10px; font-weight: 700; opacity: 0.4; }
        
        .player-score { font-size: 18px; font-weight: 900; color: var(--coffee-dark); opacity: 0.8; }
        .empty-scores { text-align: center; padding: 40px; opacity: 0.5; font-weight: 800; font-size: 14px; }
      `}</style>
    </div>
  );
}

export default function ScoresPage() {
  return (
    <Suspense fallback={<div className="loading"><div className="spinner" /><span>LOADING BOARD...</span></div>}>
      <ScoresContent />
    </Suspense>
  );
}
