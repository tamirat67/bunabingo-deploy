'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface AutoplayPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (count: number, stopOnWin: number, stopOnLoss: number) => void;
}

export default function AutoplayPanel({ isOpen, onClose, onStart }: AutoplayPanelProps) {
  const [spins, setSpins] = useState<number>(10);
  const [stopOnWin, setStopOnWin] = useState<string>('');
  const [stopOnLoss, setStopOnLoss] = useState<string>('');

  const handleStart = () => {
    onStart(spins, Number(stopOnWin) || 0, Number(stopOnLoss) || 0);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d1f0d] rounded-t-3xl border-t border-green-800 p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
          >
            <h3 className="text-xl font-bold text-white mb-4">Autoplay Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-2">Number of Spins</label>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 25, 50, 100].map(n => (
                    <button
                      key={n}
                      onClick={() => setSpins(n)}
                      className={`py-3 rounded-xl font-bold transition-colors ${
                        spins === n 
                          ? 'bg-green-600 text-white' 
                          : 'bg-gray-800 text-gray-400 border border-gray-700'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Stop if Win ≥ (ETB)</label>
                  <input 
                    type="number"
                    value={stopOnWin}
                    onChange={(e) => setStopOnWin(e.target.value)}
                    placeholder="∞"
                    className="w-full bg-black/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Stop if Balance ↓ (ETB)</label>
                  <input 
                    type="number"
                    value={stopOnLoss}
                    onChange={(e) => setStopOnLoss(e.target.value)}
                    placeholder="∞"
                    className="w-full bg-black/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleStart}
                className="w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold tracking-wide mt-2"
              >
                START AUTOPLAY
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
