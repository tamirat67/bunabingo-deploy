'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getMe, joinGame } from '../../../lib/api';
import { PREDEFINED_CARDS } from '../../../lib/predefinedCards';
import { ChevronLeft, RefreshCw, Zap, X } from 'lucide-react';

function SelectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomType = searchParams.get('type') || 'CASUAL';
  const stake = parseInt(searchParams.get('price') || '10');

  const [user, setUser] = useState<any>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [joining, setJoining] = useState(false);
  const [showAlert, setShowAlert] = useState(true);

  useEffect(() => {
    getMe().then(setUser).catch(() => {});
  }, []);

  const toggleSelect = (num: number) => {
    setSelected(prev => {
      if (prev.includes(num)) return prev.filter(n => n !== num);
      if (prev.length >= 5) return prev;
      return [...prev, num];
    });
  };

  const handleStart = async () => {
    if (selected.length === 0 || joining) return;
    setJoining(true);
    try {
      const res = await joinGame(roomType, selected);
      router.push(`/game?id=${res.gameId}`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to join');
    } finally {
      setJoining(false);
    }
  };

  const totalCost = selected.length * stake;
  const balance = user?.wallet?.balance || 0;
  const isInsufficient = balance < totalCost;

  return (
    <div className="selection-container brown">
      <div className="selection-header-top">
        <button className="btn-back" onClick={() => router.push('/')}><ChevronLeft size={20} /></button>
        <div className="header-text">
          <h1>Buna Bingo</h1>
          <p>{roomType} • STAKE {stake}</p>
        </div>
      </div>

      <div className="stats-row-brown">
        <div className="capsule-brown"><div className="l">WALLET</div><div className="v">{Number(balance).toFixed(0)}</div></div>
        <div className="capsule-brown"><div className="l">BONUS</div><div className="v">0</div></div>
        <div className="capsule-brown"><div className="l">CARDS</div><div className="v">{selected.length} / 5</div></div>
        <div className="capsule-brown total-box"><div className="l">TOTAL</div><div className="v">{totalCost}</div></div>
      </div>

      <div className="jackpot-section-mini">
        <div className="jackpot-labels">
          <div className="l"><Zap size={14} /> JACKPOT</div>
          <div className="v">808 / 1000</div>
        </div>
        <div className="jackpot-progress-bg">
          <div className="jackpot-progress-fill" style={{ width: '80.8%' }}></div>
        </div>
      </div>

      {isInsufficient && (
        <div className="warning-bar-red">
          <span>⚠️ Please top up your wallet. Total cost: {totalCost} ETB.</span>
          <X size={16} />
        </div>
      )}

      <div className="grid-brown">
        {Array.from({ length: 100 }, (_, i) => i + 1).map(num => (
          <div 
            key={num} 
            className={`num-brown ${selected.includes(num) ? 'selected' : ''}`}
            onClick={() => toggleSelect(num)}
          >
            {num}
          </div>
        ))}
      </div>

      <div style={{height: '140px'}}></div> {/* Spacer for fixed footer */}

      <div className="selection-footer-smart">
        <div className="card-previews">
          {selected.map(num => {
            const card = PREDEFINED_CARDS[num] || [];
            return (
              <div key={num} className="preview-card">
                <div className="pc-num-tag">#{num}</div>
                <div className="pc-mini-grid">
                  {card.map((row, ri) => row.map((cell, ci) => (
                    <div key={`${ri}-${ci}`} className={`pc-mini-cell ${cell === 0 ? 'star' : ''}`}>
                      {cell === 0 ? '★' : cell}
                    </div>
                  )))}
                </div>
              </div>
            );
          })}
          {selected.length === 0 && <div style={{opacity: 0.3, fontSize: '10px', display: 'flex', alignItems: 'center'}}>Select cards to preview...</div>}
        </div>

        <div className="footer-btns">
          <button className="btn-refresh-blue" onClick={() => window.location.reload()}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button 
            className={`btn-join-gold ${selected.length > 0 ? 'active' : ''}`}
            disabled={selected.length === 0 || joining}
            onClick={handleStart}
          >
            {joining ? '...' : `JOIN WITH ${selected.length} CARDS`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TicketSelectPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SelectionContent />
    </Suspense>
  );
}
