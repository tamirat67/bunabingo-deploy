'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { SlotSymbol, LineWin } from '../types';

import React from 'react';

// ── Custom SVG Components ─────────────────────────────────────────────────────
const BellSvg = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg" style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.5))' }}>
    <defs>
      <linearGradient id="bellGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="40%" stopColor="#eab308" />
        <stop offset="100%" stopColor="#a16207" />
      </linearGradient>
      <linearGradient id="bellHighlight" x1="20%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </defs>
    {/* Clapper */}
    <circle cx="50" cy="85" r="10" fill="#a16207" />
    {/* Main Bell Body */}
    <path d="M25,80 C15,80 10,85 10,85 L90,85 C90,85 85,80 75,80 C75,50 70,30 50,20 C30,30 25,50 25,80 Z" fill="url(#bellGrad)" stroke="#422006" strokeWidth="3" strokeLinejoin="round" />
    {/* Top Handle */}
    <path d="M45,20 C45,15 55,15 55,20" fill="none" stroke="#eab308" strokeWidth="6" strokeLinecap="round" />
    {/* Highlight */}
    <path d="M35,75 C35,45 40,35 50,25" fill="none" stroke="url(#bellHighlight)" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

const BarSvg = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full" style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.5))' }}>
    <defs>
      <linearGradient id="barOuter" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#000" />
        <stop offset="50%" stopColor="#333" />
        <stop offset="100%" stopColor="#000" />
      </linearGradient>
      <linearGradient id="barInner" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ef4444" />
        <stop offset="30%" stopColor="#fca5a5" />
        <stop offset="70%" stopColor="#dc2626" />
        <stop offset="100%" stopColor="#7f1d1d" />
      </linearGradient>
    </defs>
    {/* Outer border */}
    <rect x="5" y="30" width="90" height="40" rx="8" fill="url(#barOuter)" stroke="#fbbf24" strokeWidth="4" />
    {/* Inner body */}
    <rect x="10" y="35" width="80" height="30" rx="4" fill="url(#barInner)" />
    {/* Text */}
    <text x="50" y="58" fontFamily="Arial, sans-serif" fontSize="24" fontWeight="900" fill="#fff" textAnchor="middle" letterSpacing="2" style={{ textShadow: '1px 2px 2px rgba(0,0,0,0.8)' }}>BAR</text>
  </svg>
);

const SevenSvg = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full" style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.5))' }}>
    <defs>
      <linearGradient id="sevenBody" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ef4444" />
        <stop offset="50%" stopColor="#dc2626" />
        <stop offset="100%" stopColor="#7f1d1d" />
      </linearGradient>
    </defs>
    {/* Gold Outline + Shadow */}
    <path d="M20,25 L80,25 L50,85 L35,85 L60,40 L30,40 Z" fill="url(#sevenBody)" stroke="#facc15" strokeWidth="6" strokeLinejoin="miter" />
    {/* Inner detail line */}
    <path d="M30,32 L70,32 L46,75" fill="none" stroke="#f87171" strokeWidth="2" />
  </svg>
);

// ── Symbol visual definitions ─────────────────────────────────────────────────
const SYMBOL_CONFIG: Record<SlotSymbol, { emoji: string; color: string; glow: string; img?: string; svg?: React.ReactNode }> = {
  CHERRY:     { emoji: '🍒', color: '#ef4444', glow: 'rgba(239,68,68,0.6)',    img: '/symbols/cherry.png' },
  LEMON:      { emoji: '🍋', color: '#eab308', glow: 'rgba(234,179,8,0.6)',    img: '/symbols/lemon.png' },
  ORANGE:     { emoji: '🍊', color: '#f97316', glow: 'rgba(249,115,22,0.6)',   img: '/symbols/orange.png' },
  PLUM:       { emoji: '🍇', color: '#a855f7', glow: 'rgba(168,85,247,0.6)',   img: '/symbols/plum.png' },
  WATERMELON: { emoji: '🍉', color: '#22c55e', glow: 'rgba(34,197,94,0.6)',    img: '/symbols/watermelon.png' },
  GRAPES:     { emoji: '🍇', color: '#8b5cf6', glow: 'rgba(139,92,246,0.6)',   img: '/symbols/grapes.png' },
  BELL:       { emoji: '🔔', color: '#fbbf24', glow: 'rgba(251,191,36,0.6)',   svg: <BellSvg /> },
  BAR:        { emoji: '📊', color: '#f59e0b', glow: 'rgba(245,158,11,0.8)',   svg: <BarSvg /> },
  SEVEN:      { emoji: '7️⃣', color: '#ff0000', glow: 'rgba(255,0,0,0.9)',     svg: <SevenSvg /> },
};

// Payline cell positions for a 3×3 grid
const PAYLINE_CELLS: Record<string, [number,number][]> = {
  TOP:       [[0,0],[0,1],[0,2]],
  MIDDLE:    [[1,0],[1,1],[1,2]],
  BOTTOM:    [[2,0],[2,1],[2,2]],
  DIAG_DOWN: [[0,0],[1,1],[2,2]],
  DIAG_UP:   [[2,0],[1,1],[0,2]],
};

interface ReelGridProps {
  grid: SlotSymbol[][];       // [row][col]
  spinning: boolean;
  reelStopped: boolean[];     // which reels (cols) have stopped
  lineWins: LineWin[];
}

function isWinCell(row: number, col: number, lineWins: LineWin[]): boolean {
  return lineWins.some(lw => {
    const cells = PAYLINE_CELLS[lw.payline] ?? [];
    return cells.some(([r, c]) => r === row && c === col);
  });
}

function SpinningSymbol({ col, stopped, symbol, row, lineWins }: {
  col: number; stopped: boolean; symbol: SlotSymbol; row: number; lineWins: LineWin[];
}) {
  const cfg   = SYMBOL_CONFIG[symbol];
  const isWin = stopped && isWinCell(row, col, lineWins);

  return (
    <motion.div
      className="relative flex items-center justify-center rounded-xl select-none"
      style={{
        width: '100%',
        aspectRatio: '1',
        background: isWin
          ? `radial-gradient(circle, ${cfg.glow} 0%, #301010 80%)`
          : 'linear-gradient(145deg, #1a0505, #0a0000)',
        border: isWin ? `2px solid ${cfg.color}` : '1px solid rgba(251,191,36,0.15)',
        boxShadow: isWin ? `0 0 20px ${cfg.glow}, inset 0 0 10px ${cfg.glow}` : 'none',
      }}
      animate={isWin ? { scale: [1, 1.08, 1], opacity: [1, 0.85, 1] } : { scale: 1 }}
      transition={isWin ? { repeat: Infinity, duration: 0.7, repeatType: 'loop' } : {}}
    >
      {/* Spinning blur overlay */}
      <AnimatePresence>
        {!stopped && (
          <motion.div
            key="blur"
            className="absolute inset-0 rounded-xl flex flex-col items-center justify-center overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.3)' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {['🍒','🍋','🍊','🔔','7️⃣','🍒','🍋'].map((s, i) => (
              <motion.span
                key={i}
                className="text-xl leading-none"
                animate={{ y: ['-100%', '100%'] }}
                transition={{ duration: 0.25, repeat: Infinity, delay: i * 0.05, ease: 'linear' }}
              >
                {s}
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Symbol — use premium PNG/SVG if available, else emoji fallback */}
      {cfg.svg ? (
        <motion.div
          className="z-10 select-none flex items-center justify-center"
          style={{
            width: '75%',
            height: '75%',
            filter: isWin ? `drop-shadow(0 0 10px ${cfg.color}) drop-shadow(0 0 4px ${cfg.color})` : 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
            opacity: stopped ? 1 : 0,
            transform: stopped ? 'scale(1)' : 'scale(0.5)',
            transition: 'opacity 0.2s, transform 0.2s',
          }}
        >
          {cfg.svg}
        </motion.div>
      ) : cfg.img ? (
        <motion.img
          src={cfg.img}
          alt={symbol}
          className="z-10 select-none"
          style={{
            width: '72%',
            height: '72%',
            objectFit: 'contain',
            filter: isWin ? `drop-shadow(0 0 10px ${cfg.color}) drop-shadow(0 0 4px ${cfg.color})` : 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
            opacity: stopped ? 1 : 0,
            transform: stopped ? 'scale(1)' : 'scale(0.5)',
            transition: 'opacity 0.2s, transform 0.2s',
          }}
        />
      ) : (
        <motion.span
          className="text-3xl leading-none z-10"
          initial={false}
          animate={{ opacity: stopped ? 1 : 0, scale: stopped ? 1 : 0.5 }}
          transition={{ duration: 0.2 }}
          style={{ filter: isWin ? `drop-shadow(0 0 8px ${cfg.color})` : 'none' }}
        >
          {cfg.emoji}
        </motion.span>
      )}

      {/* Win flash */}
      {isWin && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ background: `radial-gradient(circle, ${cfg.glow} 0%, transparent 70%)` }}
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 0.6, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}

export default function ReelGrid({ grid, spinning, reelStopped, lineWins }: ReelGridProps) {
  const displayGrid: SlotSymbol[][] = grid.length === 3
    ? grid
    : Array(3).fill(null).map(() => Array(3).fill('CHERRY') as SlotSymbol[]);

  return (
    <div className="relative w-full p-3 rounded-2xl"
         style={{ background: 'linear-gradient(145deg, #1f0505, #0a0000)', border: '2px solid rgba(251,191,36,0.3)', boxShadow: '0 0 30px rgba(251,191,36,0.1)' }}>

      {/* Column separators */}
      <div className="absolute inset-y-3 left-1/3 w-px" style={{ background: 'rgba(251,191,36,0.15)' }} />
      <div className="absolute inset-y-3 left-2/3 w-px" style={{ background: 'rgba(251,191,36,0.15)' }} />

      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)' }}>
        {displayGrid.map((row, rowIdx) =>
          row.map((sym, colIdx) => (
            <SpinningSymbol
              key={`${rowIdx}-${colIdx}`}
              row={rowIdx}
              col={colIdx}
              symbol={sym}
              stopped={reelStopped[colIdx]}
              lineWins={lineWins}
            />
          ))
        )}
      </div>

      {/* Middle payline indicator */}
      <div className="absolute left-3 right-3 pointer-events-none"
           style={{ top: '50%', transform: 'translateY(-50%)', height: '2px', background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.4), transparent)' }} />
    </div>
  );
}
