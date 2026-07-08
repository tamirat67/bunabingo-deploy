'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { WinTier } from '../types';

interface WinBannerProps {
  tier: WinTier;
  amount: number;
  onDone?: () => void;
}

export default function WinBanner({ tier, amount, onDone }: WinBannerProps) {
  if (tier === 'NONE') return null;

  const config = {
    WIN: { title: 'WIN', colors: ['#eab308', '#ca8a04'], delay: 1.5 },
    BIG_WIN: { title: 'BIG WIN!', colors: ['#f59e0b', '#d97706'], delay: 2.5 },
    MEGA_WIN: { title: 'MEGA WIN!!', colors: ['#ef4444', '#b91c1c'], delay: 3.5 },
  }[tier];

  return (
    <AnimatePresence onExitComplete={onDone}>
      <motion.div
        initial={{ opacity: 0, scale: 0.5, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
        transition={{ type: 'spring', damping: 15 }}
        className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none"
      >
        {/* Glow backdrop */}
        <motion.div
          className="absolute w-64 h-64 rounded-full"
          style={{ background: `radial-gradient(circle, ${config.colors[0]} 0%, transparent 70%)` }}
          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1, repeat: Infinity }}
        />

        <motion.h2
          className="relative text-5xl font-black italic tracking-widest text-white z-10"
          style={{ textShadow: `0 0 20px ${config.colors[1]}, 0 0 40px ${config.colors[0]}` }}
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          {config.title}
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative mt-2 px-8 py-2 bg-black/60 backdrop-blur-sm rounded-full border-2"
          style={{ borderColor: config.colors[0] }}
        >
          <span className="text-3xl font-black text-white" style={{ textShadow: `0 0 10px ${config.colors[0]}` }}>
            +{amount.toFixed(2)}
          </span>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
