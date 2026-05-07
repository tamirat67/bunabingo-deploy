'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getMe, joinGame } from '../../../lib/api';
import Navbar from '../../../components/Navbar';
import { Wifi } from 'lucide-react';

function SelectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomType = searchParams.get('type') || 'STANDARD';
  const price = searchParams.get('price') || '10';

  const [user, setUser] = useState<any>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    getMe().then(setUser).catch(() => {});
  }, []);

  const toggleSelect = (num: number) => {
    setSelected(prev => {
      if (prev.includes(num)) return prev.filter(n => n !== num);
      if (prev.length >= 3) return prev;
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

  return (
    <div className="selection-container">
      <div className="connected-status">
        <Wifi size={16} fill="#4caf50" />
        <span>CONNECTED</span>
      </div>

      <div className="stats-capsules">
        <div className="capsule">
          <span className="label">Active Game</span>
          <span className="value">0</span>
        </div>
        <div className="capsule">
          <span className="label">Stake</span>
          <span className="value">{price}</span>
        </div>
        <div className="capsule">
          <span className="label">Wallet</span>
          <span className="value">{(user?.wallet?.balance || 0).toFixed(0)}</span>
        </div>
        <div className="capsule">
          <span className="label">Bonus Wallet</span>
          <span className="value">0</span>
        </div>
      </div>

      <div className="alert-box">
        Please top up your wallet. If you already have and are still seeing this, please refresh the page.
      </div>

      <div className="cartela-grid-container">
        <div className="cartela-grid">
          {Array.from({ length: 100 }, (_, i) => i + 1).map(num => (
            <div 
              key={num} 
              className={`cartela-num ${selected.includes(num) ? 'selected' : ''}`}
              onClick={() => toggleSelect(num)}
            >
              {num}
            </div>
          ))}
        </div>
      </div>

      <div className="selection-actions">
        <button className="btn-refresh" onClick={() => window.location.reload()}>Refresh</button>
        <button 
          className={`btn-start ${selected.length > 0 ? 'active' : ''}`} 
          onClick={handleStart}
          disabled={selected.length === 0 || joining}
        >
          {joining ? 'Joining...' : 'Start Game'}
        </button>
      </div>

      <Navbar />
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
