'use client';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Zap, Star } from 'lucide-react';
import { markJackpotSeen } from '../lib/api';

interface JackpotSplashProps {
  show: boolean;
  jackpotAmount: string;
  onClose: () => void;
}

// ── Floating particle ─────────────────────────────────────────────────────────
function Particle({ delay, x, size, color }: { delay: number; x: number; size: number; color: string }) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: `${x}%`,
        bottom: '-10px',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: color,
        pointerEvents: 'none',
      }}
      animate={{
        y: [0, -600],
        opacity: [0, 1, 1, 0],
        scale: [0.5, 1, 0.8, 0.3],
        rotate: [0, 360],
      }}
      transition={{
        duration: 3 + Math.random() * 2,
        delay,
        ease: 'easeOut',
        repeat: Infinity,
        repeatDelay: Math.random() * 2,
      }}
    />
  );
}

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  delay: i * 0.18,
  x: Math.random() * 100,
  size: 6 + Math.random() * 10,
  color: ['#D4AF37', '#FFD700', '#FFF176', '#FF6B6B', '#9B59B6', '#3498DB', '#2ECC71'][i % 7],
}));

const BINGO_LETTERS = ['B', 'I', 'N', 'G', 'O'];
const LETTER_COLORS = ['#E74C3C', '#E67E22', '#F1C40F', '#2ECC71', '#3498DB'];

export default function JackpotSplash({ show, jackpotAmount, onClose }: JackpotSplashProps) {
  const [countdown, setCountdown] = useState(3);
  const [mounted, setMounted] = useState(false);
  const countRef = useRef<NodeJS.Timeout | null>(null);
  const closingRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  // Start countdown when splash is shown — auto-closes at 0
  useEffect(() => {
    if (!show || !mounted) return;

    setCountdown(3);
    closingRef.current = false;

    let c = 3;
    countRef.current = setInterval(() => {
      c -= 1;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(countRef.current!);
        handleClose();
      }
    }, 1000);

    return () => {
      clearInterval(countRef.current!);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, mounted]);

  const handleClose = async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    clearInterval(countRef.current!);
    try { await markJackpotSeen(); } catch {}
    onClose();
  };

  if (!mounted || !show) return null;

  return (
    <AnimatePresence>
      {/* ── Backdrop ── */}
      <motion.div
        key="jackpot-splash-bg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0',
          overflow: 'hidden',
        }}
      >
        {/* Background gradient */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 60%, #1a0533 0%, #0d001a 55%, #000 100%)',
        }} />

        {/* Animated glow rings */}
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.15, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            width: '350px',
            height: '350px',
            borderRadius: '50%',
            border: '2px solid rgba(212,175,55,0.3)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />
        <motion.div
          animate={{ scale: [1.15, 1, 1.15], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            border: '1px solid rgba(155,89,182,0.2)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />

        {/* Particles */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {PARTICLES.map(p => (
            <Particle key={p.id} delay={p.delay} x={p.x} size={p.size} color={p.color} />
          ))}
        </div>

        {/* ── Main Card ── */}
        <motion.div
          key="jackpot-splash-card"
          initial={{ opacity: 0, scale: 0.7, y: 60 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -40 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22, mass: 0.8 }}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '340px',
            margin: '0 20px',
            background: 'linear-gradient(160deg, #1E0A35 0%, #12011F 100%)',
            borderRadius: '28px',
            overflow: 'hidden',
            boxShadow: '0 0 60px rgba(212,175,55,0.35), 0 0 120px rgba(155,89,182,0.2), 0 30px 60px rgba(0,0,0,0.8)',
            border: '1px solid rgba(212,175,55,0.25)',
          }}
        >
          {/* Top gold border line */}
          <div style={{
            height: '3px',
            background: 'linear-gradient(90deg, transparent, #D4AF37, #FFD700, #D4AF37, transparent)',
          }} />

          {/* ── Countdown X button ── */}
          <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
            <motion.button
              onClick={handleClose}
              whileTap={{ scale: 0.9 }}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: countdown > 0
                  ? '2px solid rgba(255,255,255,0.2)'
                  : '2px solid rgba(255,255,255,0.6)',
                background: countdown > 0
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(255,255,255,0.18)',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.3s ease',
                fontSize: '14px',
                fontWeight: '900',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              {countdown > 0 ? <span>{countdown}</span> : <X size={18} />}
            </motion.button>
          </div>

          {/* ── Hero Section ── */}
          <div style={{ padding: '28px 24px 0', textAlign: 'center' }}>

            {/* Welcome Greeting */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{
                fontSize: '14px',
                color: 'rgba(255,255,255,0.6)',
                fontWeight: '600',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '2px'
              }}
            >
              እንኳን ደህና መጡ! • WELCOME
            </motion.div>

            {/* BINGO Letters */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '16px' }}>
              {BINGO_LETTERS.map((letter, i) => (
                <motion.div
                  key={letter}
                  initial={{ opacity: 0, y: -20, rotateX: -90 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{ delay: 0.1 + i * 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: `linear-gradient(135deg, ${LETTER_COLORS[i]}dd, ${LETTER_COLORS[i]}88)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '22px',
                    fontWeight: '900',
                    color: 'white',
                    boxShadow: `0 6px 15px ${LETTER_COLORS[i]}44`,
                    border: `1px solid rgba(255,255,255,0.2)`,
                    fontFamily: "'Outfit', sans-serif",
                    textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                  }}
                >
                  {letter}
                </motion.div>
              ))}
            </div>

            {/* Trophy icon with glow */}
            <motion.div
              animate={{ y: [0, -8, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}
            >
              <div style={{
                width: '90px',
                height: '90px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(212,175,55,0.3) 0%, rgba(212,175,55,0) 70%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Trophy size={60} color="#FFD700" strokeWidth={1.5} />
              </div>
            </motion.div>

            {/* Derash Jackpot text */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
            >
              <div style={{
                fontSize: '14px',
                letterSpacing: '5px',
                color: '#FFD700',
                fontWeight: '900',
                marginBottom: '4px',
                textTransform: 'uppercase',
                textShadow: '0 0 10px rgba(255,215,0,0.4)'
              }}>
                ✨ ደራሽ ✨
              </div>
              <div style={{
                fontSize: '44px',
                fontWeight: '900',
                color: 'white',
                lineHeight: '1',
                textShadow: '0 0 30px rgba(212,175,55,0.6)',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '-1.5px',
              }}>
                JACKPOT
              </div>
              <div style={{
                fontSize: '16px',
                color: 'rgba(255,255,255,0.5)',
                marginTop: '8px',
                fontWeight: '500',
                letterSpacing: '0.5px'
              }}>
                ትልቅ ሽልማት — BIG WIN AWAITS!
              </div>
            </motion.div>

            {/* Prize pool amount */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              style={{
                margin: '20px 0',
                background: 'rgba(212,175,55,0.1)',
                border: '1px solid rgba(212,175,55,0.3)',
                borderRadius: '16px',
                padding: '14px',
              }}
            >
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: '800', letterSpacing: '2px', marginBottom: '4px' }}>
                CURRENT PRIZE POOL
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px' }}>
                <motion.span
                  animate={{ textShadow: ['0 0 10px rgba(212,175,55,0.5)', '0 0 25px rgba(212,175,55,0.9)', '0 0 10px rgba(212,175,55,0.5)'] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ fontSize: '44px', fontWeight: '900', color: '#FFD700', lineHeight: '1', fontFamily: "'Outfit', sans-serif" }}
                >
                  {jackpotAmount}
                </motion.span>
                <span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.4)', fontWeight: '700' }}>ETB</span>
              </div>
            </motion.div>
          </div>

          {/* ── Info rows ── */}
          <div style={{ padding: '0 24px' }}>
            {[
              { icon: '🎯', text: 'Full House በ40 ቦልስ ውስጥ → ሙሉ ጃክፖት!' },
              { icon: '⚡', text: 'Row/Column በ7 ቦልስ ውስጥ → ፈጣን ሽልማት!' },
              { icon: '🏆', text: 'ፖቱ ሲሞላ → 0.1% ዕድል ሙሉ ጃክፖት ይወዛወዛሉ!' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.12 }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  marginBottom: '10px',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5', margin: 0 }}>{item.text}</p>
              </motion.div>
            ))}
          </div>

          {/* ── CTA Button ── */}
          <div style={{ padding: '16px 24px 28px' }}>
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleClose}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #D4AF37 0%, #FFD700 50%, #B8860B 100%)',
                color: '#1a0533',
                border: 'none',
                padding: '16px',
                borderRadius: '16px',
                fontWeight: '900',
                fontSize: '16px',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(212,175,55,0.5)',
                letterSpacing: '0.5px',
                fontFamily: "'Outfit', sans-serif",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Zap size={18} />
              ጨዋታ ጀምር! — LET'S PLAY
            </motion.button>
          </div>

          {/* Bottom gold border line */}
          <div style={{
            height: '3px',
            background: 'linear-gradient(90deg, transparent, #9B59B6, #D4AF37, #9B59B6, transparent)',
          }} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
