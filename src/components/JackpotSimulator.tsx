'use client';
import React, { useState, useEffect } from 'react';

export default function JackpotSimulator() {
  const [playersCount, setPlayersCount] = useState(0);
  const [jackpotAmount, setJackpotAmount] = useState(8);
  const [status, setStatus] = useState('WAITING');

  const maxPlayers = 50000;
  const amountPerPlayer = 15;

  useEffect(() => {
    if (playersCount < maxPlayers) {
      const timer = setTimeout(() => {
        const newPlayers = Math.floor(Math.random() * 26) + 5;
        setPlayersCount(prev => Math.min(prev + newPlayers, maxPlayers));
        setJackpotAmount(prev => prev + (newPlayers * amountPerPlayer));
      }, Math.random() * 500 + 100);

      return () => clearTimeout(timer);
    } else {
      setStatus('READY TO START');
    }
  }, [playersCount]);

  return (
    <div className="w-full max-w-4xl mx-auto p-4 font-sans">
      <div 
        className="relative overflow-hidden rounded-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-2xl transition-transform hover:-translate-y-1"
        style={{
          background: 'linear-gradient(135deg, #2a2211 0%, #171510 100%)',
          border: '2px solid #5a4b24',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 193, 7, 0.1)'
        }}
      >
        <div className="flex flex-col gap-4 z-10">
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-extrabold text-sm tracking-wide uppercase text-black w-max"
            style={{
              background: 'linear-gradient(90deg, #fbc02d, #f57f17)',
              boxShadow: '0 4px 10px rgba(251, 192, 45, 0.3)'
            }}
          >
            <span>🏆</span> JACKPOT LIVE
          </div>
          
          <div className="text-5xl md:text-6xl font-black text-white tracking-tight" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
            {jackpotAmount.toLocaleString()} ETB
          </div>
          
          <div className="text-sm font-semibold flex items-center gap-2" style={{ color: '#a89f89' }}>
            <span>👥</span> {playersCount.toLocaleString()} / {maxPlayers.toLocaleString()} Players Joined
          </div>
        </div>
        
        <div className="flex flex-col items-start md:items-end gap-2 z-10">
          <div className="text-xs font-extrabold tracking-widest uppercase" style={{ color: '#8c8371' }}>
            GAME STATUS
          </div>
          <div className="text-3xl font-black uppercase flex items-center gap-3">
            {status === 'WAITING' ? (
              <span className="flex items-center gap-3" style={{ color: '#fbc02d', textShadow: '0 0 15px rgba(251, 192, 45, 0.4)' }}>
                <span className="animate-spin" style={{ animationDuration: '3s' }}>⏳</span>
                WAITING
              </span>
            ) : (
              <span className="flex items-center gap-3" style={{ color: '#4caf50', textShadow: '0 0 15px rgba(76, 175, 80, 0.4)' }}>
                <span>✅</span>
                {status}
              </span>
            )}
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 w-full h-1.5 bg-white/5">
          <div 
            className="h-full transition-all duration-300 ease-out"
            style={{ 
              width: `${(playersCount / maxPlayers) * 100}%`,
              background: 'linear-gradient(90deg, #fbc02d, #ff9800)',
              boxShadow: '0 0 10px rgba(251, 192, 45, 0.8)'
            }}
          />
        </div>
      </div>
    </div>
  );
}
