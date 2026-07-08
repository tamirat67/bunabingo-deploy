'use client';
import { motion, AnimatePresence } from 'framer-motion';

interface GambleModalProps {
  isOpen: boolean;
  currentPayout: number;
  round: number;
  maxRounds: number;
  loading: boolean;
  onChoice: (choice: 'red' | 'black') => void;
  onCollect: () => void;
}

export default function GambleModal({
  isOpen, currentPayout, round, maxRounds, loading, onChoice, onCollect
}: GambleModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-sm bg-[#0a1a0a] rounded-3xl p-6 border-2 border-yellow-600/50 shadow-[0_0_50px_rgba(202,138,4,0.2)]"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-white italic tracking-wider mb-2">GAMBLE</h2>
              <p className="text-gray-400 text-sm">Round {round + 1} of {maxRounds}</p>
              
              <div className="mt-6 bg-black/50 py-4 rounded-xl border border-yellow-900/50">
                <p className="text-xs text-yellow-600/80 uppercase font-bold tracking-widest mb-1">Current Win</p>
                <p className="text-4xl font-black text-yellow-500 shadow-yellow-500/20">{currentPayout.toFixed(2)}</p>
                <p className="text-sm text-yellow-600 mt-1 font-semibold">ETB</p>
              </div>
              <p className="mt-4 text-sm text-gray-300">Choose <span className="text-red-500 font-bold">RED</span> or <span className="text-gray-500 font-bold">BLACK</span> to double!</p>
            </div>

            <div className="flex justify-between gap-4 mb-6">
              <button
                onClick={() => onChoice('red')}
                disabled={loading}
                className="flex-1 py-6 bg-gradient-to-br from-red-500 to-red-800 rounded-2xl border border-red-400 font-black text-2xl text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] active:scale-95 transition-transform disabled:opacity-50"
              >
                ♥ ♦
              </button>
              <button
                onClick={() => onChoice('black')}
                disabled={loading}
                className="flex-1 py-6 bg-gradient-to-br from-gray-700 to-gray-900 rounded-2xl border border-gray-500 font-black text-2xl text-white shadow-[0_0_20px_rgba(0,0,0,0.8)] active:scale-95 transition-transform disabled:opacity-50"
              >
                ♠ ♣
              </button>
            </div>

            <button
              onClick={onCollect}
              disabled={loading}
              className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 rounded-xl font-bold text-black tracking-widest uppercase disabled:opacity-50 transition-colors"
            >
              Collect & Exit
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
