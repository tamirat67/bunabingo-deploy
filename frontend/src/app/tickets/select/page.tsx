'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getWallet, joinGame } from '../../../lib/api';
import { PREDEFINED_CARDS } from '../../../lib/predefinedCards';
import Navbar from '../../../components/Navbar';
import Toast from '../../../components/Toast';

function SelectCardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomType = searchParams.get('type') || 'CASUAL';
  const pricePerCard = Number(searchParams.get('price') || '10');

  const [wallet, setWallet] = useState<any>(null);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    getWallet().then(setWallet).catch(() => {});
  }, []);

  const totalStake = selectedCards.length * pricePerCard;
  const hasBalance = Number(wallet?.balance || 0) >= totalStake;
  
  // Show preview for the last selected card
  const lastSelected = selectedCards[selectedCards.length - 1];
  const previewCard = lastSelected ? PREDEFINED_CARDS[lastSelected] : null;

  const toggleCard = (num: number) => {
    if (selectedCards.includes(num)) {
      setSelectedCards(selectedCards.filter(n => n !== num));
    } else {
      if (selectedCards.length >= 3) {
        setToast({ msg: 'Max 3 cards allowed!', type: 'error' });
        return;
      }
      setSelectedCards([...selectedCards, num]);
    }
  };

  const handleStart = async () => {
    if (selectedCards.length === 0) return setToast({ msg: 'Please select at least one card!', type: 'error' });
    if (!hasBalance) return setToast({ msg: 'Insufficient balance for all cards!', type: 'error' });

    setLoading(true);
    try {
      // Join for each selected card
      for (const cardId of selectedCards) {
        await joinGame(roomType, cardId);
      }
      // Redirect to game with the last one (live game will handle all)
      router.push(`/history`); // For now redirecting to history to see tickets
      setToast({ msg: `Successfully joined with ${selectedCards.length} cards!`, type: 'success' });
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
          <div className="lbl orange">Cards</div>
          <div className="val">{selectedCards.length} / 3</div>
        </div>
        <div className="stat-capsule">
          <div className="lbl orange">Total Stake</div>
          <div className="val">{totalStake}</div>
        </div>
        <div className="stat-capsule">
          <div className="lbl orange">Wallet</div>
          <div className="val">{Number(wallet?.balance || 0).toFixed(0)}</div>
        </div>
        <div className="stat-capsule">
          <div className="lbl orange">Bonus</div>
          <div className="val">0</div>
        </div>
      </div>

      {/* ─── Balance Warning ──────────────────────────────── */}
      {!hasBalance && (
        <div className="balance-warning">
          <p>Insufficient balance for {selectedCards.length} cards ({totalStake} ETB).</p>
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
            className={`grid-item ${selectedCards.includes(num) ? 'selected' : ''}`}
            onClick={() => toggleCard(num)}
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
              <div className="hint-header">
                <span>B</span><span>I</span><span>N</span><span>G</span><span>O</span>
              </div>
              {previewCard.map((row, ri) => (
                <div key={ri} className="hint-row">
                  {row.map((cell, ci) => (
                    <span key={ci} className={`hint-cell ${cell === '*' ? 'star' : ''}`}>
                      {cell === '*' ? '⭐' : cell}
                    </span>
                  ))}
                </div>
              ))}
              <div className="hint-card-num">Card #{lastSelected} Preview</div>
            </div>
          ) : (
            <div className="preview-placeholder">Tap up to 3 cards to select</div>
          )}
        </div>

        <div className="action-btns">
          <button className="btn-refresh" onClick={() => setSelectedCards([])}>Clear</button>
          <button 
            className={`btn-start ${selectedCards.length === 0 || !hasBalance || loading ? 'disabled' : ''}`}
            onClick={handleStart}
            disabled={loading}
          >
            {loading ? 'Processing...' : `Start Game (${selectedCards.length})`}
          </button>
        </div>
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <Navbar />

      <style jsx>{`
        .select-container { min-height: 100vh; background: #a68cc5; padding: 16px; padding-bottom: 90px; }
        
        .connection-status { text-align: center; color: #4ade80; font-weight: 800; font-size: 14px; margin-bottom: 12px; }
        .wifi-icon { margin-right: 4px; }

        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 16px; }
        .stat-capsule { background: white; border-radius: 8px; padding: 6px 2px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stat-capsule .lbl { font-size: 8px; color: #f97316; font-weight: 800; margin-bottom: 4px; text-transform: uppercase; }
        .stat-capsule .val { font-size: 12px; color: #333; font-weight: 800; }

        .balance-warning { background: #fecaca; color: #dc2626; padding: 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-align: center; margin-bottom: 16px; border: 1px solid #f87171; }
        .btn-deposit-now { margin-top: 6px; background: #dc2626; color: white; border: none; padding: 4px 16px; border-radius: 99px; font-weight: 800; font-size: 11px; cursor: pointer; }

        .card-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; background: rgba(255,255,255,0.3); padding: 6px; border-radius: 12px; margin-bottom: 20px; }
        .grid-item { aspect-ratio: 1; background: #e0d4f0; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: #4b3b63; cursor: pointer; transition: all 0.2s; }
        .grid-item.selected { background: #22c55e; color: white; transform: scale(1.05); box-shadow: 0 0 10px rgba(34,197,94,0.5); border: 2px solid white; }

        .bottom-area { display: flex; align-items: flex-end; gap: 12px; margin-top: 10px; }
        .preview-wrap { flex: 0 0 130px; min-height: 120px; }
        .preview-placeholder { font-size: 9px; opacity: 0.5; color: white; text-align: center; padding-top: 40px; font-weight: 700; }

        .cartela-hint { background: white; padding: 8px; border-radius: 12px; display: flex; flex-direction: column; gap: 2px; box-shadow: 0 8px 30px rgba(0,0,0,0.2); }
        .hint-header { display: flex; gap: 2px; justify-content: center; margin-bottom: 4px; border-bottom: 1px solid #eee; padding-bottom: 2px; }
        .hint-header span { width: 20px; font-size: 10px; font-weight: 900; color: #f97316; text-align: center; }
        .hint-row { display: flex; gap: 2px; justify-content: center; }
        .hint-cell { width: 20px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; color: #333; }
        .hint-cell.star { font-size: 10px; }
        .hint-card-num { font-size: 8px; color: #999; text-align: center; margin-top: 4px; font-weight: 700; }

        .action-btns { flex: 1; display: flex; flex-direction: column; gap: 10px; }
        .btn-refresh { background: #3b82f6; border: none; color: white; padding: 12px; border-radius: 12px; font-weight: 900; font-size: 18px; box-shadow: 0 4px 0 #2563eb; }
        .btn-start { background: #f97316; border: none; color: white; padding: 12px; border-radius: 12px; font-weight: 900; font-size: 18px; box-shadow: 0 4px 0 #ea580c; }
        .btn-start.disabled { background: #666; opacity: 0.5; box-shadow: none; cursor: not-allowed; }
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
