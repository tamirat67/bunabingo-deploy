'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getMe, joinGame } from '../../../lib/api';
import { PREDEFINED_CARDS } from '../../../lib/predefinedCards';
import { ChevronLeft, RefreshCw, Zap, X, Play, ShieldCheck } from 'lucide-react';

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
      if (prev.length >= 100) return prev;
      return [...prev, num];
    });
  };

  const handleStart = async () => {
    if (selected.length === 0 || joining) return;
    setJoining(true);
    try {
      const res = await joinGame(roomType, selected);
      
      if (roomType.startsWith('SPIN_')) {
        router.push(`/play/spin?id=${res.gameId}&stake=${stake}`);
      } else {
        router.push(`/game?id=${res.gameId}`);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to join';
      alert(`ERROR: ${msg}`);
    } finally {
      setJoining(false);
    }
  };

  const balance = user?.wallet?.balance || 0;
  const activeGames = 2; 

  const lastSelected = selected.length > 0 ? selected[selected.length - 1] : null;
  const previewCard = lastSelected ? PREDEFINED_CARDS[lastSelected] : null;

  const isSpin = roomType.startsWith('SPIN_');

  return (
    <div className={`selection-container brown ${isSpin ? 'spin-theme' : ''}`}>
      <div className="selection-header-top">
        <button className="btn-back" onClick={() => router.push('/')}><ChevronLeft size={20} color="#4B3621" /></button>
        <div className="header-text">
          <h1 style={{color: '#3D2B1F', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px'}}>
            <ShieldCheck size={24} /> BUNA GAME ZONE
          </h1>
          <p style={{color: 'rgba(61,43,31,0.6)', fontWeight: 800}}>{roomType} • STAKE {stake}</p>
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

      <div style={{height: '300px'}}></div>

      <div className="selection-footer-smart">
        <div className="footer-cards-scroll">
          {selected.length === 0 ? (
            <div className="footer-no-cards">Select cards to preview</div>
          ) : (
            selected.map(num => {
              const card = PREDEFINED_CARDS[num] || [];
              return (
                <div key={num} className="footer-card-item">
                  <div className="flp-title">#{num}</div>
                  <div className="pc-mini-grid">
                    {card.map((row, ri) => row.map((cell: any, ci) => (
                      <div key={`${ri}-${ci}`} className={`pc-mini-cell ${cell === 0 ? 'star' : ''}`}>
                        {cell === 0 ? '★' : cell}
                      </div>
                    )))}
                  </div>
                </div>
              );
            })
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
