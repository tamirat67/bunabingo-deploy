'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getMe, joinGame, getOccupiedCards } from '../../../lib/api';
import { PREDEFINED_CARDS } from '../../../lib/predefinedCards';
import { ChevronLeft, RefreshCw, Zap, X, Play, ShieldCheck } from 'lucide-react';
import Pusher from 'pusher-js';

function SelectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomType = searchParams.get('type') || 'STANDARD';
  const stake = parseInt(searchParams.get('price') || '20');

  const [user, setUser] = useState<any>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [occupied, setOccupied] = useState<number[]>([]);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    getMe().then(setUser).catch(() => {});
    
    // Fetch initial occupancy
    getOccupiedCards(roomType).then(res => {
      setOccupied(res.occupiedIds || []);
      
      // Subscribe to real-time updates
      const pk = process.env.NEXT_PUBLIC_PUSHER_KEY, pc = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
      if (!pk || !pc || !res.gameId) return;
      const pusher = new Pusher(pk, { cluster: pc });
      // We broadcast on the room ID channel for occupancy updates
      const ch = pusher.subscribe(`game-${res.roomId || roomType}`); 
      // Wait, I need to make sure backend uses a consistent channel. 
      // I'll adjust backend to use roomType as channel for occupancy.
      
      ch.bind('card-occupied', (data: { occupiedIds: number[] }) => {
        setOccupied(data.occupiedIds);
      });

      return () => { ch.unbind_all(); pusher.disconnect(); };
    }).catch(() => {});
  }, [roomType]);

  // Auto-deselect if someone else buys your card
  useEffect(() => {
    setSelected(prev => prev.filter(id => !occupied.includes(id)));
  }, [occupied]);

  const toggleSelect = (num: number) => {
    setSelected(prev => {
      if (prev.includes(num)) return prev.filter(n => n !== num);
      if (occupied.includes(num)) return prev; // Cannot select occupied
      if (prev.length >= 5) {
        alert('Maximum of 5 cards allowed per player');
        return prev;
      }
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
        {Array.from({ length: 100 }, (_, i) => i + 1).map(num => {
          const isOccupied = occupied.includes(num);
          const isSelected = selected.includes(num);
          return (
            <div 
              key={num} 
              className={`num-brown ${isSelected ? 'selected' : ''} ${isOccupied ? 'occupied' : ''}`}
              style={{
                backgroundColor: isOccupied ? '#27AE60' : (isSelected ? '#D4AF37' : 'white'),
                color: isOccupied || isSelected ? 'white' : '#3D2B1F',
                cursor: isOccupied ? 'not-allowed' : 'pointer',
                opacity: isOccupied ? 0.8 : 1
              }}
              onClick={() => !isOccupied && toggleSelect(num)}
            >
              {num}
            </div>
          );
        })}
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
