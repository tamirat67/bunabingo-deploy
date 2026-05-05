'use client';
import { useEffect, useState } from 'react';
import { getRooms, getWallet, joinGame } from '../../lib/api';
import Navbar from '../../components/Navbar';
import { useRouter } from 'next/navigation';
import Toast from '../../components/Toast';

interface Room {
  id: string;
  type: 'CASUAL' | 'STANDARD' | 'JACKPOT';
  ticketPrice: string;
  currentPlayers: number;
  games: any[];
}

export default function LobbyPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const router = useRouter();

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

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="lobby-container">
      {/* ─── Top Bar ────────────────────────────────────────── */}
      <div className="lobby-header">
        <div className="status-live">
          <span className="dot pulse"></span> Live
        </div>
        <div className="header-stats">
          <div className="header-stat">
            <span className="stat-icon">🎗️</span>
            <span className="stat-label">Bonus: </span>
            <span className="stat-val yellow">0.00</span>
          </div>
          <div className="header-stat">
            <span className="stat-icon">👛</span>
            <span className="stat-label">Balance: </span>
            <span className="stat-val yellow">{Number(wallet?.balance || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* ─── Bingo Games Section ───────────────────────────── */}
      <div className="lobby-section">
        <div className="section-header">
          <span className="icon">🎯</span> BINGO GAMES
        </div>

        <div className="game-list">
          {rooms.map((room, idx) => {
            const players = room.currentPlayers || 0;
            const price = Number(room.ticketPrice).toFixed(0);
            const potentialWin = Number(price) * 10; // Estimated for UI

            return (
              <div key={room.id}>
                <div className="room-row">
                  <div className="col-bet">
                    <div className="val">{price}</div>
                    <div className="lbl">ETB</div>
                  </div>
                  
                  <div className="col-win">
                    <div className="win-wrap">
                      <span className="win-icon">🏆</span>
                      <div className="win-info">
                        <div className="win-val yellow">{potentialWin}</div>
                        <div className="win-players">{players} players</div>
                      </div>
                    </div>
                  </div>

                  <div className="col-action">
                    <div className="badge-active">ACTIVE {Math.floor(players/5)}</div>
                    <div className="status-ready">READY</div>
                    <button onClick={() => handleJoin(room.type, price)} className="btn-join">
                      JOIN
                    </button>
                  </div>
                </div>
                
                {/* Jackpot Progress Bar between items */}
                <div className="jackpot-bar-wrap">
                  <div className="jackpot-label">JACKPOT {idx * 250}/1000</div>
                  <div className="jackpot-progress">
                    <div className="progress-fill" style={{ width: `${idx * 25}%` }}></div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Practice Mode */}
          <div className="room-row practice">
            <div className="col-bet">
              <div className="val">FREE</div>
              <div className="lbl">DEMO</div>
            </div>
            <div className="col-win">
              <div className="win-info">
                <div className="win-label">Practice Mode</div>
                <div className="win-desc">No real money</div>
              </div>
            </div>
            <div className="col-action">
              <div className="status-open">OPEN</div>
              <button className="btn-try">TRY</button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Spin Games Section ────────────────────────────── */}
      <div className="lobby-section">
        <div className="section-header">
          <span className="icon">🎰</span> SPIN GAMES
        </div>
        <div className="game-list muted">
          <div className="room-row disabled">
            <div className="col-bet"><div className="val">10</div><div className="lbl">ETB</div></div>
            <div className="col-win"><div className="win-info">Coming Soon...</div></div>
            <div className="col-action"><button className="btn-join disabled">LOCK</button></div>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <Navbar />

      <style jsx>{`
        .lobby-container { min-height: 100vh; background: #8e74b8; color: white; padding-bottom: 80px; }
        
        .lobby-header { 
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 16px; background: rgba(0,0,0,0.1); border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .status-live { display: flex; align-items: center; gap: 6px; font-size: 12px; opacity: 0.8; }
        .dot { width: 8px; height: 8px; background: #4ade80; border-radius: 50%; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }

        .header-stats { display: flex; gap: 12px; }
        .header-stat { display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; }
        .yellow { color: #facc15; }

        .lobby-section { padding: 16px 0; }
        .section-header { 
          padding: 0 16px 12px; font-weight: 800; font-size: 14px; 
          display: flex; align-items: center; gap: 8px; letter-spacing: 1px;
        }

        .room-row {
          display: grid; grid-template-columns: 80px 1fr 100px;
          background: rgba(255,255,255,0.1); padding: 12px 16px;
          align-items: center; position: relative;
        }
        .room-row.practice { background: rgba(255,255,255,0.05); }
        .room-row.disabled { opacity: 0.5; }

        .col-bet { text-align: center; border-right: 1px solid rgba(255,255,255,0.1); }
        .col-bet .val { font-size: 20px; font-weight: 900; line-height: 1; }
        .col-bet .lbl { font-size: 10px; opacity: 0.7; font-weight: 700; margin-top: 4px; }

        .col-win { padding: 0 16px; }
        .win-wrap { display: flex; align-items: center; gap: 10px; }
        .win-icon { font-size: 24px; }
        .win-val { font-size: 18px; font-weight: 800; }
        .win-players { font-size: 11px; opacity: 0.7; font-weight: 500; }

        .win-label { font-size: 16px; font-weight: 700; }
        .win-desc { font-size: 11px; opacity: 0.6; }

        .col-action { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .badge-active { background: #3b82f6; font-size: 9px; padding: 2px 6px; border-radius: 99px; font-weight: 800; }
        .status-ready { color: #4ade80; font-size: 11px; font-weight: 800; }
        .status-open { color: #fff; font-size: 11px; font-weight: 800; opacity: 0.7; }
        
        .btn-join {
          background: #22c55e; border: none; color: white; padding: 6px 18px;
          border-radius: 8px; font-weight: 800; font-size: 13px;
          box-shadow: 0 4px 0 #15803d;
        }
        .btn-join:active { transform: translateY(2px); box-shadow: 0 2px 0 #15803d; }
        .btn-try {
          background: #64748b; border: none; color: white; padding: 6px 18px;
          border-radius: 8px; font-weight: 800; font-size: 13px;
          box-shadow: 0 4px 0 #334155;
        }

        .jackpot-bar-wrap { 
          position: relative; height: 16px; margin: -8px 0; z-index: 2;
          display: flex; align-items: center; justify-content: center;
        }
        .jackpot-label { 
          position: absolute; font-size: 9px; font-weight: 900; 
          text-transform: uppercase; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }
        .jackpot-progress { width: 100%; height: 4px; background: rgba(0,0,0,0.3); }
        .progress-fill { height: 100%; background: #facc15; box-shadow: 0 0 8px #facc15; }
      `}</style>
    </div>
  );
}
