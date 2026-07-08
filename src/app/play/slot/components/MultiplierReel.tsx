'use client';
import { motion } from 'framer-motion';

interface MultiplierReelProps {
  multiplier: number;
  spinning: boolean;
  stopped: boolean;
  win: boolean;
}

const MULTIPLIERS = [
  { val: 1, color: '#3b82f6' }, // Blue
  { val: 2, color: '#22c55e' }, // Green
  { val: 3, color: '#eab308' }, // Gold
  { val: 4, color: '#f97316' }, // Orange
  { val: 5, color: '#ec4899' }, // Pink
];

export default function MultiplierReel({ multiplier, spinning, stopped, win }: MultiplierReelProps) {
  // If spinning, we don't know the final value yet, so just animate or pick random
  // Actually, we can just use a fast CSS animation or pulse on all of them
  
  return (
    <div className="w-full mt-2 py-3 flex items-center justify-center gap-4">
      {MULTIPLIERS.map((m, i) => {
        const isActive = stopped && m.val === multiplier;
        const isSpinningAnim = spinning && !stopped;
        
        return (
          <div key={m.val} className="relative flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
            {/* Active Box */}
            {(isActive || isSpinningAnim) && (
              <motion.div
                className="absolute inset-0 rounded-md border-2"
                style={{
                  borderColor: isSpinningAnim ? 'rgba(34,197,94,0.3)' : '#22c55e',
                  background: isSpinningAnim ? 'transparent' : 'rgba(34,197,94,0.1)',
                  boxShadow: isActive ? '0 0 10px rgba(34,197,94,0.5), inset 0 0 10px rgba(34,197,94,0.3)' : 'none'
                }}
                animate={
                  isSpinningAnim 
                    ? { opacity: [0, 1, 0], scale: [0.9, 1.1, 0.9] } 
                    : isActive && win 
                      ? { scale: [1, 1.1, 1] } 
                      : { scale: 1 }
                }
                transition={
                  isSpinningAnim 
                    ? { duration: 0.5, repeat: Infinity, delay: i * 0.1 } 
                    : isActive && win 
                      ? { duration: 0.5, repeat: Infinity } 
                      : {}
                }
              />
            )}

            <span
              className="text-2xl font-black italic relative z-10"
              style={{
                color: m.color,
                textShadow: `0 2px 4px rgba(0,0,0,0.8), 0 0 ${isActive || isSpinningAnim ? '15px' : '5px'} ${m.color}`,
                opacity: (stopped && !isActive) ? 0.6 : 1,
                transform: isActive ? 'scale(1.2)' : 'scale(1)',
                transition: 'all 0.3s'
              }}
            >
              {m.val}x
            </span>
          </div>
        );
      })}
    </div>
  );
}
