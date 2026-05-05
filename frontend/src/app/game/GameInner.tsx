'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Pusher from 'pusher-js';
import { getGame, getMyCard, pusherAuth } from '../../lib/api';
import BingoCard from '../../components/BingoCard';
import WinnerPopup from '../../components/WinnerPopup';
import Navbar from '../../components/Navbar';
import { Target, Trophy, Info, Clock, Volume2 } from 'lucide-react';

type Cell = number | 'FREE';
interface GameState {
  status: string;
  countdownSeconds: number | null;
  drawHistory: { number: number; sequence: number }[];
  tickets: { userId: string }[];
  room: { type: string; ticketPrice: string };
  totalPrize: string;
  winners: { userId: string; winMode: string; prizeAmount: string; user: { firstName: string } }[];
}

export default function GameInner() {
  const params = useSearchParams();
  const gameId = params.get('id') ?? '';

  const [game, setGame] = useState<GameState | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [activeTicketIdx, setIdx] = useState(0);
  const [drawn, setDrawn] = useState<number[]>([]);
  const [lastBall, setLastBall] = useState<number | null>(null);
  const [countdown, setCd] = useState<number | null>(null);
  const [winEvent, setWinEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Settings
  const [isDark, setIsDark] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  const cdRef = useRef<NodeJS.Timeout | null>(null);

  // --- Voice Announcer Logic ---
  const announceNumber = (num: number) => {
    if (typeof window !== 'undefined' && localStorage.getItem('buna-sound') !== 'off') {
      const msg = new SpeechSynthesisUtterance(`Number ${num}`);
      msg.rate = 1.1;
      msg.pitch = 1;
      window.speechSynthesis.speak(msg);
    }
  };

  useEffect(() => {
    // Theme Check
    const savedTheme = localStorage.getItem('buna-theme');
    setIsDark(savedTheme === 'dark');
    setSoundOn(localStorage.getItem('buna-sound') !== 'off');

    if (!gameId) return;
    Promise.all([getGame(gameId), getMyCard(gameId)])
      .then(([g, res]) => {
        setGame(g);
        setTickets(res.tickets || []);
        const nums = g.drawHistory.map((d: any) => d.number);
        setDrawn(nums);
        if (nums.length) setLastBall(nums[nums.length - 1]);
        if (g.status === 'COUNTDOWN' && g.countdownSeconds) startCd(g.countdownSeconds);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authorizer: channel => ({
        authorize: async (socketId, cb) => {
          try { cb(null, await pusherAuth(socketId, channel.name)); }
          catch (e: any) { cb(e, null); }
        },
      }),
    });

    const ch = pusher.subscribe(`game-${gameId}`);
    ch.bind('number-drawn', (d: { number: number }) => {
      setLastBall(d.number);
      setDrawn(prev => [...prev, d.number]);
      announceNumber(d.number); // <-- VOICEOVER
    });
    // ... (other binds)
    return () => pusher.unsubscribe(`game-${gameId}`);
  }, [gameId]);

  function startCd(secs: number) {
    setCd(secs);
    let s = secs;
    cdRef.current = setInterval(() => {
      s--; setCd(s);
      if (s <= 0) clearInterval(cdRef.current!);
    }, 1000);
  }

  if (loading) return <div className="loading"><div className="spinner" /><span>PREPARING ARENA...</span></div>;

  return (
    <div className={`game-container ${isDark ? 'dark' : 'gold'}`}>
      {winEvent && <WinnerPopup winMode={winEvent.winMode} amount={winEvent.prizeAmount} onClose={() => setWinEvent(null)} />}

      <div className="game-hdr">
        <div className="hdr-left">
          <h1 className="room-title">Buna {game?.room.type}</h1>
          <div className="status-lbl">
             <span className="dot pulse"></span> LIVE DRAW
          </div>
        </div>
        <div className="prize-pill">
           <Trophy size={18} />
           <span>{Number(game?.totalPrize).toFixed(0)} ETB</span>
        </div>
      </div>

      <div className="game-body">
        {/* Drawn Ball Display */}
        {lastBall && (
          <div className="ball-master">
            <div className="ball-header">
               <Volume2 size={14} className={soundOn ? 'active' : 'muted'} />
               <span>Now Calling</span>
            </div>
            <div className="ball-main">{lastBall}</div>
            <div className="recent-row">
              {drawn.slice(-5).reverse().map(n => <div key={n} className="ball-mini">{n}</div>)}
            </div>
          </div>
        )}

        {/* Countdown */}
        {game?.status === 'COUNTDOWN' && countdown !== null && (
          <div className="cd-overlay">
            <div className="cd-title">Game Starts In</div>
            <div className="cd-big">{countdown}</div>
            <Clock size={24} />
          </div>
        )}

        {/* Card Switcher */}
        {tickets.length > 1 && (
          <div className="switcher">
            {tickets.map((_, i) => (
              <button key={i} className={`sw-btn ${activeTicketIdx === i ? 'on' : ''}`} onClick={() => setIdx(i)}>
                Card {i+1}
              </button>
            ))}
          </div>
        )}

        <div className="card-container">
           <div className="card-top">
              <Target size={16} /> <span>CARD #{activeTicketIdx + 1}</span>
           </div>
           <BingoCard card={tickets[activeTicketIdx]?.card} drawnNumbers={drawn} />
        </div>
      </div>

      <Navbar />

      <style jsx>{`
        .game-container { min-height: 100vh; padding: 16px; padding-bottom: 100px; transition: 0.3s; }
        .game-container.gold { background: #F5E6BE; color: #000; }
        .game-container.dark { background: #0d1117; color: #c9d1d9; }

        .game-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .room-title { font-size: 20px; font-weight: 900; color: #4B3621; }
        .dark .room-title { color: #facc15; }
        .status-lbl { font-size: 11px; font-weight: 800; color: #2d6a4f; display: flex; align-items: center; gap: 4px; }
        .dark .status-lbl { color: #4ade80; }

        .prize-pill { background: #4B3621; color: #F5E6BE; padding: 8px 16px; border-radius: 99px; display: flex; align-items: center; gap: 8px; font-weight: 900; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .dark .prize-pill { background: #238636; color: white; }

        .ball-master { background: white; border-radius: 24px; padding: 20px; text-align: center; margin-bottom: 20px; border: 2px solid #E6D5A8; box-shadow: 0 10px 30px rgba(75, 54, 33, 0.1); }
        .dark .ball-master { background: #161b22; border-color: #30363d; }
        .ball-header { font-size: 12px; font-weight: 800; opacity: 0.6; display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 10px; }
        .ball-main { width: 85px; height: 85px; background: #4B3621; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 44px; font-weight: 900; margin: 0 auto 16px; border: 4px solid #F5E6BE; }
        .dark .ball-main { background: #1f6feb; border-color: #388bfd; }
        .ball-mini { width: 34px; height: 34px; background: #FFF9E6; border: 1px solid #E6D5A8; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 900; }
        .dark .ball-mini { background: #0d1117; border-color: #30363d; }

        .card-container { background: white; border-radius: 20px; overflow: hidden; border: 2.5px solid #4B3621; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
        .dark .card-container { border-color: #30363d; background: #0d1117; }
        .card-top { background: #4B3621; padding: 12px; color: #F5E6BE; font-size: 12px; font-weight: 900; display: flex; align-items: center; gap: 8px; }
        .dark .card-top { background: #161b22; color: #8b949e; }

        .switcher { display: flex; gap: 8px; margin-bottom: 12px; }
        .sw-btn { flex: 1; padding: 12px; border-radius: 12px; background: #FFF9E6; border: 1px solid #E6D5A8; font-weight: 800; cursor: pointer; color: #4B3621; }
        .sw-btn.on { background: #4B3621; color: #F5E6BE; border-color: #4B3621; }
        .dark .sw-btn { background: #161b22; border-color: #30363d; color: #8b949e; }
        .dark .sw-btn.on { background: #1f6feb; color: white; border-color: #1f6feb; }
      `}</style>
    </div>
  );
}
