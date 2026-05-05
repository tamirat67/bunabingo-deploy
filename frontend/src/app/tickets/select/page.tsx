'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getWallet, joinGame } from '../../../lib/api';
import Navbar from '../../../components/Navbar';
import Toast from '../../../components/Toast';

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
      {/* ─── Top Stats ────────────────────────────────────── */}
      <div className="stats-row">
        <div className="stat-capsule">
          <div className="lbl">Wallet</div>
          <div className="val">{Number(wallet?.balance || 0).toFixed(0)}</div>
        </div>
        <div className="stat-capsule">
          <div className="lbl">Bonus</div>
          <div className="val">0</div>
        </div>
        <div className="stat-capsule">
          <div className="lbl">Active Game</div>
          <div className="val">1</div>
        </div>
        <div className="stat-capsule">
          <div className="lbl">Stake</div>
          <div className="val">{stake}</div>
        </div>
      </div>

      {/* ─── Jackpot ──────────────────────────────────────── */}
      <div className="jackpot-card">
        <div className="jp-header">
          <span>JACKPOT</span>
          <span>477 / 1000</span>
        </div>
        <div className="jp-progress">
          <div className="jp-fill" style={{ width: '47%' }}></div>
        </div>
      </div>

      {/* ─── Balance Warning ──────────────────────────────── */}
      {!hasBalance && (
        <div className="balance-warning">
          Please top up your wallet. If you already have and are still seeing this, please refresh the page.
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

      {/* ─── Actions ──────────────────────────────────────── */}
      <div className="action-row">
        <button className="btn-refresh" onClick={() => window.location.reload()}>Refresh</button>
        <button 
          className={`btn-start ${!selectedCard || !hasBalance || loading ? 'disabled' : ''}`}
          onClick={handleStart}
          disabled={loading}
        >
          {loading ? 'Joining...' : 'Start Game'}
        </button>
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <Navbar />

      <style jsx>{`
        .select-container { min-height: 100vh; background: #a68cc5; padding: 16px; padding-bottom: 90px; }
        
        .stats-row { 
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px;
        }
        .stat-capsule {
          background: white; border-radius: 99px; padding: 6px 4px; text-align: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat-capsule .lbl { font-size: 10px; color: #8e74b8; font-weight: 700; margin-bottom: 2px; }
        .stat-capsule .val { font-size: 13px; color: #333; font-weight: 800; }

        .jackpot-card { 
          background: white; border-radius: 12px; padding: 8px 12px; margin-bottom: 16px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .jp-header { display: flex; justify-content: space-between; font-size: 11px; font-weight: 900; color: #555; margin-bottom: 4px; }
        .jp-progress { height: 8px; background: #eee; border-radius: 4px; overflow: hidden; }
        .jp-fill { height: 100%; background: #facc15; }

        .balance-warning {
          background: #fecaca; color: #dc2626; padding: 12px; border-radius: 12px;
          font-size: 13px; font-weight: 600; text-align: center; line-height: 1.4;
          margin-bottom: 16px; border: 1px solid #f87171;
        }

        .card-grid {
          display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px;
          background: rgba(255,255,255,0.2); padding: 8px; border-radius: 12px;
        }
        .grid-item {
          aspect-ratio: 1; background: #c3b1db; border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 800; color: #4b3b63; cursor: pointer;
          transition: all 0.2s;
        }
        .grid-item.selected { background: #3b82f6; color: white; transform: scale(1.1); z-index: 10; }

        .action-row { display: flex; gap: 12px; margin-top: 20px; }
        .btn-refresh { 
          flex: 1; background: #3b82f6; border: none; color: white; padding: 12px; 
          border-radius: 99px; font-weight: 800; box-shadow: 0 4px 0 #2563eb;
        }
        .btn-start { 
          flex: 1; background: #f97316; border: none; color: white; padding: 12px; 
          border-radius: 99px; font-weight: 800; box-shadow: 0 4px 0 #ea580c;
        }
        .btn-start.disabled { background: #d1d5db; box-shadow: 0 4px 0 #9ca3af; opacity: 0.7; }
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
