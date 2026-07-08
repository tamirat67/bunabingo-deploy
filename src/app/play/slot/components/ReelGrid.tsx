'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { SlotSymbol, LineWin } from '../types';

// ── Symbol visual definitions ─────────────────────────────────────────────────
const SYMBOL_CONFIG: Record<SlotSymbol, { emoji: string; color: string; glow: string }> = {
  CHERRY:     { emoji: '🍒', color: '#ef4444', glow: 'rgba(239,68,68,0.6)' },
  LEMON:      { emoji: '🍋', color: '#eab308', glow: 'rgba(234,179,8,0.6)' },
  ORANGE:     { emoji: '🍊', color: '#f97316', glow: 'rgba(249,115,22,0.6)' },
  PLUM:       { emoji: '🍇', color: '#a855f7', glow: 'rgba(168,85,247,0.6)' },
  WATERMELON: { emoji: '🍉', color: '#22c55e', glow: 'rgba(34,197,94,0.6)' },
  GRAPES:     { emoji: '🍇', color: '#8b5cf6', glow: 'rgba(139,92,246,0.6)' },
  BELL:       { emoji: '🔔', color: '#fbbf24', glow: 'rgba(251,191,36,0.6)' },
  BAR:        { emoji: '📊', color: '#f59e0b', glow: 'rgba(245,158,11,0.8)' },
  SEVEN:      { emoji: '7️⃣', color: '#ff0000', glow: 'rgba(255,0,0,0.9)' },
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
          ? `radial-gradient(circle, ${cfg.glow} 0%, #1a2e1a 80%)`
          : 'linear-gradient(145deg, #1a2e1a, #0d1f0d)',
        border: isWin ? `2px solid ${cfg.color}` : '1px solid rgba(34,197,94,0.2)',
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

      {/* Symbol */}
      <motion.span
        className="text-3xl leading-none z-10"
        initial={false}
        animate={{ opacity: stopped ? 1 : 0, scale: stopped ? 1 : 0.5 }}
        transition={{ duration: 0.2 }}
        style={{ filter: isWin ? `drop-shadow(0 0 8px ${cfg.color})` : 'none' }}
      >
        {cfg.emoji}
      </motion.span>

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
         style={{ background: 'linear-gradient(145deg, #0a1f0a, #051505)', border: '2px solid rgba(34,197,94,0.3)', boxShadow: '0 0 30px rgba(34,197,94,0.1)' }}>

      {/* Column separators */}
      <div className="absolute inset-y-3 left-1/3 w-px" style={{ background: 'rgba(34,197,94,0.15)' }} />
      <div className="absolute inset-y-3 left-2/3 w-px" style={{ background: 'rgba(34,197,94,0.15)' }} />

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
           style={{ top: '50%', transform: 'translateY(-50%)', height: '2px', background: 'linear-gradient(90deg, transparent, rgba(34,197,94,0.4), transparent)' }} />
    </div>
  );
}
