'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onDone, 600); }, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          onClick={() => { setVisible(false); setTimeout(onDone, 600); }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #2a0808 0%, #450a0a 50%, #110000 100%)' }}
        >
          {/* Electric border glow */}
          <div className="absolute inset-0 pointer-events-none"
               style={{ boxShadow: 'inset 0 0 80px rgba(245,158,11,0.15)' }} />

          {/* Splash image */}
          <motion.img
            src="/buna_hot5_splash.png"
            alt="Buna Hot 5"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="w-full max-w-sm object-contain drop-shadow-2xl"
            style={{ filter: 'drop-shadow(0 0 30px rgba(245,158,11,0.4))' }}
          />

          {/* Tap to play hint */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: [0, 1, 0.5, 1], y: 0 }}
            transition={{ delay: 1.2, duration: 0.8, repeat: Infinity, repeatType: 'reverse' }}
            className="mt-4 text-yellow-500 text-sm font-semibold tracking-widest uppercase drop-shadow"
          >
            ▶ ለመጀመር ይጫኑ
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
