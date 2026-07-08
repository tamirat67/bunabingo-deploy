'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface GambleModalProps {
  isOpen: boolean;
  currentPayout: number;
  round: number;
  maxRounds: number;
  loading: boolean;
  error?: string | null;
  onChoice: (choice: 'red' | 'black') => void;
  onCollect: () => void;
}

export default function GambleModal({
  isOpen, currentPayout, round, maxRounds, loading, error, onChoice, onCollect
}: GambleModalProps) {
  const [lastResult, setLastResult] = useState<{ won: boolean; choice: 'red' | 'black'; outcome: 'red' | 'black' } | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleChoice = (c: 'red' | 'black') => {
    if (loading) return;
    setShowResult(false);
    setLastResult(null);
    onChoice(c);
  };

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
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black text-white italic tracking-wider mb-1">GAMBLE</h2>
              <p className="text-gray-400 text-sm">Round {round + 1} of {maxRounds}</p>

              <div className="mt-4 bg-black/50 py-4 rounded-xl border border-yellow-900/50">
                <p className="text-xs text-yellow-600/80 uppercase font-bold tracking-widest mb-1">Current Win</p>
                <p className="text-4xl font-black text-yellow-500">{currentPayout.toFixed(2)}</p>
                <p className="text-sm text-yellow-600 mt-1 font-semibold">ETB</p>
              </div>
            </div>

            {/* Loading spinner */}
            {loading && (
              <div className="flex justify-center items-center py-6 mb-4">
                <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="mb-4 text-xs text-red-400 bg-red-900/30 p-3 rounded-xl border border-red-900/50 text-center">
                ⚠️ {error}
              </div>
            )}

            {/* Choice buttons */}
            {!loading && (
              <>
                <p className="text-center text-sm text-gray-300 mb-4">
                  Choose <span className="text-red-500 font-bold">RED</span> or <span className="text-gray-300 font-bold">BLACK</span> to double!
                </p>

                <div className="flex justify-between gap-4 mb-5">
                  <button
                    onClick={() => handleChoice('red')}
                    disabled={loading}
                    className="flex-1 py-6 bg-gradient-to-br from-red-500 to-red-800 rounded-2xl border-2 border-red-400 font-black text-3xl text-white shadow-[0_0_20px_rgba(239,68,68,0.5)] active:scale-95 transition-all hover:shadow-[0_0_30px_rgba(239,68,68,0.7)] disabled:opacity-40"
                  >
                    ♥ ♦
                  </button>
                  <button
                    onClick={() => handleChoice('black')}
                    disabled={loading}
                    className="flex-1 py-6 bg-gradient-to-br from-gray-600 to-gray-900 rounded-2xl border-2 border-gray-400 font-black text-3xl text-white shadow-[0_0_20px_rgba(100,100,100,0.5)] active:scale-95 transition-all hover:shadow-[0_0_30px_rgba(100,100,100,0.7)] disabled:opacity-40"
                  >
                    ♠ ♣
                  </button>
                </div>

                <button
                  onClick={onCollect}
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 rounded-xl font-black text-black tracking-widest uppercase disabled:opacity-40 transition-all shadow-[0_4px_15px_rgba(202,138,4,0.3)] active:scale-95"
                >
                  💰 COLLECT &amp; EXIT
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
