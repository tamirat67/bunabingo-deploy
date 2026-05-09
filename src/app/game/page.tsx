'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getGame, getMyCard, pusherAuth, claimBingo } from '../../lib/api';
import Navbar from '../../components/Navbar';
import Pusher from 'pusher-js';
import { Volume2, RefreshCw, LogOut, PlusCircle } from 'lucide-react';

function GameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameId = searchParams.get('id');

  const [game, setGame] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [drawn, setDrawn] = useState<number[]>([]);
  const [lastBall, setLastBall] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!gameId) return;

    // Initial Data
    Promise.all([getGame(gameId), getMyCard(gameId)]).then(([g, t]) => {
      setGame(g);
      setTickets(t.tickets || []);
      const history = g.drawHistory.map((d: any) => d.number);
      setDrawn(history);
      setLastBall(history.length ? history[history.length - 1] : null);
      if (g.status === 'COUNTDOWN') setCountdown(g.countdownSeconds);
    }).catch(console.error);

    // Real-time Sync
    let pusher: Pusher | null = null;
    try {
      const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
      const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
      
      if (pusherKey && pusherCluster) {
        pusher = new Pusher(pusherKey, {
          cluster: pusherCluster,
          authorizer: (channel) => ({
            authorize: (socketId, cb) => {
              pusherAuth(socketId, channel.name).then(data => cb(null, data)).catch(err => cb(err, null));
            }
          })
        });

        const channel = pusher.subscribe(`private-game-${gameId}`);
        
        channel.bind('number-drawn', (data: { number: number }) => {
          setLastBall(data.number);
          setDrawn(prev => [...prev, data.number]);
          setCountdown(null);
          // Voice Announcer
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            try {
              const msg = new SpeechSynthesisUtterance(`${data.number}`);
              msg.rate = 1.1;
              window.speechSynthesis.speak(msg);
            } catch (vErr) { console.error('Voice error:', vErr); }
          }
        });

        channel.bind('countdown-start', (data: { seconds: number }) => {
          setCountdown(data.seconds);
        });
      }
    } catch (pErr) {
      console.error('Pusher init error:', pErr);
    }

    return () => {
      if (pusher) {
        pusher.unsubscribe(`private-game-${gameId}`);
        pusher.disconnect();
      }
    };
  }, [gameId, mounted]);

  if (!mounted) return null;

  const handleBingo = async () => {
    if (!gameId) return;
    try {
      await claimBingo(gameId);
      alert('BINGO CLAIMED! CHECKING...');
    } catch (err: any) {
      alert(err.response?.data?.error || 'No Bingo yet!');
    }
  };

  const isCalled = (num: number) => drawn.includes(num);

  const COLUMNS = [
    { label: 'B', color: '#ffa726', range: [1, 15] },
    { label: 'I', color: '#66bb6a', range: [16, 30] },
    { label: 'N', color: '#42a5f5', range: [31, 45] },
    { label: 'G', color: '#ef5350', range: [46, 60] },
    { label: 'O', color: '#ab47bc', range: [61, 75] },
  ];

  return (
    <div className="game-layout">
      {/* Top Stats */}
      <div className="game-stats-grid">
        <div className="stat-box"><div className="l">Game</div><div className="v">{gameId?.slice(-6).toUpperCase()}</div></div>
        <div className="stat-box"><div className="l">Derash</div><div className="v">-</div></div>
        <div className="stat-box"><div className="l">Bonus</div><div className="v">Off</div></div>
        <div className="stat-box"><div className="l">Players</div><div className="v">{game?.currentPlayers || 0}</div></div>
        <div className="stat-box"><div className="l">Stake</div><div className="v">{game?.room?.ticketPrice || 0}</div></div>
        <div className="stat-box"><div className="l">Call</div><div className="v">{drawn.length}</div></div>
        <div className="stat-box"><div className="l">Sound</div><div className="v"><Volume2 size={12} /></div></div>
      </div>

      <div className="main-play-area">
        {/* Master Board */}
        <div className="master-board">
          <div className="mb-header">
            {COLUMNS.map(c => <div key={c.label} className="mb-h-cell" style={{background: c.color}}>{c.label}</div>)}
          </div>
          <div className="mb-grid">
            {COLUMNS.map(col => (
              <div key={col.label} className="mb-col">
                {Array.from({ length: 15 }, (_, i) => col.range[0] + i).map(n => (
                  <div key={n} className={`mb-cell ${isCalled(n) ? 'called' : ''}`}>{n}</div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Action Zone */}
        <div className="action-zone">
          <div className="stat-box" style={{height: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
            <div className="l">Count Down</div>
            <div className="v" style={{fontSize: '18px'}}>{countdown !== null ? countdown : (game?.status === 'WAITING' ? 'Wait' : 'Live')}</div>
          </div>

          <div className="call-display">
            <span className="call-label">Current Call</span>
            <div className="current-ball">{lastBall || '-'}</div>
          </div>

          {/* Cards Stack */}
          <div style={{display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '400px'}}>
            {tickets?.map?.((t: any, idx: number) => (
              <div key={t.id || idx} className="personal-card">
                <div className="mb-header" style={{marginBottom: '8px'}}>
                  {COLUMNS.map(c => <div key={c.label} className="mb-h-cell" style={{background: c.color, width: '24px', height: '24px', fontSize: '10px'}}>{c.label}</div>)}
                </div>
                <div className="pc-grid">
                  {t.card?.rows?.map?.((row: any[], ri: number) => row?.map?.((cell: any, ci: number) => (
                    <div key={`${ri}-${ci}`} className={`pc-cell ${cell === 'FREE' || cell === 0 ? 'star' : (isCalled(cell) ? 'marked' : '')}`}>
                      {cell === 'FREE' || cell === 0 ? '*' : cell}
                    </div>
                  )))}
                </div>
                <div style={{textAlign: 'center', fontSize: '10px', marginTop: '4px', opacity: 0.6}}>Board number {idx + 1}</div>
              </div>
            ))}
            {(!tickets || tickets.length === 0) && <div className="empty-state">No tickets found</div>}
          </div>
        </div>
      </div>

      <button className="btn-bingo-main" onClick={handleBingo}>BINGO!</button>

      <div className="small-actions">
        <button className="btn-small btn-blue"><RefreshCw size={14} /> Refresh</button>
        <button className="btn-small btn-red" onClick={() => router.push('/')}><LogOut size={14} /> Leave</button>
        <button className="btn-small btn-orange"><PlusCircle size={14} /> Add Board</button>
      </div>
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div>Loading Game...</div>}>
      <GameContent />
    </Suspense>
  );
}
