'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '../../../context/SocketContext';
import { useTheme } from '../../../context/ThemeContext';
import BunaModal from '../../../components/BunaModal';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Wallet as WalletIcon, X, HelpCircle, RotateCcw } from 'lucide-react';
import { getMe } from '../../../lib/api';

const CHIP_VALUES = [5, 10, 50, 100, 500, 1000];

// European Roulette wheel order
const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const TOTAL = WHEEL_ORDER.length; // 37

const ETH_PALETTE = [
  '#078930','#FCDD09','#DA121A','#7B2FBE','#00897B',
  '#E65100','#0097A7','#C2185B','#1565C0','#6A1B9A','#F57F17','#2E7D32',
];

function getSectorColor(index: number, num: number): string {
  if (num === 0) return '#078930';
  return ETH_PALETTE[index % ETH_PALETTE.length];
}

// ── Chip colors by value ──────────────────────────────────────────────────────
const CHIP_COLORS: Record<number, { bg: string; border: string; text: string; glow: string }> = {
  5:    { bg: 'linear-gradient(145deg, #4ADE80, #16A34A)', border: '#166534', text: '#fff', glow: 'rgba(74,222,128,0.6)' },
  10:   { bg: 'linear-gradient(145deg, #60A5FA, #2563EB)', border: '#1e3a8a', text: '#fff', glow: 'rgba(96,165,250,0.6)' },
  50:   { bg: 'linear-gradient(145deg, #F472B6, #DB2777)', border: '#831843', text: '#fff', glow: 'rgba(244,114,182,0.6)' },
  100:  { bg: 'linear-gradient(145deg, #FB923C, #EA580C)', border: '#9a3412', text: '#fff', glow: 'rgba(251,146,60,0.6)' },
  500:  { bg: 'linear-gradient(145deg, #A78BFA, #7C3AED)', border: '#4c1d95', text: '#fff', glow: 'rgba(167,139,250,0.6)' },
  1000: { bg: 'linear-gradient(145deg, #FCD34D, #F59E0B)', border: '#92400e', text: '#1a0900', glow: 'rgba(252,211,77,0.8)' },
};

// ── SVG Roulette Wheel ────────────────────────────────────────────────────────
function RouletteWheel({ rotation, isSpinning }: { rotation: number; isSpinning: boolean }) {
  const SIZE = 300;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const outerR = 138;
  const innerR = 68;
  const textR  = 112;
  const sliceAngle = (2 * Math.PI) / TOTAL;

  const sectors = WHEEL_ORDER.map((num, i) => {
    const startA = i * sliceAngle - Math.PI / 2;
    const endA   = (i + 1) * sliceAngle - Math.PI / 2;
    const midA   = (startA + endA) / 2;
    const px = (r: number, a: number) => cx + r * Math.cos(a);
    const py = (r: number, a: number) => cy + r * Math.sin(a);
    const d = [
      `M${px(outerR, startA)},${py(outerR, startA)}`,
      `A${outerR},${outerR} 0 0,1 ${px(outerR, endA)},${py(outerR, endA)}`,
      `L${px(innerR, endA)},${py(innerR, endA)}`,
      `A${innerR},${innerR} 0 0,0 ${px(innerR, startA)},${py(innerR, startA)}`,
      'Z',
    ].join(' ');
    const tx = px(textR, midA);
    const ty = py(textR, midA);
    const rotateDeg = midA * (180 / Math.PI) + 90;
    const color = getSectorColor(i, num);
    const lightColors = ['#FCDD09', '#F57F17'];
    const textFill = lightColors.includes(color) ? '#1a0a00' : '#FFFFFF';
    const dx = px(outerR + 6, endA);
    const dy = py(outerR + 6, endA);
    return { d, tx, ty, rotateDeg, num, color, textFill, dx, dy };
  });

  return (
    <motion.div
      animate={{ rotate: rotation }}
      transition={{ duration: isSpinning ? 8 : 0, ease: isSpinning ? [0.05, 0.3, 0.85, 1.0] : 'linear' }}
      style={{ width: SIZE, height: SIZE }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <defs>
          <filter id="wheelGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {/* Outer glow ring */}
        <circle cx={cx} cy={cy} r={outerR + 14} fill="none" stroke="#F59E0B" strokeWidth="2" opacity="0.4" />
        <circle cx={cx} cy={cy} r={outerR + 10} fill="#0D1B0F" stroke="#F59E0B" strokeWidth="3" />
        {/* Segments */}
        {sectors.map(({ d, tx, ty, rotateDeg, num, color, textFill }, i) => (
          <g key={i}>
            <path d={d} fill={color} stroke="#0D1B0F" strokeWidth="1.5" />
            <text
              x={tx} y={ty}
              fill={textFill}
              fontSize="9"
              fontWeight="900"
              textAnchor="middle"
              dominantBaseline="central"
              transform={`rotate(${rotateDeg},${tx},${ty})`}
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              {num}
            </text>
          </g>
        ))}
        {/* Gold separator dots */}
        {sectors.map(({ dx, dy }, i) => (
          <circle key={`d${i}`} cx={dx} cy={dy} r="3" fill="#F59E0B" />
        ))}
        {/* Hub */}
        <circle cx={cx} cy={cy} r={innerR}      fill="#0D1B0F" stroke="#F59E0B" strokeWidth="3" />
        <circle cx={cx} cy={cy} r={innerR - 12} fill="#111827" stroke="#F59E0B" strokeWidth="1" opacity="0.6" />
        <text x={cx} y={cy - 12} fill="#F59E0B" fontSize="11" fontWeight="900" textAnchor="middle" style={{ fontFamily: "'Inter', sans-serif" }}>BUNA</text>
        <text x={cx} y={cy + 4}  fill="#F59E0B" fontSize="11" fontWeight="900" textAnchor="middle" style={{ fontFamily: "'Inter', sans-serif" }}>BINGO</text>
        <text x={cx} y={cy + 18} fill="#FCD34D" fontSize="8"  textAnchor="middle" style={{ fontFamily: "'Inter', sans-serif" }}>ቡና ቢንጎ</text>
        <circle cx={cx} cy={cy + 30} r="4" fill="#F59E0B" />
      </svg>
    </motion.div>
  );
}

// ── Result Modal ──────────────────────────────────────────────────────────────
function ResultModal({ result, winAmount, onClose }: { result: number; winAmount: number; onClose: () => void }) {
  const redNums = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  const isGreen = result === 0;
  const isRed   = redNums.includes(result);
  const ballColor = isGreen ? '#22C55E' : isRed ? '#EF4444' : '#1E293B';
  const ballGlow  = isGreen ? 'rgba(34,197,94,0.6)' : isRed ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.2)';
  const label     = isGreen ? 'GREEN' : isRed ? 'RED' : 'BLACK';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, backdropFilter: 'blur(12px)',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.4, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.4, opacity: 0 }}
        transition={{ type: 'spring', damping: 14, stiffness: 200 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, #1E293B 0%, #0F172A 100%)',
          borderRadius: '28px',
          padding: '32px 44px',
          textAlign: 'center',
          border: '2px solid rgba(245,158,11,0.5)',
          boxShadow: '0 0 60px rgba(245,158,11,0.2), 0 32px 80px rgba(0,0,0,0.8)',
          minWidth: '270px', maxWidth: '320px',
          position: 'relative',
        }}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
          <X size={20} />
        </button>

        <div style={{ fontSize: '11px', color: '#F59E0B', fontWeight: '800', letterSpacing: '3px', marginBottom: '20px', textTransform: 'uppercase' }}>
          🎰 Result
        </div>

        {/* Number ball */}
        <motion.div
          animate={{ scale: [0.6, 1.1, 1] }}
          transition={{ duration: 0.5 }}
          style={{
            width: '110px', height: '110px', borderRadius: '50%',
            background: ballColor,
            border: `4px solid #F59E0B`,
            margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 50px ${ballGlow}, 0 8px 32px rgba(0,0,0,0.5)`,
          }}
        >
          <span style={{ color: 'white', fontSize: '52px', fontWeight: '900', lineHeight: 1, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>{result}</span>
        </motion.div>

        <div style={{ fontSize: '14px', color: '#F59E0B', fontWeight: '900', letterSpacing: '3px', marginBottom: '4px' }}>{label}</div>
        <div style={{ width: '60px', height: '2px', background: 'linear-gradient(90deg,transparent,#F59E0B,transparent)', margin: '14px auto 16px' }} />

        <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', marginBottom: '6px' }}>You win:</div>
        <motion.div
          animate={winAmount > 0 ? { scale: [0.8, 1.15, 1] } : {}}
          transition={{ duration: 0.4 }}
          style={{
            fontSize: '44px', fontWeight: '900',
            color: winAmount > 0 ? '#4ADE80' : '#94A3B8',
            textShadow: winAmount > 0 ? '0 0 30px rgba(74,222,128,0.6)' : 'none',
            lineHeight: 1,
          }}
        >
          {winAmount > 0 ? `+${winAmount.toFixed(2)}` : '0'}
        </motion.div>
        <div style={{ fontSize: '14px', color: '#F59E0B', fontWeight: '800', marginTop: '4px' }}>ETB</div>

        {winAmount > 0 && (
          <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: 4, duration: 0.4 }} style={{ fontSize: '28px', marginTop: '10px' }}>
            🎉
          </motion.div>
        )}

        <button onClick={onClose} style={{
          marginTop: '24px', padding: '14px 48px',
          background: 'linear-gradient(135deg, #F59E0B, #D97706)',
          color: '#0F172A', border: 'none', borderRadius: '14px',
          fontWeight: '900', fontSize: '15px', cursor: 'pointer',
          boxShadow: '0 4px 0 #92400E, 0 6px 20px rgba(245,158,11,0.4)',
          letterSpacing: '1px',
        }}>
          CONTINUE
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── How To Play Modal ──────────────────────────────────────────────────────────
function HowToPlayModal({ onClose }: { onClose: () => void }) {
  const BET_ROWS = [
    { bet: 'Straight Up',    desc: 'Single number 0–36',         pay: '35:1 🔥', chance: '2.7%' },
    { bet: 'Red / Black',    desc: 'Ball color (0 loses)',        pay: '1:1',     chance: '48.6%' },
    { bet: 'Even / Odd',     desc: 'Even or odd (0 loses)',       pay: '1:1',     chance: '48.6%' },
    { bet: '1–18 / 19–36',   desc: 'Low or high half',           pay: '1:1',     chance: '48.6%' },
    { bet: '1st/2nd/3rd 12', desc: 'One of three dozens',        pay: '2:1',     chance: '32.4%' },
    { bet: 'Column',         desc: 'One of three columns',        pay: '2:1',     chance: '32.4%' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9998, backdropFilter: 'blur(12px)', overflowY: 'auto', padding: '20px 12px 100px' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 18 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'linear-gradient(160deg, #1E293B 0%, #0F172A 100%)', borderRadius: '24px', border: '2px solid rgba(245,158,11,0.4)', maxWidth: '420px', margin: '0 auto', overflow: 'hidden', boxShadow: '0 0 60px rgba(245,158,11,0.15)' }}
      >
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: '900', color: '#F59E0B', letterSpacing: '1px' }}>🎰 How to Play</div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>እንዴት መጫወት ይቻላል</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#94A3B8', cursor: 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Round flow */}
          <div style={{ background: 'rgba(245,158,11,0.08)', borderRadius: '12px', padding: '14px', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div style={{ fontSize: '11px', fontWeight: '900', color: '#F59E0B', letterSpacing: '2px', marginBottom: '10px' }}>ROUND FLOW</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { icon: '⏳', label: 'BET', sub: '30s', color: '#22C55E' },
                { icon: '→', label: '', sub: '', color: '#F59E0B' },
                { icon: '🎰', label: 'SPIN', sub: '10s', color: '#F59E0B' },
                { icon: '→', label: '', sub: '', color: '#F59E0B' },
                { icon: '✅', label: 'PAYOUT', sub: '5s', color: '#22C55E' },
                { icon: '→', label: '', sub: '', color: '#F59E0B' },
                { icon: '🔄', label: 'REPEAT', sub: '', color: '#60A5FA' },
              ].map((step, i) => step.label ? (
                <div key={i} style={{ textAlign: 'center', flex: '0 0 auto' }}>
                  <div style={{ fontSize: '18px' }}>{step.icon}</div>
                  <div style={{ fontSize: '8px', fontWeight: '900', color: step.color, letterSpacing: '0.5px' }}>{step.label}</div>
                  {step.sub && <div style={{ fontSize: '7px', color: '#64748B' }}>{step.sub}</div>}
                </div>
              ) : (
                <div key={i} style={{ color: '#F59E0B', fontSize: '14px', opacity: 0.4 }}>{step.icon}</div>
              ))}
            </div>
          </div>

          {/* Bet table */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: '900', color: '#F59E0B', letterSpacing: '2px', marginBottom: '8px' }}>BET TYPES & PAYOUTS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 50px', gap: '4px', padding: '4px 8px' }}>
                <div style={{ fontSize: '9px', color: '#475569', fontWeight: '900', textTransform: 'uppercase' }}>BET</div>
                <div style={{ fontSize: '9px', color: '#475569', fontWeight: '900', textAlign: 'center' }}>PAYOUT</div>
                <div style={{ fontSize: '9px', color: '#475569', fontWeight: '900', textAlign: 'right' }}>ODDS</div>
              </div>
              {BET_ROWS.map((row, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 50px', gap: '4px', background: i % 2 === 0 ? 'rgba(245,158,11,0.06)' : 'transparent', padding: '8px', borderRadius: '6px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '900', color: '#F8FAFC' }}>{row.bet}</div>
                    <div style={{ fontSize: '9px', color: '#64748B', marginTop: '1px' }}>{row.desc}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: '6px', padding: '3px 7px', fontSize: '11px', fontWeight: '900', color: '#F59E0B', textAlign: 'center' }}>{row.pay}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: '10px', color: '#64748B', fontWeight: '700' }}>{row.chance}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Zero rule */}
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '10px', padding: '12px 14px', display: 'flex', gap: '10px' }}>
            <div style={{ fontSize: '24px', lineHeight: 1 }}>🟢</div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '900', color: '#4ADE80', marginBottom: '3px' }}>Zero Rule • ዜሮ ደንብ</div>
              <div style={{ fontSize: '10px', color: '#94A3B8', lineHeight: 1.5 }}>
                When <strong style={{ color: '#4ADE80' }}>0</strong> lands, all outside bets <strong style={{ color: '#EF4444' }}>lose</strong>. Only Straight Up on 0 wins at 35:1.
              </div>
            </div>
          </div>

          {/* Tips */}
          <div style={{ background: 'rgba(245,158,11,0.06)', borderRadius: '10px', padding: '12px 14px', border: '1px solid rgba(245,158,11,0.15)' }}>
            <div style={{ fontSize: '11px', fontWeight: '900', color: '#F59E0B', letterSpacing: '2px', marginBottom: '8px' }}>💡 QUICK TIPS</div>
            {[
              { emoji: '🛡️', tip: 'Safe: Red/Black or Even/Odd — ~49% win chance' },
              { emoji: '⚖️', tip: 'Balanced: Dozen (2:1) + one outside bet' },
              { emoji: '🔥', tip: 'Big win: Straight Up pays 35:1 (low chance)' },
              { emoji: '💰', tip: 'Bonus balance is used first automatically' },
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '6px' }}>
                <span style={{ fontSize: '14px' }}>{t.emoji}</span>
                <span style={{ fontSize: '10px', color: '#94A3B8', lineHeight: 1.5 }}>{t.tip}</span>
              </div>
            ))}
          </div>

          <button onClick={onClose} style={{ padding: '14px', background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#0F172A', border: 'none', borderRadius: '12px', fontWeight: '900', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 0 #92400E, 0 6px 20px rgba(245,158,11,0.4)' }}>
            Got it! ✓
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Chip badge on a bet cell ──────────────────────────────────────────────────
function BetChip({ val, small }: { val: number; small?: boolean }) {
  const s = small ? 16 : 20;
  const chip = CHIP_COLORS[val] || CHIP_COLORS[10];
  return (
    <div style={{
      position: 'absolute', top: '-7px', right: '-7px',
      background: chip.bg, color: chip.text, borderRadius: '50%',
      width: s, height: s,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: small ? '6px' : '7px', fontWeight: '900', zIndex: 10,
      border: `2px solid ${chip.border}`,
      boxShadow: `0 0 8px ${chip.glow}, 0 2px 4px rgba(0,0,0,0.4)`,
      pointerEvents: 'none',
    }}>
      {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
    </div>
  );
}

// ── Number cell (betting board) ───────────────────────────────────────────────
function NumCell({ num, bet, onClick }: { num: number; bet?: number; onClick: () => void }) {
  const red = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  const [hovered, setHovered] = useState(false);
  const isGreen = num === 0;
  const isRed   = red.includes(num);
  const base = isGreen ? '#14532D' : isRed ? '#7F1D1D' : '#1C1917';
  const hover = isGreen ? '#166534' : isRed ? '#991B1B' : '#292524';
  const hasBet = (bet ?? 0) > 0;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? hover : base,
        color: '#FFFFFF',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '11px', fontWeight: '900',
        borderRadius: '4px',
        position: 'relative', cursor: 'pointer',
        minHeight: '30px',
        userSelect: 'none',
        border: hasBet ? '1px solid #F59E0B' : '1px solid rgba(255,255,255,0.06)',
        boxShadow: hasBet ? '0 0 8px rgba(245,158,11,0.4)' : hovered ? '0 0 8px rgba(255,255,255,0.1)' : 'none',
        transition: 'all 0.12s ease',
        transform: hovered ? 'scale(1.04)' : 'scale(1)',
      }}
    >
      {num}
      {hasBet && <BetChip val={bet!} small />}
    </div>
  );
}

// ── Outside / special bet cell ────────────────────────────────────────────────
function OutsideCell({ label, betKey, bet, onClick, bg, color }: {
  label: string; betKey: string; bet?: number; onClick: () => void; bg?: string; color?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const hasBet = (bet ?? 0) > 0;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: bg || (hovered ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'),
        color: color || (hovered ? '#F59E0B' : '#FCD34D'),
        padding: '8px 0', textAlign: 'center',
        fontSize: '9px', fontWeight: '900',
        borderRadius: '4px', cursor: 'pointer',
        position: 'relative', userSelect: 'none',
        border: hasBet ? '1px solid #F59E0B' : '1px solid rgba(255,255,255,0.08)',
        boxShadow: hasBet ? '0 0 8px rgba(245,158,11,0.4)' : 'none',
        transition: 'all 0.12s ease',
        transform: hovered ? 'scale(1.03)' : 'scale(1)',
      }}
    >
      {label}
      {hasBet && <BetChip val={bet!} small />}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function RouletteContent() {
  const router = useRouter();
  const { T } = useTheme();
  const { socket, isConnected } = useSocket();

  const [balance,      setBalance]      = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [status,           setStatus]           = useState<'BETTING' | 'SPINNING' | 'PAYOUT'>('BETTING');
  const [secondsRemaining, setSecondsRemaining] = useState(30);
  const [history,          setHistory]          = useState<number[]>([]);
  const [currentResult,    setCurrentResult]    = useState<number | null>(null);
  const [winAmount,        setWinAmount]        = useState(0);
  const [showResult,       setShowResult]       = useState(false);

  const accumulated = useRef(0);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isSpinning,    setIsSpinning]    = useState(false);

  const [selectedChip,  setSelectedChip]  = useState(10);
  const [myBets,        setMyBets]        = useState<Record<string, number>>({});
  const [totalBet,      setTotalBet]      = useState(0);
  const [isPlacing,     setIsPlacing]     = useState(false);
  const [betConfirmed,  setBetConfirmed]  = useState(false);

  const [modal,    setModal]    = useState({ isOpen: false, title: '', message: '' });
  const [showHelp, setShowHelp] = useState(false);

  const refreshBalance = () =>
    getMe().then(u => {
      if (u?.wallet) { setBalance(Number(u.wallet.balance)); setBonusBalance(Number(u.wallet.bonusBalance)); }
    }).catch(console.error);

  useEffect(() => { refreshBalance(); }, []);

  const computeRotation = (resultNum: number) => {
    const idx = WHEEL_ORDER.indexOf(resultNum);
    const degPerSlot = 360 / TOTAL;
    const targetOffset = idx * degPerSlot + degPerSlot / 2;
    const next = accumulated.current + (360 * 6) + (360 - targetOffset % 360);
    accumulated.current = next;
    return next;
  };

  useEffect(() => {
    if (!socket || !isConnected) return;
    socket.emit('join-roulette');

    socket.on('roulette-state', (s: any) => {
      setStatus(s.status);
      setSecondsRemaining(s.secondsRemaining);
      setHistory(s.history || []);
      setCurrentResult(s.currentResult);
      if (s.status === 'BETTING') {
        setMyBets({}); setTotalBet(0); setBetConfirmed(false);
        setIsSpinning(false); setShowResult(false); setWinAmount(0);
      }
    });
    socket.on('roulette-tick', (d: any) => { setStatus(d.status); setSecondsRemaining(d.secondsRemaining); });
    socket.on('roulette-spinning', (d: any) => {
      setStatus('SPINNING');
      setCurrentResult(d.result);
      setSecondsRemaining(d.secondsRemaining);
      setIsSpinning(true);
      setWheelRotation(computeRotation(d.result));
    });
    socket.on('roulette-result', (d: any) => {
      setStatus('PAYOUT');
      setCurrentResult(d.result);
      setHistory(d.history || []);
      setSecondsRemaining(d.secondsRemaining);
      setTimeout(() => { setIsSpinning(false); setShowResult(true); refreshBalance(); }, 8500);
    });
    socket.on('roulette-bet-success', () => setBetConfirmed(true));
    socket.on('roulette-bet-error',   (d: any) => {
      setIsPlacing(false);
      setModal({ isOpen: true, title: 'Bet Failed', message: d.message || 'Could not place bet.' });
    });

    return () => {
      socket.off('roulette-state'); socket.off('roulette-tick');
      socket.off('roulette-spinning'); socket.off('roulette-result');
      socket.off('roulette-bet-success'); socket.off('roulette-bet-error');
      socket.emit('leave-roulette');
    };
  }, [socket, isConnected]);

  const handlePlaceBet = () => {
    if (totalBet <= 0 || !socket || !isConnected || status !== 'BETTING') return;
    setIsPlacing(true);
    for (const [key, amount] of Object.entries(myBets)) {
      if (amount <= 0) continue;
      let betType = '', betValue = '';
      if (key.startsWith('num_'))   { betType = 'STRAIGHT'; betValue = key.replace('num_', ''); }
      else if (key === 'col_1')     { betType = 'COLUMN';   betValue = '1ST'; }
      else if (key === 'col_2')     { betType = 'COLUMN';   betValue = '2ND'; }
      else if (key === 'col_3')     { betType = 'COLUMN';   betValue = '3RD'; }
      else if (key === 'doz_1')     { betType = 'DOZEN';    betValue = '1ST'; }
      else if (key === 'doz_2')     { betType = 'DOZEN';    betValue = '2ND'; }
      else if (key === 'doz_3')     { betType = 'DOZEN';    betValue = '3RD'; }
      else if (key === 'red')       { betType = 'COLOR';    betValue = 'RED';  }
      else if (key === 'black')     { betType = 'COLOR';    betValue = 'BLACK';}
      else if (key === 'even')      { betType = 'EVEN_ODD'; betValue = 'EVEN'; }
      else if (key === 'odd')       { betType = 'EVEN_ODD'; betValue = 'ODD';  }
      else if (key === '1-18')      { betType = 'HIGH_LOW'; betValue = 'LOW';  }
      else if (key === '19-36')     { betType = 'HIGH_LOW'; betValue = 'HIGH'; }
      socket.emit('roulette-place-bet', { amount, betType, betValue });
    }
    setBalance(prev => Math.max(0, prev - totalBet));
    setIsPlacing(false);
  };

  const onBet = (key: string) => {
    if (status !== 'BETTING' || betConfirmed) return;
    if (totalBet + selectedChip > balance + bonusBalance) {
      setModal({ isOpen: true, title: 'Insufficient Balance', message: 'You do not have enough balance to place this bet.' });
      return;
    }
    setMyBets(prev => ({ ...prev, [key]: (prev[key] || 0) + selectedChip }));
    setTotalBet(prev => prev + selectedChip);
  };
  const clearBets = () => { setMyBets({}); setTotalBet(0); };

  const timerPct = status === 'BETTING' ? (secondsRemaining / 30) * 100 : 0;
  const timerCol = timerPct > 60 ? '#22C55E' : timerPct > 25 ? '#F59E0B' : '#EF4444';

  const redNums = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  const numColor = (n: number) => n === 0 ? '#22C55E' : redNums.includes(n) ? '#EF4444' : '#374151';

  return (
    <div style={{ background: 'linear-gradient(180deg, #0D1B0F 0%, #0F172A 50%, #0D0D1A 100%)', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ padding: '12px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(245,158,11,0.15)', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => router.push('/')}>
          <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={18} color="#94A3B8" />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#F59E0B', letterSpacing: '2px', textShadow: '0 0 20px rgba(245,158,11,0.4)' }}>
              🎰 ROULETTE
            </div>
            <div style={{ fontSize: '9px', color: '#64748B', fontWeight: '700', letterSpacing: '1px' }}>ሩሌት • European</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowHelp(true)}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94A3B8' }}
          >
            <HelpCircle size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '20px', padding: '5px 14px', color: '#F59E0B', fontSize: '13px', fontWeight: '900', boxShadow: '0 0 12px rgba(245,158,11,0.2)' }}>
            <WalletIcon size={14} />
            {(balance + bonusBalance).toFixed(0)} ETB
          </div>
        </div>
      </div>

      {/* ── Timer bar ── */}
      <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          animate={{ width: `${timerPct}%` }}
          transition={{ duration: 0.9, ease: 'linear' }}
          style={{ height: '100%', background: timerCol, boxShadow: `0 0 8px ${timerCol}`, borderRadius: '0 2px 2px 0', transition: 'background 0.5s' }}
        />
      </div>

      {/* ── Status row ── */}
      <div style={{ padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: '12px', fontWeight: '900', letterSpacing: '0.5px' }}>
          {status === 'BETTING' && (
            <span style={{ color: '#4ADE80' }}>⏳ Place bets • <span style={{ color: timerCol, fontVariantNumeric: 'tabular-nums' }}>{secondsRemaining}s</span></span>
          )}
          {status === 'SPINNING' && <span style={{ color: '#F59E0B', animation: 'pulse 1s infinite' }}>🎰 Spinning...</span>}
          {status === 'PAYOUT'   && <span style={{ color: '#4ADE80' }}>✅ Result: <strong style={{ color: '#F59E0B' }}>{currentResult}</strong></span>}
        </div>
        {/* History bubbles */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {history.slice(0, 7).map((n, i) => (
            <motion.div
              key={`${n}-${i}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{
                width: '22px', height: '22px', borderRadius: '50%',
                background: numColor(n),
                color: '#FFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '8px', fontWeight: '900',
                border: '1px solid rgba(255,255,255,0.2)',
                boxShadow: `0 0 6px ${numColor(n)}88`,
              }}
            >
              {n}
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Betting Board (green felt) ── */}
      <div style={{ padding: '10px 8px 6px', background: 'linear-gradient(180deg, #052e16 0%, #0d1a0e 100%)', margin: '8px auto', width: 'calc(100% - 16px)', maxWidth: '500px', borderRadius: '14px', border: '2px solid rgba(245,158,11,0.2)', boxShadow: 'inset 0 2px 20px rgba(0,0,0,0.5), 0 0 30px rgba(245,158,11,0.05)' }}>

        {/* Numbers grid: 0 | 3 rows | 2:1 columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 30px', gap: '3px', marginBottom: '3px' }}>
          {/* 0 — spans 3 rows */}
          <div
            onClick={() => onBet('num_0')}
            style={{
              background: myBets['num_0'] ? '#166534' : '#14532D',
              color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '5px', fontWeight: '900', fontSize: '15px',
              position: 'relative', cursor: 'pointer',
              border: myBets['num_0'] ? '1px solid #F59E0B' : '1px solid rgba(255,255,255,0.1)',
              gridRow: '1/4', userSelect: 'none',
              boxShadow: myBets['num_0'] ? '0 0 10px rgba(245,158,11,0.5)' : 'none',
              transition: 'all 0.12s',
            }}
          >
            0 {(myBets['num_0'] ?? 0) > 0 && <BetChip val={myBets['num_0']} />}
          </div>

          {/* Row 3,6,9…36 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2px', minHeight: '30px' }}>
            {[3,6,9,12,15,18,21,24,27,30,33,36].map(n => (
              <NumCell key={n} num={n} bet={myBets[`num_${n}`]} onClick={() => onBet(`num_${n}`)} />
            ))}
          </div>
          <OutsideCell label="2:1" betKey="col_1" bet={myBets['col_1']} onClick={() => onBet('col_1')} />

          {/* Row 2,5,8…35 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2px', minHeight: '30px' }}>
            {[2,5,8,11,14,17,20,23,26,29,32,35].map(n => (
              <NumCell key={n} num={n} bet={myBets[`num_${n}`]} onClick={() => onBet(`num_${n}`)} />
            ))}
          </div>
          <OutsideCell label="2:1" betKey="col_2" bet={myBets['col_2']} onClick={() => onBet('col_2')} />

          {/* Row 1,4,7…34 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2px', minHeight: '30px' }}>
            {[1,4,7,10,13,16,19,22,25,28,31,34].map(n => (
              <NumCell key={n} num={n} bet={myBets[`num_${n}`]} onClick={() => onBet(`num_${n}`)} />
            ))}
          </div>
          <OutsideCell label="2:1" betKey="col_3" bet={myBets['col_3']} onClick={() => onBet('col_3')} />
        </div>

        {/* Dozens */}
        <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 1fr 1fr 30px', gap: '3px', marginBottom: '3px' }}>
          <div />
          {[{ label: '1st 12', key: 'doz_1' }, { label: '2nd 12', key: 'doz_2' }, { label: '3rd 12', key: 'doz_3' }].map(d => (
            <OutsideCell key={d.key} label={d.label} betKey={d.key} bet={myBets[d.key]} onClick={() => onBet(d.key)} />
          ))}
          <div />
        </div>

        {/* Outside bets */}
        <div style={{ display: 'grid', gridTemplateColumns: '30px repeat(6,1fr) 30px', gap: '2px' }}>
          <div />
          {[
            { label: '1-18',  key: '1-18',  bg: undefined,  color: undefined },
            { label: 'EVEN',  key: 'even',  bg: undefined,  color: undefined },
            { label: 'RED',   key: 'red',   bg: '#7F1D1D',  color: '#FFF' },
            { label: 'BLACK', key: 'black', bg: '#1C1917',  color: '#FFF' },
            { label: 'ODD',   key: 'odd',   bg: undefined,  color: undefined },
            { label: '19-36', key: '19-36', bg: undefined,  color: undefined },
          ].map(o => (
            <OutsideCell key={o.key} label={o.label} betKey={o.key} bet={myBets[o.key]} onClick={() => onBet(o.key)} bg={o.bg} color={o.color} />
          ))}
          <div />
        </div>
      </div>

      {/* ── Chips & Actions ── */}
      <div style={{ marginTop: 'auto', background: 'rgba(0,0,0,0.5)', borderTop: '1px solid rgba(245,158,11,0.15)', padding: '12px 12px 16px', backdropFilter: 'blur(20px)' }}>

        {/* Chip selector */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '12px' }}>
          {CHIP_VALUES.map(val => {
            const chip = CHIP_COLORS[val];
            const isActive = selectedChip === val;
            return (
              <motion.div
                key={val}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSelectedChip(val)}
                style={{
                  width: '42px', height: '42px', borderRadius: '50%',
                  background: isActive ? chip.bg : 'rgba(255,255,255,0.06)',
                  color: isActive ? chip.text : '#64748B',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: '900',
                  border: isActive ? `2px solid ${chip.border}` : '2px solid rgba(255,255,255,0.1)',
                  boxShadow: isActive ? `0 0 20px ${chip.glow}, 0 4px 12px rgba(0,0,0,0.4)` : '0 2px 4px rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                  transform: isActive ? 'scale(1.15)' : 'scale(1)',
                  transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
                  userSelect: 'none',
                }}
              >
                {val >= 1000 ? '1K' : val}
              </motion.div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={clearBets}
            disabled={status !== 'BETTING' || totalBet === 0}
            style={{
              flex: 1, padding: '14px',
              background: 'rgba(239,68,68,0.1)',
              color: status !== 'BETTING' || totalBet === 0 ? '#475569' : '#EF4444',
              border: `1px solid ${status !== 'BETTING' || totalBet === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(239,68,68,0.35)'}`,
              borderRadius: '12px', fontWeight: '900', fontSize: '13px',
              cursor: status !== 'BETTING' || totalBet === 0 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              transition: 'all 0.15s',
            }}
          >
            <RotateCcw size={14} /> CLEAR
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handlePlaceBet}
            disabled={status !== 'BETTING' || totalBet === 0 || isPlacing || betConfirmed}
            style={{
              flex: 3, padding: '14px',
              background: betConfirmed
                ? 'linear-gradient(135deg, #22C55E, #16A34A)'
                : (status !== 'BETTING' || totalBet === 0 || isPlacing)
                  ? 'rgba(255,255,255,0.05)'
                  : 'linear-gradient(135deg, #7C3AED, #A855F7)',
              color: betConfirmed
                ? '#fff'
                : (status !== 'BETTING' || totalBet === 0 || isPlacing) ? '#475569' : '#fff',
              border: 'none', borderRadius: '12px',
              fontWeight: '900', fontSize: '14px',
              cursor: status !== 'BETTING' || totalBet === 0 || isPlacing || betConfirmed ? 'not-allowed' : 'pointer',
              boxShadow: betConfirmed
                ? '0 4px 0 #15803D, 0 6px 20px rgba(34,197,94,0.4)'
                : (status !== 'BETTING' || totalBet === 0) ? 'none'
                : '0 4px 0 #4C1D95, 0 6px 20px rgba(124,58,237,0.4)',
              letterSpacing: '0.5px',
              transition: 'all 0.15s',
            }}
          >
            {betConfirmed
              ? `✅ BET PLACED • ${totalBet} ETB`
              : isPlacing
              ? 'PLACING...'
              : totalBet > 0 ? `PLACE BET • ${totalBet} ETB` : 'SELECT NUMBERS'}
          </motion.button>
        </div>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {(status === 'SPINNING' || isSpinning) && !showResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.92)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              zIndex: 9997, backdropFilter: 'blur(16px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', damping: 15 }}
              style={{ position: 'relative' }}
            >
              {/* Pointer */}
              <div style={{
                position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
                width: 0, height: 0,
                borderLeft: '14px solid transparent', borderRight: '14px solid transparent',
                borderTop: '28px solid #F59E0B',
                zIndex: 10, filter: 'drop-shadow(0 4px 12px rgba(245,158,11,0.8))',
              }} />
              {/* Outer glow ring */}
              <div style={{ borderRadius: '50%', padding: '6px', background: 'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)', boxShadow: '0 0 80px rgba(245,158,11,0.3), 0 0 160px rgba(245,158,11,0.1)' }}>
                <RouletteWheel rotation={wheelRotation} isSpinning={isSpinning} />
              </div>
            </motion.div>
            <motion.div
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              style={{ marginTop: '32px', fontSize: '20px', fontWeight: '900', color: '#F59E0B', letterSpacing: '6px', textShadow: '0 0 20px rgba(245,158,11,0.6)' }}
            >
              SPINNING...
            </motion.div>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748B', letterSpacing: '2px' }}>ሩሌቱ እየዞረ ነው</div>
          </motion.div>
        )}

        {showResult && currentResult !== null && (
          <ResultModal result={currentResult} winAmount={winAmount} onClose={() => setShowResult(false)} />
        )}
        {showHelp && <HowToPlayModal onClose={() => setShowHelp(false)} />}
      </AnimatePresence>

      <BunaModal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        onClose={() => setModal({ ...modal, isOpen: false })}
      />
    </div>
  );
}

export default function RoulettePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #0D1B0F 0%, #0F172A 100%)', color: '#F59E0B', fontSize: '18px', fontFamily: "'Inter',sans-serif", fontWeight: '900', gap: '12px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #F59E0B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        🎰 Loading Roulette...
      </div>
    }>
      <RouletteContent />
    </Suspense>
  );
}
