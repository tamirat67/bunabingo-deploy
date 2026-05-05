'use client';
import { useEffect, useState } from 'react';
import { getRooms, getWallet } from '../../lib/api';
import Navbar from '../../components/Navbar';
import { useRouter } from 'next/navigation';
import { useToast } from '../../components/Toast';

interface Room {
  id: string;
  type: 'CASUAL' | 'STANDARD' | 'JACKPOT' | 'VIP';
  ticketPrice: string;
  currentPlayers: number;
}

export default function LobbyPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { show } = useToast();

  useEffect(() => {
    Promise.all([getRooms(), getWallet()])
      .then(([r, w]) => {
        setRooms(r);
        setWallet(w);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleJoin = (type: string, price: string) => {
    router.push(`/tickets/select?type=${type}&price=${price}`);
  };

  const handleTry = () => {
    show('Starting Practice Mode... 🎮', 'info');
    setTimeout(() => router.push('/tickets/select?type=CASUAL&price=0&demo=true'), 1000);
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="lobby-container">
      {/* ─── Top Navigation ──────────────────────────────────── */}
      <div className="lobby-nav">
        <div className="nav-left">
          <span className="live-dot pulse"></span>
          <span className="live-lbl">Live</span>
        </div>
        <div className="nav-right">
          <div className="nav-stat">
            <span className="icon yellow">🎗️</span>
            <span className="lbl">Bonus:</span>
            <span className="val yellow">0.00</span>
          </div>
          <div className="nav-stat">
            <span className="icon green">👛</span>
            <span className="lbl">Balance:</span>
            <span className="val">{Number(wallet?.balance || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* ─── Bingo Games Section ───────────────────────────── */}
      <div className="section-title">
        <span className="emoji">🎯</span> BINGO GAMES
      </div>

      <div className="column-headers">
        <span>BET</span>
        <span>WIN/PLAYER</span>
        <span>STATUS & JOIN</span>
      </div>

      <div className="game-list">
        {[10, 20, 50, 100].map((price, idx) => {
          const type = price === 10 ? 'CASUAL' : price === 20 ? 'STANDARD' : price === 50 ? 'JACKPOT' : 'VIP';
          const players = price === 10 ? 74 : 0;
          const win = price === 10 ? 592 : 0;
          return (
            <div key={`bingo-${price}`}>
              <div className="room-row">
                <div className="col-bet">
                  <div className="v">{price}</div>
                  <div className="l">ETB</div>
                </div>
                <div className="col-win">
                  <div className="win-main">
                    <span className="trophy">🏆</span>
                    <div className="win-stack">
                      <div className="win-val yellow">{win}</div>
                      <div className="win-count">{players} players</div>
                    </div>
                  </div>
                </div>
                <div className="col-status">
                  <div className="badge active">ACTIVE {price === 50 ? 1 : 0}</div>
                  <div className="ready-box">READY</div>
                  <div className="join-wrap">
                    {(price === 10 || price === 100) && <div className="bonus-tag">🎗️ BONUS</div>}
                    <button className="btn-join green" onClick={() => handleJoin(type, price.toString())}>JOIN</button>
                  </div>
                </div>
              </div>
              <div className="jackpot-divider">JACKPOT {price === 10 ? 508 : 0} / 1000</div>
            </div>
          );
        })}

        {/* Free Demo */}
        <div className="room-row demo">
          <div className="col-bet">
            <div className="v">FREE</div>
            <div className="l">DEMO</div>
          </div>
          <div className="col-win">
            <div className="win-main">
              <span className="play-icon">▶️</span>
              <div className="win-stack">
                <div className="demo-title">Practice Mode</div>
                <div className="win-count">No real money</div>
              </div>
            </div>
          </div>
          <div className="col-status">
            <div className="open-lbl">OPEN</div>
            <button className="btn-try" onClick={handleTry}>TRY</button>
          </div>
        </div>
      </div>

      {/* ─── Spin Games Section ────────────────────────────── */}
      <div className="section-title sp-mt">
        <span className="emoji">🎰</span> SPIN GAMES
      </div>

      <div className="game-list">
        {[10, 20, 50, 100].map((price) => (
          <div key={`spin-${price}`}>
            <div className="room-row">
              <div className="col-bet">
                <div className="v">{price}</div>
                <div className="l">ETB</div>
              </div>
              <div className="col-win">
                <div className="win-main">
                  <span className="trophy">🏆</span>
                  <div className="win-stack">
                    <div className="win-val yellow">0</div>
                    <div className="win-count">0 players</div>
                  </div>
                </div>
              </div>
              <div className="col-status">
                <div className="badge active">ACTIVE 0</div>
                <div className="ready-box">READY</div>
                <div className="join-wrap">
                  {price === 10 && <div className="bonus-tag">🎗️ BONUS</div>}
                  <button className="btn-join outline" onClick={() => show(`Spin ${price} ETB coming soon! 🎰`, 'info')}>JOIN</button>
                </div>
              </div>
            </div>
            <div className="jackpot-divider">JACKPOT 0 / 1000</div>
          </div>
        ))}
      </div>

      <Navbar />

      <style jsx>{`
        .lobby-container { min-height: 100vh; background: #a68cc5; padding-bottom: 90px; color: white; }
        .lobby-nav { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(0,0,0,0.1); }
        .nav-left { display: flex; align-items: center; gap: 6px; }
        .live-dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
        .live-lbl { font-size: 13px; font-weight: 600; opacity: 0.8; }
        .nav-right { display: flex; gap: 14px; }
        .nav-stat { display: flex; align-items: center; gap: 4px; font-size: 14px; font-weight: 700; }
        .yellow { color: #facc15; }
        .green { color: #4ade80; }
        .section-title { padding: 20px 16px 12px; font-size: 16px; font-weight: 900; letter-spacing: 0.5px; opacity: 0.9; }
        .sp-mt { margin-top: 10px; }
        .emoji { margin-right: 8px; }
        .column-headers { display: grid; grid-template-columns: 80px 1fr 100px; padding: 0 16px 8px; font-size: 11px; font-weight: 800; opacity: 0.5; }
        .room-row { display: grid; grid-template-columns: 80px 1fr 100px; background: rgba(255,255,255,0.15); padding: 14px 16px; align-items: center; position: relative; }
        .room-row.demo { background: rgba(255,255,255,0.08); }
        .col-bet { text-align: center; border-right: 1px solid rgba(255,255,255,0.1); }
        .col-bet .v { font-size: 24px; font-weight: 900; line-height: 1; }
        .col-bet .l { font-size: 10px; opacity: 0.6; font-weight: 700; margin-top: 4px; }
        .col-win { padding: 0 16px; }
        .win-main { display: flex; align-items: center; gap: 12px; }
        .trophy { font-size: 26px; opacity: 0.8; }
        .play-icon { font-size: 20px; opacity: 0.6; }
        .win-stack { display: flex; flex-direction: column; }
        .win-val { font-size: 20px; font-weight: 900; }
        .win-count { font-size: 11px; opacity: 0.5; font-weight: 600; }
        .demo-title { font-size: 16px; font-weight: 800; }
        .col-status { display: flex; flex-direction: column; align-items: center; gap: 5px; }
        .badge.active { background: #3b82f6; font-size: 9px; font-weight: 900; padding: 2px 8px; border-radius: 99px; }
        .ready-box { background: rgba(0,0,0,0.2); color: #4ade80; font-size: 11px; font-weight: 900; padding: 4px 10px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05); }
        .open-lbl { font-size: 11px; font-weight: 900; opacity: 0.6; }
        .join-wrap { display: flex; flex-direction: column; align-items: center; width: 100%; }
        .bonus-tag { background: #facc15; color: #000; font-size: 9px; font-weight: 900; padding: 1px 6px; border-radius: 4px; margin-bottom: -4px; z-index: 2; border: 1px solid rgba(0,0,0,0.1); }
        .btn-join { width: 100%; border: none; color: white; padding: 8px; border-radius: 8px; font-weight: 900; font-size: 14px; box-shadow: 0 4px 0 rgba(0,0,0,0.2); cursor: pointer; }
        .btn-join.green { background: #22c55e; box-shadow: 0 4px 0 #15803d; }
        .btn-join.outline { background: transparent; color: #6F4E37; border: 2.5px solid #6F4E37; box-shadow: none; }
        .btn-join:active { transform: translateY(2px); box-shadow: none; }
        .btn-try { background: #64748b; border: none; color: white; padding: 8px 24px; border-radius: 8px; font-weight: 900; font-size: 14px; box-shadow: 0 4px 0 #334155; cursor: pointer; }
        .jackpot-divider { font-size: 9px; font-weight: 900; text-align: center; color: rgba(255,255,255,0.7); display: flex; align-items: center; gap: 10px; padding: 0 16px; margin: 6px 0; }
        .jackpot-divider::before, .jackpot-divider::after { content: ""; flex: 1; height: 1px; background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
