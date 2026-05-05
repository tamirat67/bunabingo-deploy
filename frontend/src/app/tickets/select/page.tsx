'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getWallet, joinGame } from '../../../lib/api';
import Navbar from '../../../components/Navbar';
import Toast from '../../../components/Toast';

// Helper to generate a deterministic card preview based on ID
function generatePreview(seed: number) {
  const card: (number | string)[][] = [];
  const ranges = [[1,15], [16,30], [31,45], [46,60], [61,75]];
  
  for (let r = 0; r < 5; r++) {
    const row: (number | string)[] = [];
    for (let c = 0; c < 5; c++) {
      if (r === 2 && c === 2) {
        row.push('*');
        continue;
      }
      // Deterministic "random" based on seed + r + c
      const [min, max] = ranges[c];
      const val = min + ((seed * (r + 1) * (c + 1)) % (max - min + 1));
      row.push(val);
    }
    card.push(row);
  }
  return card;
}

function SelectCardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomType = searchParams.get('type') || 'CASUAL';
  const stake = searchParams.get('price') || '10';

  const [wallet, setWallet] = useState<any>(null);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    getWallet().then(setWallet).catch(() => {});
  }, []);

  const hasBalance = Number(wallet?.balance || 0) >= Number(stake);
  const previewCard = selectedCard ? generatePreview(selectedCard) : null;

  const handleStart = async () => {
    if (!selectedCard) return setToast({ msg: 'Please select a card number!', type: 'error' });
    if (!hasBalance) return setToast({ msg: 'Insufficient balance!', type: 'error' });

    setLoading(true);
    try {
      const { game } = await joinGame(roomType);
      router.push(`/game?id=${game.id}`);
    } catch (err: any) {
      setToast({ msg: err.response?.data?.error || 'Failed to join game', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="select-container">
      {/* ─── Top Status ────────────────────────────────────── */}
      <div className="connection-status">
        <span className="wifi-icon">📶</span> CONNECTED
      </div>

      <div className="stats-row">
        <div className="stat-capsule">
          <div className="lbl orange">Active Game</div>
          <div className="val">1</div>
        </div>
        <div className="stat-capsule">
          <div className="lbl orange">Stake</div>
          <div className="val">{stake}</div>
        </div>
        <div className="stat-capsule">
          <div className="lbl orange">Wallet</div>
          <div className="val">{Number(wallet?.balance || 0).toFixed(0)}</div>
        </div>
        <div className="stat-capsule">
          <div className="lbl orange">Bonus Wallet</div>
          <div className="val">0</div>
        </div>
      </div>

      {/* ─── Balance Warning ──────────────────────────────── */}
      {!hasBalance && (
        <div className="balance-warning">
          <p>Please top up your wallet. If you already have and are still seeing this, please refresh the page.</p>
          <button className="btn-deposit-now" onClick={() => router.push('/deposit')}>
            📥 Deposit Now
          </button>
        </div>
      )}

      {/* ─── 1-100 Grid ───────────────────────────────────── */}
      <div className="card-grid">
        {Array.from({ length: 100 }, (_, i) => i + 1).map((num) => (
          <div
            key={num}
            className={`grid-item ${selectedCard === num ? 'selected' : ''}`}
            onClick={() => setSelectedCard(num)}
          >
            {num}
          </div>
        ))}
      </div>

      {/* ─── Cartela Preview (The Hint) ────────────────────── */}
      <div className="bottom-area">
        <div className="preview-wrap">
          {previewCard ? (
            <div className="cartela-hint">
              {previewCard.map((row, ri) => (
                <div key={ri} className="hint-row">
                  {row.map((cell, ci) => (
                    <span key={ci} className={`hint-cell ${cell === '*' ? 'star' : ''}`}>
                      {cell}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="preview-placeholder">Select a number to see card pattern</div>
          )}
        </div>

        <div className="action-btns">
          <button className="btn-refresh" onClick={() => window.location.reload()}>Refresh</button>
          <button 
            className={`btn-start ${!selectedCard || !hasBalance || loading ? 'disabled' : ''}`}
            onClick={handleStart}
            disabled={loading}
          >
            {loading ? 'Joining...' : 'Start Game'}
          </button>
        </div>
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <Navbar />

      <style jsx>{`
        .select-container { min-height: 100vh; background: #a68cc5; padding: 16px; padding-bottom: 90px; }
        
        .connection-status { text-align: center; color: #4ade80; font-weight: 800; font-size: 14px; margin-bottom: 12px; }
        .wifi-icon { margin-right: 4px; }

        .stats-row { 
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 16px;
        }
        .stat-capsule {
          background: white; border-radius: 8px; padding: 6px 2px; text-align: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat-capsule .lbl { font-size: 9px; color: #f97316; font-weight: 800; margin-bottom: 4px; text-transform: uppercase; }
        .stat-capsule .val { font-size: 14px; color: #333; font-weight: 800; }

        .balance-warning {
          background: #fecaca; color: #dc2626; padding: 12px; border-radius: 12px;
          font-size: 13px; font-weight: 600; text-align: center; line-height: 1.4;
          margin-bottom: 16px; border: 1px solid #f87171;
        }
        .btn-deposit-now {
          margin-top: 8px; background: #dc2626; color: white; border: none; 
          padding: 6px 20px; border-radius: 99px; font-weight: 800; font-size: 13px;
          box-shadow: 0 4px 0 #991b1b; cursor: pointer;
        }

        .card-grid {
          display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px;
          background: rgba(255,255,255,0.3); padding: 6px; border-radius: 12px;
          margin-bottom: 20px;
        }
        .grid-item {
          aspect-ratio: 1; background: #e0d4f0; border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 800; color: #4b3b63; cursor: pointer;
        }
        .grid-item.selected { background: #22c55e; color: white; border: 2px solid #fff; }

        .bottom-area { display: flex; align-items: flex-end; gap: 12px; margin-top: 10px; }
        
        .preview-wrap { flex: 0 0 120px; min-height: 110px; }
        .preview-placeholder { 
          font-size: 9px; opacity: 0.5; color: white; text-align: center; 
          padding-top: 40px; line-height: 1.2; font-weight: 700;
        }

        .cartela-hint {
          background: rgba(255,255,255,0.2); padding: 8px; border-radius: 12px;
          display: flex; flex-direction: column; gap: 2px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.1);
          animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .hint-row { display: flex; gap: 2px; justify-content: center; }
        .hint-cell { 
          width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
          font-size: 8px; font-weight: 900; color: #4b3b63; opacity: 0.8;
        }
        .hint-cell.star { color: #facc15; font-size: 12px; }

        .action-btns { flex: 1; display: flex; flex-direction: column; gap: 10px; }
        .btn-refresh { 
          background: #3b82f6; border: none; color: white; padding: 12px; 
          border-radius: 12px; font-weight: 900; font-size: 18px; box-shadow: 0 4px 0 #2563eb;
        }
        .btn-start { 
          background: #f97316; border: none; color: white; padding: 12px; 
          border-radius: 12px; font-weight: 900; font-size: 18px; box-shadow: 0 4px 0 #ea580c;
        }
        .btn-start.disabled { background: #666; opacity: 0.5; box-shadow: none; }
      `}</style>
    </div>
  );
}

export default function SelectCardPage() {
  return (
    <Suspense fallback={<div className="loading">Loading...</div>}>
      <SelectCardInner />
    </Suspense>
  );
}
