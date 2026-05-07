'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getGame, getMyCard, pusherAuth } from '../../lib/api';
import Pusher from 'pusher-js';
import { Trophy, ChevronLeft, Volume2, VolumeX, Star, Zap, Users, Wallet, PlayCircle, RefreshCw, LogOut } from 'lucide-react';
import Navbar from '../../components/Navbar';

function GameContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const gameId = searchParams.get('id');
  
  const [game, setGame] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [lastDrawn, setLastDrawn] = useState<number | null>(null);
  const [drawnHistory, setDrawnHistory] = useState<number[]>([]);
  const [winners, setWinners] = useState<any[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [isGameFinished, setIsGameFinished] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const pusherRef = useRef<Pusher | null>(null);
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);

  const loadData = async () => {
    if (!gameId) return;
    try {
      const [gData, tData] = await Promise.all([
        getGame(gameId),
        getMyCard(gameId)
      ]);
      setGame(gData);
      setTickets(tData.tickets || []);
      const history = gData.drawHistory.map((d: any) => d.number);
      setDrawnHistory(history);
      setLastDrawn(history.slice(-1)[0] || null);
      setWinners(gData.winners || []);
      if (gData.status === 'FINISHED') setIsGameFinished(true);
      if (gData.status === 'COUNTDOWN') setCountdown(gData.countdownSeconds);
    } catch (err) {
      console.error('Failed to load game data:', err);
    }
  };

  useEffect(() => {
    loadData();

    // Initialize Pusher
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authorizer: (channel) => ({
        authorize: (socketId, callback) => {
          pusherAuth(socketId, channel.name)
            .then(data => callback(null, data))
            .catch(err => callback(err, null));
        }
      })
    });

    const channel = pusher.subscribe(`private-game-${gameId}`);
    
    channel.bind('countdown-start', (data: { seconds: number }) => {
      setCountdown(data.seconds);
      setGame((prev: any) => ({ ...prev, status: 'COUNTDOWN' }));
    });

    channel.bind('number-drawn', (data: { number: number }) => {
      setLastDrawn(data.number);
      setDrawnHistory(prev => [...prev, data.number]);
      setGame((prev: any) => ({ ...prev, status: 'RUNNING' }));
      setCountdown(null);
      if (soundOn) playAnnouncer(data.number);
    });

    channel.bind('game-finished', (data: { winners: any[] }) => {
      setWinners(data.winners);
      setIsGameFinished(true);
    });

    pusherRef.current = pusher;

    return () => {
      if (pusherRef.current) {
        pusherRef.current.unsubscribe(`private-game-${gameId}`);
      }
    };
  }, [gameId]);

  // Countdown timer logic
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      countdownInterval.current = setInterval(() => {
        setCountdown(prev => (prev !== null && prev > 0) ? prev - 1 : 0);
      }, 1000);
    } else if (countdown === 0) {
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    }
    return () => {
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, [countdown]);

  const playAnnouncer = (num: number) => {
    const msg = new SpeechSynthesisUtterance(num.toString());
    msg.rate = 1.2;
    window.speechSynthesis.speak(msg);
  };

  const isMarked = (num: number) => drawnHistory.includes(num);

  const masterBoardNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
  const columns = [
    { label: 'B', color: '#f97316', range: [1, 15] },
    { label: 'I', color: '#22c55e', range: [16, 30] },
    { label: 'N', color: '#3b82f6', range: [31, 45] },
    { label: 'G', color: '#ef4444', range: [46, 60] },
    { label: 'O', color: '#a855f7', range: [61, 75] },
  ];

  return (
    <div className="pro-game-board">
      {/* Top Stats Bar */}
      <div className="pro-top-bar">
         <div className="stat-pill">
            <span className="l">Room</span>
            <span className="v">{gameId?.slice(-6).toUpperCase()}</span>
         </div>
         <div className="stat-pill">
            <span className="l">Pool</span>
            <span className="v">{(game?.totalPrize || 0).toFixed(0)}</span>
         </div>
         <div className="stat-pill">
            <span className="l">Players</span>
            <span className="v">{game?.currentPlayers || 0}</span>
         </div>
         <div className="stat-pill">
            <span className="l">Bet</span>
            <span className="v">{game?.room?.ticketPrice || 0}</span>
         </div>
         <div className="stat-pill">
            <span className="l">Call</span>
            <span className="v">{drawnHistory.length}</span>
         </div>
      </div>

      <div className="main-board-layout">
         {/* LEFT: MASTER BOARD */}
         <div className="master-board-column">
            <div className="master-header-row">
               {columns.map(c => <div key={c.label} className="h-cell" style={{ color: c.color }}>{c.label}</div>)}
            </div>
            <div className="master-numbers-grid">
               {columns.map(col => (
                 <div key={col.label} className="master-col">
                    {Array.from({ length: 15 }, (_, i) => col.range[0] + i).map(num => (
                      <div key={num} className={`m-cell ${isMarked(num) ? 'active' : ''}`}>
                         {num}
                      </div>
                    ))}
                 </div>
               ))}
            </div>
         </div>

         {/* RIGHT: ACTION ZONE */}
         <div className="action-column">
            <div className="action-top-row">
               <div className="countdown-box">
                  <div className="l">COUNT DOWN</div>
                  <div className="v">{countdown !== null ? countdown : (game?.status === 'WAITING' ? 'WAITING' : 'LIVE')}</div>
               </div>
               <div className="current-call-circle">
                  <div className="l">CURRENT CALL</div>
                  <div className="call-num">
                    {lastDrawn || '-'}
                    <div className="pulse-ring"></div>
                  </div>
               </div>
            </div>

            {/* USER CARDS STACK */}
            <div className="user-cards-scroll">
               {tickets.map((ticket, tIdx) => (
                 <div key={ticket.id} className="mini-card-wrapper">
                    <div className="mini-card-header">
                       {['B','I','N','G','O'].map((l, i) => (
                         <span key={l} style={{ color: columns[i].color }}>{l}</span>
                       ))}
                    </div>
                    <div className="mini-card-grid">
                       {ticket.card.rows.map((row: any[], ri: number) => (
                         row.map((num: any, ci: number) => (
                           <div key={`${ri}-${ci}`} className={`mini-cell ${num === 'FREE' ? 'free' : (isMarked(num) ? 'marked' : '')}`}>
                              {num === 'FREE' ? <Star size={10} fill="#D4AF37" color="#D4AF37" /> : num}
                           </div>
                         ))
                       ))}
                    </div>
                    <div className="mini-card-footer">BOARD NUMBER {tIdx + 1}</div>
                 </div>
               ))}
            </div>
         </div>
      </div>

      {/* BOTTOM ACTIONS */}
      <div className="pro-bottom-actions">
         <button className="btn-bingo-main">BINGO!</button>
         <div className="aux-actions">
            <button className="btn-aux refresh" onClick={loadData}><RefreshCw size={20} /> Refresh</button>
            <button className="btn-aux leave" onClick={() => router.push('/')}><LogOut size={20} /> Leave</button>
         </div>
      </div>

      <Navbar />

      {/* WINNER OVERLAY */}
      {isGameFinished && (
        <div className="pro-overlay-winner">
          <div className="win-card">
             <Trophy size={60} className="trophy-gold" />
             <h2>GAME FINISHED</h2>
             <div className="winner-stack">
                {winners.map((w, i) => (
                  <div key={i} className="winner-item">
                     <span className="n">{w.user?.firstName || 'Winner'}</span>
                     <span className="a">🏆 WINNER</span>
                  </div>
                ))}
             </div>
             <button className="btn-back-home" onClick={() => router.push('/')}>BACK TO LOBBY</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .pro-game-board { min-height: 100vh; background: #2D1B14; color: #E5E7EB; display: flex; flex-direction: column; }
        
        .pro-top-bar { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; padding: 12px; background: rgba(0,0,0,0.3); }
        .stat-pill { background: #3E271F; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 6px 2px; text-align: center; }
        .stat-pill .l { display: block; font-size: 8px; font-weight: 800; opacity: 0.6; text-transform: uppercase; margin-bottom: 2px; }
        .stat-pill .v { font-size: 11px; font-weight: 900; color: #D4AF37; }

        .main-board-layout { flex: 1; display: grid; grid-template-columns: 40% 60%; padding: 10px; gap: 10px; overflow: hidden; }

        /* MASTER BOARD */
        .master-board-column { background: #1C110D; border-radius: 12px; padding: 8px; border: 1px solid rgba(255,255,255,0.05); }
        .master-header-row { display: grid; grid-template-columns: repeat(5, 1fr); text-align: center; font-size: 18px; font-weight: 900; margin-bottom: 8px; }
        .master-numbers-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
        .master-col { display: flex; flex-direction: column; gap: 2px; }
        .m-cell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.02); border-radius: 4px; }
        .m-cell.active { background: white; color: black; box-shadow: 0 0 10px rgba(255,255,255,0.8); }

        /* ACTION ZONE */
        .action-column { display: flex; flex-direction: column; gap: 12px; }
        .action-top-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        
        .countdown-box { background: #1C110D; border-radius: 16px; padding: 15px; text-align: center; border: 1px solid rgba(255,255,255,0.05); }
        .countdown-box .l { font-size: 11px; font-weight: 800; opacity: 0.6; margin-bottom: 5px; }
        .countdown-box .v { font-size: 28px; font-weight: 900; color: white; }

        .current-call-circle { background: #1C110D; border-radius: 16px; padding: 15px; text-align: center; border: 1px solid rgba(255,255,255,0.05); }
        .current-call-circle .l { font-size: 9px; font-weight: 800; opacity: 0.6; margin-bottom: 2px; }
        .call-num { width: 60px; height: 60px; background: #FF5722; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 900; color: white; position: relative; }
        .pulse-ring { position: absolute; width: 100%; height: 100%; border-radius: 50%; border: 3px solid #FF5722; animation: proPulse 2s infinite; }
        @keyframes proPulse { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(1.6); opacity: 0; } }

        /* USER CARDS */
        .user-cards-scroll { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding-bottom: 20px; }
        .user-cards-scroll::-webkit-scrollbar { display: none; }
        
        .mini-card-wrapper { background: #3E271F; border-radius: 16px; padding: 10px; border: 1px solid rgba(212, 175, 55, 0.3); }
        .mini-card-header { display: grid; grid-template-columns: repeat(5, 1fr); text-align: center; font-size: 14px; font-weight: 900; margin-bottom: 6px; }
        .mini-card-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2px; }
        .mini-cell { aspect-ratio: 1; background: rgba(0,0,0,0.2); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900; border: 1px solid rgba(255,255,255,0.05); }
        .mini-cell.marked { background: #22c55e; color: white; border-color: #16a34a; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2); }
        .mini-card-footer { font-size: 9px; font-weight: 800; text-align: center; margin-top: 8px; opacity: 0.5; letter-spacing: 1px; }

        /* BOTTOM ACTIONS */
        .pro-bottom-actions { padding: 12px; background: rgba(0,0,0,0.3); display: flex; flex-direction: column; gap: 10px; }
        .btn-bingo-main { width: 100%; background: #6B7280; color: white; border: none; padding: 16px; border-radius: 14px; font-size: 18px; font-weight: 900; letter-spacing: 2px; box-shadow: 0 5px 0 #4B5563; }
        .aux-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .btn-aux { border: none; border-radius: 12px; padding: 12px; color: white; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; cursor: pointer; }
        .btn-aux.refresh { background: #F97316; box-shadow: 0 4px 0 #EA580C; }
        .btn-aux.leave { background: #EF4444; box-shadow: 0 4px 0 #DC2626; }

        /* OVERLAY */
        .pro-overlay-winner { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 2000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); }
        .win-card { background: #3E271F; width: 85%; max-width: 350px; border-radius: 30px; padding: 40px 20px; text-align: center; border: 2px solid #D4AF37; animation: proPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        @keyframes proPop { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .trophy-gold { color: #D4AF37; margin-bottom: 20px; filter: drop-shadow(0 0 15px #D4AF37); }
        .win-card h2 { font-size: 24px; font-weight: 900; color: white; margin-bottom: 20px; }
        .winner-stack { display: flex; flex-direction: column; gap: 8px; margin-bottom: 30px; }
        .winner-item { background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; }
        .winner-item .n { font-weight: 900; }
        .winner-item .a { font-size: 11px; font-weight: 800; color: #D4AF37; }
        .btn-back-home { width: 100%; background: #22c55e; color: white; border: none; padding: 16px; border-radius: 14px; font-weight: 900; box-shadow: 0 5px 0 #16a34a; }
      `}</style>
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="loading"><div className="spinner" /><span>JOINING GAME...</span></div>}>
      <GameContent />
    </Suspense>
  );
}
