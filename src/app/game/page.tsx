'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getGame, getMyCard, pusherAuth, claimBingo } from '../../lib/api';
import Pusher from 'pusher-js';
import { Volume2, VolumeX, RefreshCw, LogOut, PlusCircle } from 'lucide-react';

const COLUMNS = [
  { label: 'B', color: '#F59E0B', range: [1, 15] },
  { label: 'I', color: '#10B981', range: [16, 30] },
  { label: 'N', color: '#3B82F6', range: [31, 45] },
  { label: 'G', color: '#EF4444', range: [46, 60] },
  { label: 'O', color: '#8B5CF6', range: [61, 75] },
];

function getColumnColor(num: number) {
  if (num >= 1 && num <= 15) return '#F59E0B';
  if (num >= 16 && num <= 30) return '#10B981';
  if (num >= 31 && num <= 45) return '#3B82F6';
  if (num >= 46 && num <= 60) return '#EF4444';
  return '#8B5CF6';
}

function getColumnLabel(num: number) {
  if (num >= 1 && num <= 15) return 'B';
  if (num >= 16 && num <= 30) return 'I';
  if (num >= 31 && num <= 45) return 'N';
  if (num >= 46 && num <= 60) return 'G';
  return 'O';
}

function GameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameId = searchParams.get('id');

  const [game, setGame] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [drawn, setDrawn] = useState<number[]>([]);
  const [lastBall, setLastBall] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!gameId) return;

    Promise.all([getGame(gameId), getMyCard(gameId)]).then(([g, t]) => {
      setGame(g);
      setTickets(t.tickets || []);
      const history = g.drawHistory.map((d: any) => d.number);
      setDrawn(history);
      setLastBall(history.length ? history[history.length - 1] : null);
      if (g.status === 'COUNTDOWN') setCountdown(g.countdownSeconds);
    }).catch(console.error);

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
          if (soundOn && typeof window !== 'undefined' && 'speechSynthesis' in window) {
            try {
              const label = getColumnLabel(data.number);
              const msg = new SpeechSynthesisUtterance(`${label} ${data.number}`);
              msg.rate = 0.9;
              window.speechSynthesis.speak(msg);
            } catch (e) {}
          }
        });

        channel.bind('countdown-start', (data: { seconds: number }) => {
          setCountdown(data.seconds);
        });

        channel.bind('game-update', (data: any) => {
          if (data.currentPlayers !== undefined) {
            setGame((prev: any) => prev ? { ...prev, currentPlayers: data.currentPlayers } : prev);
          }
        });
      }
    } catch (e) { console.error('Pusher error:', e); }

    return () => {
      if (pusher) {
        pusher.unsubscribe(`private-game-${gameId}`);
        pusher.disconnect();
      }
    };
  }, [gameId, mounted]);

  const handleBingo = async () => {
    if (!gameId) return;
    try {
      await claimBingo(gameId);
      alert('🎉 BINGO CLAIMED! Checking your card...');
    } catch (err: any) {
      alert(err.response?.data?.error || 'No Bingo yet! Keep playing.');
    }
  };

  const isCalled = (num: number) => drawn.includes(num);

  if (!mounted) return null;

  const statusLabel = countdown !== null ? countdown : (game?.status === 'WAITING' ? 'Wait' : 'Live');

  return (
    <div className="gp-layout">
      {/* ── Top Stats Bar ── */}
      <div className="gp-stats">
        <div className="gp-stat"><div className="gp-sl">Game</div><div className="gp-sv">{gameId?.slice(-6).toUpperCase() || '--'}</div></div>
        <div className="gp-stat"><div className="gp-sl">Derash</div><div className="gp-sv">-</div></div>
        <div className="gp-stat"><div className="gp-sl">Bonus</div><div className="gp-sv">Off</div></div>
        <div className="gp-stat"><div className="gp-sl">Players</div><div className="gp-sv">{game?.currentPlayers || 0}</div></div>
        <div className="gp-stat"><div className="gp-sl">Stake</div><div className="gp-sv">{game?.room?.ticketPrice || 0}</div></div>
        <div className="gp-stat"><div className="gp-sl">Call</div><div className="gp-sv">{drawn.length}</div></div>
        <div className="gp-stat" onClick={() => setSoundOn(p => !p)} style={{cursor:'pointer'}}>
          <div className="gp-sl">Sound</div>
          <div className="gp-sv">{soundOn ? <Volume2 size={12} /> : <VolumeX size={12} color="#EF4444" />}</div>
        </div>
      </div>

      {/* ── Main Play Area ── */}
      <div className="gp-main">
        {/* Master Calling Board */}
        <div className="gp-board">
          <div className="gp-col-headers">
            {COLUMNS.map(c => (
              <div key={c.label} className="gp-col-h" style={{ background: c.color }}>{c.label}</div>
            ))}
          </div>
          <div className="gp-cols">
            {COLUMNS.map(col => (
              <div key={col.label} className="gp-col">
                {Array.from({ length: 15 }, (_, i) => col.range[0] + i).map(n => (
                  <div key={n} className={`gp-cell ${isCalled(n) ? 'called' : ''}`}
                    style={isCalled(n) ? { background: col.color, color: '#fff', fontWeight: 900 } : {}}>
                    {n}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Right Action Zone */}
        <div className="gp-zone">
          {/* Countdown */}
          <div className="gp-countdown">
            <div className="gp-cd-label">Count Down</div>
            <div className="gp-cd-val">{statusLabel}</div>
          </div>

          {/* Current Call Ball */}
          <div className="gp-current-call" style={lastBall ? { background: getColumnColor(lastBall) } : {}}>
            <div className="gp-cc-label">Current Call</div>
            {lastBall ? (
              <div className="gp-cc-ball">
                <div className="gp-cc-letter">{getColumnLabel(lastBall)}</div>
                <div className="gp-cc-num">{lastBall}</div>
              </div>
            ) : (
              <div className="gp-cc-num" style={{fontSize: '24px'}}>-</div>
            )}
          </div>

          {/* Player Cards Stack */}
          <div className="gp-cards-stack">
            {tickets.map((t: any, idx: number) => (
              <div key={t.id || idx} className="gp-card">
                <div className="gp-card-header">
                  {COLUMNS.map(c => (
                    <div key={c.label} className="gp-card-h" style={{ background: c.color }}>{c.label}</div>
                  ))}
                </div>
                <div className="gp-card-grid">
                  {t.card?.rows?.map?.((row: any[], ri: number) => row?.map?.((cell: any, ci: number) => {
                    const isFree = cell === 'FREE' || cell === 0;
                    const isMarked = !isFree && isCalled(Number(cell));
                    return (
                      <div key={`${ri}-${ci}`}
                        className={`gp-card-cell ${isFree ? 'free' : ''} ${isMarked ? 'marked' : ''}`}
                        style={isMarked ? { background: getColumnColor(Number(cell)), color: '#fff' } : {}}>
                        {isFree ? '★' : cell}
                      </div>
                    );
                  }))}
                </div>
                <div className="gp-card-label">Board number {idx + 1}</div>
              </div>
            ))}
            {tickets.length === 0 && (
              <div style={{color: 'rgba(255,255,255,0.3)', fontSize: '12px', textAlign: 'center', padding: '12px'}}>
                No tickets found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── BINGO Button ── */}
      <button className="gp-bingo-btn" onClick={handleBingo}>BINGO!</button>

      {/* ── Bottom Actions ── */}
      <div className="gp-actions">
        <button className="gp-act-btn gp-blue" onClick={() => window.location.reload()}>
          <RefreshCw size={16} /><span>Refresh</span>
        </button>
        <button className="gp-act-btn gp-red" onClick={() => router.push('/')}>
          <LogOut size={16} /><span>Leave</span>
        </button>
        <button className="gp-act-btn gp-orange" onClick={() => router.push(`/tickets/select?type=${game?.room?.type || 'STANDARD'}&price=${game?.room?.ticketPrice || 20}`)}>
          <PlusCircle size={16} /><span>Add Board</span>
        </button>
      </div>

      <div style={{height: '90px'}} />
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div style={{background:'#2D1B14',height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#D4AF37',fontSize:'18px',fontWeight:900}}>Loading Game...</div>}>
      <GameContent />
    </Suspense>
  );
}
