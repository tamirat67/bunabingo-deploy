'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, X, Trophy } from 'lucide-react';

interface WeeklyBlastModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WeeklyBlastModal({ isOpen, onClose }: WeeklyBlastModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-sm rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-purple-900/50"
          style={{ background: '#1c0c3a' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-purple-900/50 bg-[#2d1b54]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-[#fbbf24]/30" style={{ background: 'linear-gradient(135deg, #a16207, #713f12)' }}>
                <Gift className="w-5 h-5 text-yellow-500" strokeWidth={2.5} />
              </div>
              <div className="flex flex-col">
                <h2 className="text-white font-black text-sm tracking-wide">ሳምንታዊ ሽልማት ፍንዳታ</h2>
                <span className="text-yellow-500 text-[10px] font-bold">Weekly Reward Blast</span>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="p-4 flex flex-col gap-6">
            {/* Progress Card */}
            <div className="bg-[#14082c] rounded-2xl p-4 flex flex-col gap-3 border border-purple-900/30">
              <div className="flex justify-between items-center">
                <span className="text-gray-300 text-xs font-semibold">ያሸነፉ ተጫዋቾች</span>
                <span className="text-green-400 text-sm font-black tracking-wider"><span className="text-white">0</span> / 10</span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-3 rounded-full bg-black/60 overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: '0%' }} />
              </div>
              <div className="text-center mt-1">
                <span className="text-gray-400 text-[11px] font-medium">ጠቅላላ ሽልማት: <span className="text-yellow-500 font-bold">5,000 ETB</span></span>
              </div>
            </div>

            {/* Blast Button Area */}
            <div className="flex flex-col items-center justify-center py-4">
              <button className="relative group active:scale-95 transition-transform">
                {/* Outer Glow */}
                <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-xl scale-125 group-hover:scale-150 transition-transform" />
                
                {/* Main Circle */}
                <div className="relative w-36 h-36 rounded-full border-4 border-yellow-500 flex flex-col items-center justify-center gap-1 shadow-[0_0_30px_rgba(234,179,8,0.3)]" style={{ background: 'linear-gradient(180deg, #f87171, #991b1b)' }}>
                  
                  {/* Explosion Icon / Graphic */}
                  <div className="relative w-12 h-12 mb-1">
                    <div className="absolute inset-0 bg-yellow-400 rotate-45 transform scale-75" style={{ clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' }}></div>
                    <div className="absolute inset-0 bg-yellow-200 rotate-12 transform scale-50" style={{ clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' }}></div>
                  </div>

                  <span className="text-white font-black text-lg tracking-widest drop-shadow-md">ማፈንዳት</span>
                  
                  {/* Timer Badge */}
                  <div className="bg-black/40 border border-white/20 rounded-full px-3 py-0.5 mt-1">
                    <span className="text-white text-[10px] font-mono font-bold tracking-widest">2d : 07h : 59m : 45s</span>
                  </div>
                </div>
              </button>
            </div>

            {/* Leaderboard Section */}
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex items-center gap-2 text-gray-300">
                <Trophy className="w-4 h-4" />
                <span className="text-xs font-bold tracking-wider">መሪ ተጫዋቾች <span className="text-gray-500">(LEADERBOARD)</span></span>
              </div>
              
              <div className="bg-[#14082c] border border-purple-900/30 rounded-xl h-24 flex items-center justify-center">
                <span className="text-gray-500 text-xs font-semibold">ምንም መረጃ የለም</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
