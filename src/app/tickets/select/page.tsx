'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getMe, joinGame } from '../../../lib/api';
import { PREDEFINED_CARDS } from '../../../lib/predefinedCards';
import { ChevronLeft, RefreshCw, Zap, X, Play } from 'lucide-react';

function SelectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomType = searchParams.get('type') || 'STANDARD';
  const stake = parseInt(searchParams.get('price') || '20');

  const [user, setUser] = useState<any>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [joining, setJoining] = useState(false);

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

  const balance = user?.wallet?.balance || 0;
  const activeGames = 2; // Stub for UI accuracy to screenshot

  const lastSelected = selected.length > 0 ? selected[selected.length - 1] : null;
  const previewCard = lastSelected ? PREDEFINED_CARDS[lastSelected] : null;

  return (
    <div className="selection-container brown">
      <div className="selection-header-top">
        <button className="btn-back" onClick={() => router.push('/')}><ChevronLeft size={20} color="white" /></button>
        <div className="header-text">
          <h1 style={{color: 'white', opacity: 0.8}}>Buna Bingo</h1>
          <p style={{color: 'white', opacity: 0.6}}>{roomType} • STAKE {stake}</p>
        </div>
      </div>

      <div className="stats-row-brown">
        <div className="capsule-white"><div className="l">WALLET</div><div className="v">{Number(balance).toFixed(0)}</div></div>
        <div className="capsule-white"><div className="l">BONUS</div><div className="v">0</div></div>
        <div className="capsule-white"><div className="l">ACTIVE GAME</div><div className="v">{activeGames}</div></div>
        <div className="capsule-brown total-box"><div className="l" style={{color: 'rgba(255,255,255,0.5)'}}>STAKE</div><div className="v">{stake}</div></div>
      </div>

      <div className="jackpot-section-mini">
        <div className="jackpot-labels">
          <div className="l"><Zap size={14} color="#D4AF37" /> <span style={{color: '#D4AF37'}}>JACKPOT</span></div>
          <div className="v">808 / 1000</div>
        </div>
        <div className="jackpot-progress-bg">
          <div className="jackpot-progress-fill" style={{ width: '80.8%' }}></div>
        </div>
      </div>

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

      <div style={{height: '300px'}}></div> {/* Spacer: footer (130px) + navbar (85px) + buffer */}

      <div className="selection-footer-smart">
        <div className="footer-left-preview">
          {previewCard ? (
            <>
              <div className="flp-title">PATTERN #{lastSelected}</div>
              <div className="pc-mini-grid">
                {previewCard.map((row, ri) => row.map((cell, ci) => (
                  <div key={`${ri}-${ci}`} className={`pc-mini-cell ${cell === 0 ? 'star' : ''}`}>
                    {cell === 0 ? '★' : cell}
                  </div>
                )))}
              </div>
            </>
          ) : (
            <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'rgba(61,43,31,0.4)', textAlign: 'center'}}>
              Select a card<br/>to preview
            </div>
          )}
        </div>

        <div className="footer-right-actions">
          <button className="btn-refresh-blue" onClick={() => window.location.reload()}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button 
            className={`btn-start-game ${selected.length > 0 ? 'active' : ''}`}
            disabled={selected.length === 0 || joining}
            onClick={handleStart}
          >
            <Play size={16} fill="white" /> {joining ? 'STARTING...' : 'START GAME'}
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
