'use client';
import { motion } from 'framer-motion';

interface WeeklyBlastFabProps {
  onClick: () => void;
}

export default function WeeklyBlastFab({ onClick }: WeeklyBlastFabProps) {
  return (
    <motion.div
      initial={{ scale: 0, y: 80, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.5 }}
      onClick={onClick}
      style={{
        position: 'fixed',
        bottom: '85px',
        right: '14px',
        zIndex: 9999,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {/* Outer pulsing glow ring */}
      <motion.div
        animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          inset: '-8px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,215,0,0.6) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Secondary ring */}
      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
        style={{
          position: 'absolute',
          inset: '-4px',
          borderRadius: '50%',
          border: '2px solid rgba(255,215,0,0.5)',
          pointerEvents: 'none',
        }}
      />

      {/* Main gift box container */}
      <motion.div
        animate={{
          y: [0, -8, 0],
          rotate: [-3, 3, -3],
        }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        whileHover={{ scale: 1.15, rotate: 0 }}
        whileTap={{ scale: 0.9 }}
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          background: 'linear-gradient(145deg, #FF6B35, #C0392B)',
          boxShadow: '0 8px 25px rgba(192,57,43,0.6), 0 0 0 3px #FFD700, inset 0 2px 5px rgba(255,255,255,0.3)',
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative' as const,
          overflow: 'hidden',
        }}
      >
        {/* Ribbon horizontal */}
        <div style={{
          position: 'absolute',
          top: 0, bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '12px',
          background: 'linear-gradient(180deg, #FFD700, #FFA500)',
          zIndex: 2,
        }} />
        {/* Ribbon vertical */}
        <div style={{
          position: 'absolute',
          left: 0, right: 0,
          top: '40%',
          height: '12px',
          background: 'linear-gradient(90deg, #FFD700, #FFA500)',
          zIndex: 2,
        }} />
        {/* Ribbon bow left */}
        <div style={{
          position: 'absolute',
          top: '18%',
          left: '12%',
          width: '18px',
          height: '13px',
          borderRadius: '50% 50% 0 0',
          background: 'linear-gradient(135deg, #FFD700, #FF8C00)',
          transform: 'rotate(-35deg)',
          zIndex: 3,
        }} />
        {/* Ribbon bow right */}
        <div style={{
          position: 'absolute',
          top: '18%',
          right: '12%',
          width: '18px',
          height: '13px',
          borderRadius: '50% 50% 0 0',
          background: 'linear-gradient(225deg, #FFD700, #FF8C00)',
          transform: 'rotate(35deg)',
          zIndex: 3,
        }} />
        {/* Shine overlay */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0,
          right: 0,
          height: '45%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
          borderRadius: '20px 20px 0 0',
          pointerEvents: 'none',
          zIndex: 4,
        }} />
      </motion.div>

      {/* Notification badge */}
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        style={{
          position: 'absolute',
          top: '-6px',
          right: '-6px',
          background: 'linear-gradient(135deg, #34C759, #27AE60)',
          color: '#fff',
          fontSize: '9px',
          fontWeight: '900',
          padding: '3px 5px',
          borderRadius: '10px',
          boxShadow: '0 2px 8px rgba(52,199,89,0.6)',
          border: '2px solid #fff',
          whiteSpace: 'nowrap' as const,
          zIndex: 10,
          lineHeight: 1,
        }}
      >
        🎉 WIN!
      </motion.div>
    </motion.div>
  );
}
