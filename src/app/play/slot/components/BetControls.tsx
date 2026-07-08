'use client';

interface BetControlsProps {
  bet: number;
  minBet: number;
  maxBet: number;
  betStep: number;
  balance: number;
  spinning: boolean;
  onBetChange: (b: number) => void;
  onSpin: () => void;
  onAutoplayToggle: () => void;
  autoplayActive: boolean;
}

export default function BetControls({
  bet, minBet, maxBet, betStep, balance, spinning, onBetChange, onSpin, onAutoplayToggle, autoplayActive
}: BetControlsProps) {

  const handleDecrease = () => {
    if (spinning) return;
    onBetChange(Math.max(minBet, bet - betStep));
  };

  const handleIncrease = () => {
    if (spinning) return;
    onBetChange(Math.min(maxBet, bet + betStep));
  };

  const handleMax = () => {
    if (spinning) return;
    onBetChange(Math.min(maxBet, balance));
  };

  return (
    <div className="flex flex-col space-y-3 w-full max-w-sm mx-auto mt-4">


      {/* Bet adjustments */}
      <div className="flex items-center space-x-2">
        <button
          onClick={handleDecrease}
          disabled={spinning || bet <= minBet}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-3xl font-black disabled:opacity-50 active:scale-95 transition-transform border shadow-lg"
          style={{ background: 'linear-gradient(to bottom, #fbbf24, #b45309)', borderColor: '#fcd34d', color: '#78350f', textShadow: '0 1px 1px rgba(255,255,255,0.5)' }}
        >
          -
        </button>
        
        <div className="flex-1 h-12 rounded-xl flex flex-col items-center justify-center border shadow-inner" style={{ background: 'linear-gradient(to bottom, #000000, #170000)', borderColor: '#7f1d1d' }}>
          <span className="text-[10px] uppercase tracking-widest mt-1 font-bold" style={{ color: '#fbbf24' }}>TOTAL BET</span>
          <input 
            type="number"
            value={bet}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!isNaN(v)) {
                onBetChange(Math.min(maxBet, v)); // We let it go below minBet while typing but enforce on spin if needed, or enforce minBet here if preferred. Let's just limit to maxBet.
              }
            }}
            disabled={spinning}
            className="w-full text-center bg-transparent outline-none font-bold text-lg mb-1"
            style={{ color: '#fff', textShadow: '0 0 5px rgba(255,255,255,0.5)', WebkitAppearance: 'none', MozAppearance: 'textfield' }}
          />
        </div>

        <style dangerouslySetInnerHTML={{__html: `
          input[type=number]::-webkit-inner-spin-button, 
          input[type=number]::-webkit-outer-spin-button { 
            -webkit-appearance: none; 
            margin: 0; 
          }
        `}} />

        <button
          onClick={handleIncrease}
          disabled={spinning || bet >= balance || bet >= maxBet}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-3xl font-black disabled:opacity-50 active:scale-95 transition-transform border shadow-lg"
          style={{ background: 'linear-gradient(to bottom, #fbbf24, #b45309)', borderColor: '#fcd34d', color: '#78350f', textShadow: '0 1px 1px rgba(255,255,255,0.5)' }}
        >
          +
        </button>

        <button
          onClick={handleMax}
          disabled={spinning}
          className="h-12 px-3 rounded-xl flex flex-col items-center justify-center disabled:opacity-50 active:scale-95 transition-transform font-black text-[11px] leading-tight border shadow-lg"
          style={{ background: 'linear-gradient(to bottom, #ef4444, #991b1b)', borderColor: '#fca5a5', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
        >
          <span>MAX</span>
          <span>BET</span>
        </button>
      </div>

      {/* Primary Actions */}
      <div className="flex space-x-2">
        <button
          onClick={onAutoplayToggle}
          className={`h-14 px-4 rounded-2xl flex flex-col items-center justify-center font-black text-xs uppercase tracking-wider transition-colors border shadow-lg ${
            autoplayActive 
              ? 'animate-pulse' 
              : ''
          }`}
          style={{
            background: autoplayActive ? 'linear-gradient(to bottom, #b91c1c, #7f1d1d)' : 'linear-gradient(to bottom, #4338ca, #1e3a8a)',
            borderColor: autoplayActive ? '#ef4444' : '#818cf8',
            color: '#fff',
            textShadow: '0 1px 2px rgba(0,0,0,0.8)'
          }}
        >
          <span>{autoplayActive ? 'STOP' : 'AUTO'}</span>
        </button>

        <button
          onClick={onSpin}
          disabled={spinning || bet > balance}
          className="flex-1 h-14 rounded-2xl flex items-center justify-center text-2xl font-black italic tracking-widest disabled:opacity-60 active:scale-[0.98] transition-transform border shadow-lg relative overflow-hidden"
          style={{
            background: 'linear-gradient(to bottom, #ff0000, #b91c1c)',
            borderColor: '#ff4d4d',
            color: '#fff',
            textShadow: '0 2px 4px rgba(0,0,0,0.8)',
            boxShadow: '0 4px 15px rgba(255,0,0,0.5)'
          }}
        >
          {spinning ? 'SPINNING...' : 'SPIN'}
          
          {/* Subtle shine effect on the spin button */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
        </button>
      </div>
    </div>
  );
}
