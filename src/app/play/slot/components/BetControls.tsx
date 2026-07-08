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
      {/* Balance */}
      <div className="flex justify-between items-center px-4 py-2 bg-black/40 rounded-xl border border-green-900/50">
        <span className="text-gray-400 text-sm">BALANCE</span>
        <span className="text-white font-mono font-bold">{balance.toFixed(2)} ETB</span>
      </div>

      {/* Bet adjustments */}
      <div className="flex items-center space-x-2">
        <button
          onClick={handleDecrease}
          disabled={spinning || bet <= minBet}
          className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center text-2xl font-bold disabled:opacity-50 active:scale-95 transition-transform"
        >
          -
        </button>
        
        <div className="flex-1 h-12 bg-gray-900 rounded-xl flex flex-col items-center justify-center border border-gray-700">
          <span className="text-xs text-gray-500 uppercase tracking-widest">TOTAL BET</span>
          <span className="text-yellow-500 font-mono font-bold leading-none">{bet.toFixed(2)}</span>
        </div>

        <button
          onClick={handleIncrease}
          disabled={spinning || bet >= maxBet || bet + betStep > balance}
          className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center text-2xl font-bold disabled:opacity-50 active:scale-95 transition-transform"
        >
          +
        </button>

        <button
          onClick={handleMax}
          disabled={spinning || bet >= maxBet || balance < minBet}
          className="w-12 h-12 bg-gradient-to-br from-yellow-600 to-yellow-800 rounded-xl flex flex-col items-center justify-center disabled:opacity-50 active:scale-95 transition-transform shadow-lg shadow-yellow-900/20"
        >
          <span className="text-[10px] uppercase font-bold text-yellow-100">MAX</span>
          <span className="text-xs font-bold text-white">BET</span>
        </button>
      </div>

      {/* Spin / Auto button */}
      <div className="flex space-x-2">
        <button
          onClick={onAutoplayToggle}
          disabled={spinning && !autoplayActive}
          className={`h-16 px-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center ${
            autoplayActive 
              ? 'bg-red-600/20 text-red-500 border-2 border-red-500/50 flex-1' 
              : 'bg-gray-800 text-gray-300 w-16 active:scale-95'
          }`}
        >
          {autoplayActive ? 'STOP AUTO' : 'AUTO'}
        </button>

        <button
          onClick={onSpin}
          disabled={spinning || bet > balance}
          className={`flex-1 h-16 rounded-2xl flex items-center justify-center text-2xl font-black italic tracking-widest transition-all ${
            spinning || bet > balance
              ? 'bg-gray-800 text-gray-600'
              : 'bg-gradient-to-b from-green-400 to-green-700 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)] active:scale-95'
          }`}
          style={{ textShadow: spinning ? 'none' : '0 2px 4px rgba(0,0,0,0.5)' }}
        >
          {spinning ? 'SPINNING...' : 'SPIN'}
        </button>
      </div>
    </div>
  );
}
