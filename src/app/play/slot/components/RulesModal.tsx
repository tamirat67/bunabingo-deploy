import { X } from 'lucide-react';

interface RulesModalProps {
  onClose: () => void;
}

export default function RulesModal({ onClose }: RulesModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div 
        className="bg-gradient-to-b from-[#0a2e1f] to-[#041a10] rounded-2xl p-5 w-full max-w-sm border border-[#22c55e]/30 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 mb-4 text-center italic uppercase tracking-wider">
          How to Play Multi Hot 5
        </h2>

        <div className="space-y-4 text-sm text-gray-200">
          <div className="bg-black/30 p-3 rounded-xl border border-white/5">
            <h3 className="font-bold text-[#4ade80] mb-1 uppercase text-xs tracking-wider">🎯 The Goal</h3>
            <p className="text-xs leading-relaxed opacity-90">
              Spin the reels to match 3 identical symbols across any of the 5 paylines. The more valuable the symbol, the higher your payout!
            </p>
          </div>

          <div className="bg-black/30 p-3 rounded-xl border border-white/5">
            <h3 className="font-bold text-[#facc15] mb-1 uppercase text-xs tracking-wider">⚡ Multiplier Reel</h3>
            <p className="text-xs leading-relaxed opacity-90">
              Every time you win, the special Multiplier Reel at the bottom spins. Your total win is multiplied by whatever value it lands on (up to 5x!).
            </p>
          </div>

          <div className="bg-black/30 p-3 rounded-xl border border-white/5">
            <h3 className="font-bold text-[#60a5fa] mb-1 uppercase text-xs tracking-wider">🎲 Gamble Feature</h3>
            <p className="text-xs leading-relaxed opacity-90">
              After any win, you can choose to GAMBLE. Guess the hidden card's color (Red or Black) to double your win, or its suit to quadruple it! But beware: a wrong guess loses the win.
            </p>
          </div>
          
          <div className="bg-black/30 p-3 rounded-xl border border-white/5">
            <h3 className="font-bold text-white mb-1 uppercase text-xs tracking-wider">🍒 Symbols & Payouts</h3>
            <ul className="text-xs leading-relaxed opacity-90 space-y-1 mt-2">
              <li className="flex justify-between"><span>7️⃣ Sevens</span> <span className="font-bold text-yellow-400">100x</span></li>
              <li className="flex justify-between"><span>⭐ Stars</span> <span className="font-bold text-yellow-400">50x</span></li>
              <li className="flex justify-between"><span>🔔 Bells</span> <span className="font-bold text-yellow-400">25x</span></li>
              <li className="flex justify-between"><span>🍉 Watermelon</span> <span className="font-bold text-yellow-400">15x</span></li>
              <li className="flex justify-between"><span>🍇 Grapes</span> <span className="font-bold text-yellow-400">10x</span></li>
              <li className="flex justify-between"><span>🍊 Oranges</span> <span className="font-bold text-yellow-400">5x</span></li>
              <li className="flex justify-between"><span>🍋 Lemons</span> <span className="font-bold text-yellow-400">3x</span></li>
              <li className="flex justify-between"><span>🍒 Cherries</span> <span className="font-bold text-yellow-400">2x</span></li>
            </ul>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-5 bg-gradient-to-r from-green-500 to-green-600 text-white font-black py-3 rounded-xl shadow-[0_4px_0_#166534] active:translate-y-1 active:shadow-none transition-all uppercase tracking-wider"
        >
          Got it, Let's Spin!
        </button>
      </div>
    </div>
  );
}
