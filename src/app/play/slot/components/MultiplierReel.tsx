'use client';
import { motion, AnimatePresence } from 'framer-motion';

interface MultiplierReelProps {
  multiplier: number;
  spinning: boolean;
  stopped: boolean;
  win: boolean;
}

export default function MultiplierReel({ multiplier, spinning, stopped, win }: MultiplierReelProps) {
  const isHigh = multiplier >= 5;

  return (
    <div className="relative w-full h-16 mt-3 rounded-xl flex items-center justify-center overflow-hidden"
         style={{ background: 'linear-gradient(145deg, #1a1a05, #0d0d02)', border: '2px solid rgba(234,179,8,0.4)', boxShadow: '0 0 20px rgba(234,179,8,0.1)' }}>

      <AnimatePresence>
        {spinning && !stopped && (
          <motion.div
            key="blur"
            className="absolute inset-0 flex flex-col items-center justify-center"
            exit={{ opacity: 0 }}
          >
            {[1, 2, 3, 5, 10, 15, 1].map((m, i) => (
              <motion.span
                key={i}
                className="text-2xl font-black text-yellow-500"
                animate={{ y: ['-100%', '100%'] }}
                transition={{ duration: 0.2, repeat: Infinity, delay: i * 0.03, ease: 'linear' }}
              >
                {m}x
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={false}
        animate={{ opacity: stopped ? 1 : 0, scale: stopped ? 1 : 0.5 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 flex items-center"
      >
        <span className="text-sm font-bold text-yellow-600 mr-2 uppercase tracking-wider">Multi</span>
        <span
          className="text-3xl font-black"
          style={{
            color: isHigh ? '#fbbf24' : '#eab308',
            textShadow: isHigh ? '0 0 15px rgba(251,191,36,0.8), 0 0 30px rgba(251,191,36,0.6)' : '0 0 10px rgba(234,179,8,0.5)',
          }}
        >
          {multiplier}x
        </span>
      </motion.div>

      {/* Win glow */}
      {stopped && win && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(234,179,8,0.3) 0%, transparent 80%)' }}
          animate={{ opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}
    </div>
  );
}
