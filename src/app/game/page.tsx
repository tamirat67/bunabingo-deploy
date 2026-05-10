'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getGame, getMyCard, pusherAuth, claimBingo } from '../../lib/api';
import Pusher from 'pusher-js';
import { Volume2, VolumeX, RefreshCw, LogOut, PlusCircle, Home, Trophy, History, Wallet, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const COLUMNS = [
  { label: 'B', color: '#F59E0B', range: [1, 15] },
  { label: 'I', color: '#10B981', range: [16, 30] },
  { label: 'N', color: '#3B82F6', range: [31, 45] },
  { label: 'G', color: '#EF4444', range: [46, 60] },
  { label: 'O', color: '#8B5CF6', range: [61, 75] },
];

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

    const fetchData = () => {
      Promise.all([getGame(gameId), getMyCard(gameId)]).then(([g, t]) => {
        setGame(g);
        setTickets(t.tickets || []);
        const history = g.drawHistory.map((d: any) => d.number);
        setDrawn(history);
        setLastBall(history.length ? history[history.length - 1] : null);
        if (g.status === 'COUNTDOWN') setCountdown(g.countdownSeconds);
      }).catch(console.error);
    };

    fetchData();

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
             const label = getColumnLabel(data.number);
             const msg = new SpeechSynthesisUtterance(`${label} ${data.number}`);
             window.speechSynthesis.speak(msg);
          }
        });

        channel.bind('countdown-start', (data: { seconds: number }) => {
          setCountdown(data.seconds);
        });

        channel.bind('game-update', (data: any) => {
          if (data.status === 'FINISHED') window.location.reload();
          setGame((prev: any) => prev ? { ...prev, ...data } : prev);
        });
      }
    } catch (e) {}

    return () => {
      if (pusher) {
        pusher.unsubscribe(`private-game-${gameId}`);
        pusher.disconnect();
      }
    };
  }, [gameId, mounted]);

  const handleBingo = async (ticketId: string) => {
    if (!gameId) return;
    try {
      await claimBingo(gameId);
      alert('🎉 BINGO CLAIMED! Checking your card...');
    } catch (err: any) {
      alert(err.response?.data?.error || 'No Bingo yet!');
    }
  };

  if (!mounted) return null;

  const isCalled = (num: number) => drawn.includes(num);

  return (
    <div className="game-tournament-container" style={{ background: '#7D5BA6', minHeight: '100vh', paddingBottom: '100px', fontFamily: 'sans-serif', color: 'white' }}>
      
      {/* ── Dashboard Header Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px', padding: '5px', background: 'rgba(0,0,0,0.1)' }}>
         <div style={{ background: 'white', color: '#333', padding: '5px', textAlign: 'center', borderRadius: '4px' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', opacity: 0.6 }}>Game</div>
            <div style={{ fontSize: '11px', fontWeight: '900' }}>{gameId?.slice(-6).toUpperCase()}</div>
         </div>
         <div style={{ background: 'white', color: '#333', padding: '5px', textAlign: 'center', borderRadius: '4px' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', opacity: 0.6 }}>Derash</div>
            <div style={{ fontSize: '11px', fontWeight: '900' }}>-</div>
         </div>
         <div style={{ background: 'white', color: '#333', padding: '5px', textAlign: 'center', borderRadius: '4px' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', opacity: 0.6 }}>Bonus</div>
            <div style={{ fontSize: '11px', fontWeight: '900' }}>Off</div>
         </div>
         <div style={{ background: 'white', color: '#333', padding: '5px', textAlign: 'center', borderRadius: '4px' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', opacity: 0.6 }}>Players</div>
            <div style={{ fontSize: '11px', fontWeight: '900' }}>{game?.currentPlayers || '-'}</div>
         </div>
         <div style={{ background: 'white', color: '#333', padding: '5px', textAlign: 'center', borderRadius: '4px' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', opacity: 0.6 }}>Stake</div>
            <div style={{ fontSize: '11px', fontWeight: '900' }}>{game?.room?.ticketPrice || 0}</div>
         </div>
         <div style={{ background: 'white', color: '#333', padding: '5px', textAlign: 'center', borderRadius: '4px' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', opacity: 0.6 }}>Call</div>
            <div style={{ fontSize: '11px', fontWeight: '900' }}>{drawn.length}</div>
         </div>
         <div onClick={() => setSoundOn(!soundOn)} style={{ background: 'white', color: '#333', padding: '5px', textAlign: 'center', borderRadius: '4px', cursor: 'pointer', gridColumn: 'span 2' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', opacity: 0.6 }}>Sound</div>
            <div style={{ fontSize: '11px', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
               {soundOn ? <Volume2 size={12} /> : <VolumeX size={12} color="red" />} {soundOn ? 'ON' : 'OFF'}
            </div>
         </div>
      </div>

      <div style={{ display: 'flex', padding: '10px', gap: '10px' }}>
        
        {/* ── Left Column: Calling Logic ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            <div style={{ display: 'flex', gap: '5px' }}>
               <div style={{ background: '#E0D4F0', color: '#3D2B1F', flex: 1, borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', opacity: 0.7 }}>Count Down</div>
                  <div style={{ fontSize: '18px', fontWeight: '900' }}>{countdown !== null ? countdown : (game?.status === 'WAITING' ? 'Wait' : 'Live')}</div>
               </div>
               <div style={{ background: '#E0D4F0', width: '60px', height: '60px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {lastBall ? (
                     <div style={{ width: '45px', height: '45px', background: '#F39C12', borderRadius: '50%', border: '3px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '20px', color: 'white' }}>
                        {lastBall}
                     </div>
                  ) : <div style={{ fontSize: '24px', fontWeight: '900', color: '#AAA' }}>.</div>}
               </div>
            </div>

            {/* Master Board 1-75 */}
            <div style={{ background: '#E0D4F0', borderRadius: '12px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px' }}>
                  {COLUMNS.map(c => <div key={c.label} style={{ background: c.color, color: 'white', textAlign: 'center', fontSize: '12px', fontWeight: '900', borderRadius: '30px' }}>{c.label}</div>)}
               </div>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px' }}>
                  {COLUMNS.map(col => (
                     <div key={col.label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {Array.from({ length: 15 }, (_, i) => col.range[0] + i).map(n => (
                           <div key={n} style={{ 
                              background: isCalled(n) ? col.color : 'white', 
                              color: isCalled(n) ? 'white' : 'rgba(0,0,0,0.2)', 
                              fontSize: '11px', 
                              fontWeight: '900', 
                              textAlign: 'center', 
                              padding: '4px 0', 
                              borderRadius: '4px' 
                           }}>
                              {n}
                           </div>
                        ))}
                     </div>
                  ))}
               </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
               <button onClick={() => window.location.reload()} style={{ flex: 1, background: '#3498DB', color: 'white', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', boxShadow: '0 4px #2980B9' }}>
                  <RefreshCw size={16} /> Refresh
               </button>
               <button onClick={() => router.push('/')} style={{ flex: 1, background: '#E74C3C', color: 'white', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', boxShadow: '0 4px #C0392B' }}>
                  <LogOut size={16} /> Leave
               </button>
            </div>
        </div>

        {/* ── Right Column: Cards ── */}
        <div style={{ flex: 1.2, height: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', paddingRight: '5px' }} className="cards-scroll">
           {tickets.map((t: any) => {
              const rows = Array.isArray(t.card) ? t.card : t.card.rows;
              return (
                 <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ background: '#E0D4F0', borderRadius: '12px', padding: '8px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', marginBottom: '5px' }}>
                           {COLUMNS.map(c => <div key={c.label} style={{ background: c.color, color: 'white', textAlign: 'center', fontSize: '10px', fontWeight: '900', borderRadius: '10px' }}>{c.label}</div>)}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                           {rows.map((row: any[], ri: number) => row.map((cell: any, ci: number) => {
                              const isFree = cell === 0 || cell === 'FREE';
                              const marked = isCalled(Number(cell));
                              return (
                                 <div key={`${ri}-${ci}`} style={{ 
                                    background: isFree ? '#27AE60' : 'white', 
                                    color: isFree ? 'white' : (marked ? '#27AE60' : '#333'), 
                                    height: '35px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    borderRadius: '6px', 
                                    fontSize: '14px', 
                                    fontWeight: '900',
                                    border: marked ? '2px solid #27AE60' : 'none'
                                 }}>
                                    {isFree ? '★' : cell}
                                 </div>
                              );
                           }))}
                        </div>
                    </div>
                    <button 
                     onClick={() => handleBingo(t.id)}
                     style={{ background: '#F39C12', color: 'white', border: 'none', padding: '10px', borderRadius: '10px', fontWeight: '900', fontSize: '14px', boxShadow: '0 4px #D35400' }}
                    >
                       BINGO! ({(game?.room?.ticketPrice || 0) * 8})
                    </button>
                 </div>
              );
           })}
        </div>
      </div>

      {/* Floating Add Board Button */}
      <div 
         onClick={() => router.push(`/tickets/select?type=${game?.room?.type || 'STANDARD'}&price=${game?.room?.ticketPrice || 10}`)}
         style={{ position: 'fixed', bottom: '80px', right: '20px', background: '#E67E22', color: 'white', padding: '10px 20px', borderRadius: '25px', fontWeight: '900', fontSize: '14px', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 100, cursor: 'pointer' }}
      >
         Add Board <PlusCircle size={20} />
      </div>


    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div style={{background:'#7D5BA6',height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:'18px',fontWeight:900}}>Loading Heart...</div>}>
      <GameContent />
    </Suspense>
  );
}
