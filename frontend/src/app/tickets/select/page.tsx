'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getMe, joinGame } from '../../../lib/api';
import Onboarding from '../../../components/Onboarding';
import { ChevronLeft, Info, CheckCircle2, Ticket } from 'lucide-react';

function TicketContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomType = searchParams.get('type') || 'STANDARD';
  const ticketPrice = searchParams.get('price') || '10';

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedCard, setSelectedCard] = useState<number>(1);
  const [joining, setJoining] = useState(false);

  const loadUser = async () => {
    try {
      const u = await getMe();
      setUser(u);
    } catch (err: any) {
      if (err.response?.status === 401) {
        // If somehow not auto-registered in lobby, push back or re-try
        router.push('/');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const handleJoin = async () => {
    if (!user) return;
    setJoining(true);
    try {
      const res = await joinGame(roomType, selectedCard);
      router.push(`/game?id=${res.gameId}`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to join game');
    } finally {
      setJoining(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /><span>PREPARING CARDS...</span></div>;

  return (
    <div className="select-container">
      <div className="select-header">
        <button className="btn-back" onClick={() => router.push('/')}>
          <ChevronLeft size={24} />
        </button>
        <div className="header-info">
          <h1>Select Cartela</h1>
          <p>{roomType} Room • {ticketPrice} ETB</p>
        </div>
      </div>

      <div className="balance-banner">
        <div className="bal-l">Your Balance</div>
        <div className="bal-v">{Number(user?.wallet?.balance || 0).toFixed(2)} ETB</div>
      </div>

      <div className="cards-grid">
        {[1, 2, 3].map((id) => (
          <div 
            key={id} 
            className={`card-option ${selectedCard === id ? 'active' : ''}`}
            onClick={() => setSelectedCard(id)}
          >
            <div className="card-visual">
               <Ticket size={40} className="t-icon" />
               <div className="card-num">#{id}</div>
            </div>
            <div className="card-meta">
              <span className="label">Cartela {id}</span>
              {selectedCard === id && <CheckCircle2 size={20} className="check-icon" />}
            </div>
          </div>
        ))}
      </div>

      <div className="info-box">
        <Info size={16} />
        <p>You can choose your favorite card number. The game will start automatically when the room is full.</p>
      </div>

      <div className="action-footer">
        <button 
          className={`btn-confirm ${joining ? 'loading' : ''}`}
          onClick={handleJoin}
          disabled={joining || (user?.wallet?.balance || 0) < Number(ticketPrice)}
        >
          {joining ? 'JOINING...' : `CONFIRM & JOIN (${ticketPrice} ETB)`}
        </button>
      </div>

      <style jsx>{`
        .select-container { min-height: 100vh; background: var(--bg-main); padding: 20px 16px 120px; color: var(--text-main); }
        
        .select-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; margin-top: 10px; }
        .btn-back { background: var(--bg-card); border: 1px solid var(--border-light); color: var(--text-main); width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
        
        .header-info h1 { font-size: 20px; font-weight: 900; color: var(--text-main); margin: 0; }
        .header-info p { font-size: 13px; font-weight: 700; opacity: 0.6; margin: 0; }

        .balance-banner { background: var(--bg-nav); color: white; padding: 16px 20px; border-radius: 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
        .bal-l { font-size: 12px; font-weight: 800; opacity: 0.8; text-transform: uppercase; }
        .bal-v { font-size: 18px; font-weight: 900; }

        .cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 30px; }
        
        .card-option { background: var(--bg-card); border: 2px solid var(--border-light); border-radius: 24px; padding: 20px; text-align: center; transition: 0.3s; cursor: pointer; position: relative; }
        .card-option.active { border-color: #22c55e; background: rgba(34, 197, 94, 0.05); transform: translateY(-4px); box-shadow: 0 10px 20px rgba(34, 197, 94, 0.1); }
        
        .card-visual { height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--text-main); opacity: 0.3; }
        .active .card-visual { color: #22c55e; opacity: 1; }
        .card-num { font-size: 18px; font-weight: 900; }

        .card-meta { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px; }
        .card-meta .label { font-size: 14px; font-weight: 800; }
        .check-icon { color: #22c55e; }

        .info-box { display: flex; gap: 12px; background: var(--jackpot-bg); padding: 16px; border-radius: 16px; border: 1px solid var(--border-light); }
        .info-box p { font-size: 12px; font-weight: 700; opacity: 0.6; line-height: 1.5; margin: 0; }

        .action-footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 20px 16px; background: var(--bg-main); border-top: 1px solid var(--border-light); display: flex; justify-content: center; }
        .btn-confirm { width: 100%; max-width: 400px; background: #22c55e; color: white; border: none; padding: 18px; border-radius: 18px; font-weight: 900; font-size: 16px; box-shadow: 0 8px 0 #15803d; cursor: pointer; transition: 0.2s; }
        .btn-confirm:active { transform: translateY(2px); box-shadow: 0 4px 0 #15803d; }
        .btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; filter: grayscale(1); }
      `}</style>
    </div>
  );
}

export default function TicketSelectPage() {
  return (
    <Suspense fallback={<div className="loading"><div className="spinner" /><span>LOADING...</span></div>}>
      <TicketContent />
    </Suspense>
  );
}
