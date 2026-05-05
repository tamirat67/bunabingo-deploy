'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getWallet, joinGame, getMe } from '../../../lib/api';
import { PREDEFINED_CARDS } from '../../../lib/predefinedCards';
import Navbar from '../../../components/Navbar';
import Onboarding from '../../../components/Onboarding';
import { useToast } from '../../../components/Toast';

function SelectCardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { show } = useToast();
  const roomType = searchParams.get('type') || 'CASUAL';
  const pricePerCard = Number(searchParams.get('price') || '10');

  const [wallet, setWallet] = useState<any>(null);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const loadData = async () => {
    try {
      const u = await getMe();
      if (!u || !u.id) {
        setShowOnboarding(true);
      } else {
        const w = await getWallet();
        setWallet(w);
        setShowOnboarding(false);
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        setShowOnboarding(true);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalStake = selectedCards.length * pricePerCard;
  const hasBalance = Number(wallet?.balance || 0) >= totalStake;

  const toggleCard = (num: number) => {
    if (selectedCards.includes(num)) {
      setSelectedCards(selectedCards.filter(n => n !== num));
    } else {
      if (selectedCards.length >= 3) {
        show('Maximum 3 cards allowed! 🛡️', 'error');
        return;
      }
      const newSelection = [...selectedCards, num];
      setSelectedCards(newSelection);
      if (newSelection.length === 2) show('Double your chances! ✌️', 'success');
      if (newSelection.length === 3) show('JACKPOT MODE active! 🔥', 'success');
    }
  };

  const handleStart = async () => {
    if (selectedCards.length === 0) return show('Select your lucky card!', 'error');
    if (!hasBalance) return show('Insufficient balance!', 'error');

    setLoading(true);
    try {
      let gId = '';
      for (const cardId of selectedCards) {
        const res = await joinGame(roomType, cardId);
        gId = res.gameId;
      }
      router.push(`/game?id=${gId}`);
    } catch (err: any) {
      show(err.response?.data?.error || 'Failed to join game', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="select-container">
      {showOnboarding && <Onboarding onSuccess={loadData} />}
      <div className="connection-status">
        <span className="live-dot pulse"></span> BUNA BINGO SECURE
      </div>

      <div className="stats-row">
        <div className="stat-capsule">
          <div className="lbl">Selected</div>
          <div className="val">{selectedCards.length} / 3</div>
        </div>
        <div className="stat-capsule">
          <div className="lbl">Stake</div>
          <div className="val">{totalStake || pricePerCard} ETB</div>
        </div>
        <div className="stat-capsule">
          <div className="lbl">Wallet</div>
          <div className="val">{Number(wallet?.balance || 0).toFixed(0)}</div>
        </div>
      </div>

      {!hasBalance && selectedCards.length > 0 && (
        <div className="balance-warning">
          <p>Need {totalStake} ETB for {selectedCards.length} cards.</p>
          <button className="btn-deposit-now" onClick={() => router.push('/deposit')}>
            📥 Deposit Now
          </button>
        </div>
      )}

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

      <div className="previews-container">
        {selectedCards.length > 0 ? (
          <div className="previews-scroll">
            {selectedCards.map((id) => (
              <div key={id} className="hint-card-wrapper">
                <div className="cartela-hint">
                  <div className="hint-header">
                    <span>B</span><span>I</span><span>N</span><span>G</span><span>O</span>
                  </div>
                  {(PREDEFINED_CARDS as any)[id].map((row: any[], ri: number) => (
                    <div key={ri} className="hint-row">
                      {row.map((cell, ci) => (
                        <span key={ci} className={`hint-cell ${cell === '*' ? 'star' : ''}`}>
                          {cell === '*' ? '⭐' : cell}
                        </span>
                      ))}
                    </div>
                  ))}
                  <div className="hint-card-num">Card #{id}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="preview-placeholder">Select up to 3 lucky cards</div>
        )}
      </div>

      <div className="action-bar">
        <button 
          className={`btn-start ${selectedCards.length === 0 || !hasBalance || loading ? 'disabled' : ''}`}
          onClick={handleStart}
          disabled={loading}
        >
          {loading ? 'Joining...' : selectedCards.length > 1 ? `PLAY ${selectedCards.length} CARDS` : 'START BINGO'}
        </button>
        <button className="btn-reset" onClick={() => setSelectedCards([])}>Reset Selection</button>
      </div>

      <Navbar />

      <style jsx>{`
        .select-container { min-height: 100vh; background: #F5E6BE; padding: 16px; padding-bottom: 100px; color: #000; }
        .connection-status { text-align: center; color: #4B3621; font-weight: 800; font-size: 13px; margin-bottom: 12px; opacity: 0.8; }
        .live-dot { display: inline-block; width: 6px; height: 6px; background: #22c55e; border-radius: 50%; margin-right: 4px; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }

        .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; }
        .stat-capsule { background: #FFF9E6; border-radius: 12px; padding: 10px 4px; text-align: center; border: 1px solid #E6D5A8; }
        .stat-capsule .lbl { font-size: 9px; color: #6F4E37; font-weight: 800; margin-bottom: 4px; text-transform: uppercase; }
        .stat-capsule .val { font-size: 13px; color: #4B3621; font-weight: 900; }

        .card-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; background: rgba(75, 54, 33, 0.05); padding: 8px; border-radius: 12px; margin-bottom: 20px; }
        .grid-item { aspect-ratio: 1; background: #FFF9E6; border: 1px solid #E6D5A8; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: #4B3621; cursor: pointer; transition: all 0.2s; }
        .grid-item.selected { background: #22c55e; color: #ffffff; transform: scale(1.05); box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3); border: 2px solid #ffffff; }

        .previews-container { margin-bottom: 20px; min-height: 140px; }
        .previews-scroll { display: flex; gap: 12px; overflow-x: auto; padding: 4px; padding-bottom: 12px; }
        .hint-card-wrapper { flex: 0 0 130px; }
        .preview-placeholder { text-align: center; color: #6F4E37; font-size: 12px; font-weight: 700; padding-top: 50px; opacity: 0.5; }

        .cartela-hint { background: white; padding: 8px; border-radius: 12px; display: flex; flex-direction: column; gap: 2px; box-shadow: 0 8px 20px rgba(75, 54, 33, 0.15); border: 1px solid #eee; }
        .hint-header { display: flex; gap: 2px; justify-content: center; margin-bottom: 4px; border-bottom: 1px solid #eee; padding-bottom: 2px; }
        .hint-header span { width: 20px; font-size: 10px; font-weight: 900; color: #6F4E37; text-align: center; }
        .hint-row { display: flex; gap: 2px; justify-content: center; }
        .hint-cell { width: 20px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; color: #333; }
        .hint-cell.star { font-size: 10px; }
        .hint-card-num { font-size: 8px; color: #999; text-align: center; margin-top: 4px; font-weight: 700; }

        .action-bar { display: flex; flex-direction: column; gap: 10px; }
        .btn-start { background: #4B3621; color: #F5E6BE; border: none; padding: 18px; border-radius: 16px; font-weight: 900; font-size: 20px; box-shadow: 0 6px 0 #2a1e12; cursor: pointer; letter-spacing: 0.5px; }
        .btn-start.disabled { background: #E6D5A8; color: #6F4E37; box-shadow: none; opacity: 0.5; cursor: not-allowed; }
        .btn-reset { background: transparent; border: 1px solid #E6D5A8; color: #6F4E37; padding: 10px; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; }
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
