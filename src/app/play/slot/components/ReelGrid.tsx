'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { SlotSymbol, LineWin } from '../types';

// ── Symbol visual definitions ─────────────────────────────────────────────────
const SYMBOL_CONFIG: Record<SlotSymbol, { emoji: string; color: string; glow: string; img?: string }> = {
  CHERRY:     { emoji: '🍒', color: '#ef4444', glow: 'rgba(239,68,68,0.6)',    img: '/symbols/cherry.png' },
  LEMON:      { emoji: '🍋', color: '#eab308', glow: 'rgba(234,179,8,0.6)',    img: '/symbols/lemon.png' },
  ORANGE:     { emoji: '🍊', color: '#f97316', glow: 'rgba(249,115,22,0.6)',   img: '/symbols/orange.png' },
  PLUM:       { emoji: '🍇', color: '#a855f7', glow: 'rgba(168,85,247,0.6)',   img: '/symbols/plum.png' },
  WATERMELON: { emoji: '🍉', color: '#22c55e', glow: 'rgba(34,197,94,0.6)',    img: '/symbols/watermelon.png' },
  GRAPES:     { emoji: '🍇', color: '#8b5cf6', glow: 'rgba(139,92,246,0.6)',   img: '/symbols/grapes.png' },
  BELL:       { emoji: '🔔', color: '#fbbf24', glow: 'rgba(251,191,36,0.8)',   img: '/symbols/bell.png' },
  BAR:        { emoji: '📊', color: '#ef4444', glow: 'rgba(239,68,68,0.8)',    img: '/symbols/bar.png' },
  SEVEN:      { emoji: '7',  color: '#ff0000', glow: 'rgba(255,0,0,0.9)',      img: '/symbols/seven.png' },
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
          ? `radial-gradient(circle, ${cfg.glow} 0%, #14532d 80%)`
          : 'radial-gradient(circle at 30% 30%, #0d3320 0%, #041a0a 100%)',
        border: isWin ? `3px solid ${cfg.color}` : '2px solid rgba(180,83,9,0.7)',
        boxShadow: isWin ? `0 0 25px ${cfg.glow}, inset 0 0 15px ${cfg.glow}` : 'inset 0 2px 8px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.4)',
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

      {/* Symbol — use premium PNG, else emoji fallback */}
      {cfg.img ? (
        <motion.img
          src={cfg.img}
          alt={symbol}
          className="z-10 select-none"
          style={{
            width: '90%',
            height: '90%',
            objectFit: 'contain',
            filter: isWin
              ? `drop-shadow(0 0 12px ${cfg.color}) drop-shadow(0 0 6px ${cfg.color})`
              : 'drop-shadow(0 4px 6px rgba(0,0,0,0.8))',
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
         style={{ background: 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)', border: '3px solid #b45309', boxShadow: '0 0 40px rgba(180,83,9,0.2), inset 0 0 10px rgba(0,0,0,0.3)' }}>

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
           style={{ top: '50%', transform: 'translateY(-50%)', height: '3px', background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.6), transparent)', boxShadow: '0 0 10px rgba(251,191,36,0.5)' }} />
    </div>
  );
}
