'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '../../../context/SocketContext';
import { useTheme } from '../../../context/ThemeContext';
import BunaModal from '../../../components/BunaModal';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Wallet as WalletIcon, X, HelpCircle } from 'lucide-react';
import { getMe } from '../../../lib/api';

const CHIP_VALUES = [5, 10, 50, 100, 500, 1000];

// European Roulette wheel order (0 is always green, sequence is standard)
const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const TOTAL = WHEEL_ORDER.length; // 37

// Ethiopian-flag inspired vibrant palette for the WHEEL segments
const ETH_PALETTE = [
  '#078930', // Ethiopian Green
  '#FCDD09', // Ethiopian Yellow
  '#DA121A', // Ethiopian Red
  '#7B2FBE', // Purple
  '#00897B', // Teal
  '#E65100', // Deep Orange
  '#0097A7', // Cyan
  '#C2185B', // Crimson
  '#1565C0', // Royal Blue
  '#6A1B9A', // Deep Purple
  '#F57F17', // Amber
  '#2E7D32', // Forest Green
];

function getSectorColor(index: number, num: number): string {
  if (num === 0) return '#078930';
  return ETH_PALETTE[index % ETH_PALETTE.length];
}

// ── SVG Roulette Wheel (image2 style) ───────────────────────────────────────
function RouletteWheel({ rotation, isSpinning }: { rotation: number; isSpinning: boolean }) {
  const SIZE = 300;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const outerR = 146;
  const innerR = 72;
  const textR  = 118;
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
    // Use dark text only on very bright yellows/ambers
    const lightColors = ['#FCDD09', '#F57F17'];
    const textFill = lightColors.includes(color) ? '#1a0a00' : '#FFFFFF';

    // separator dot
    const dx = px(outerR + 5, endA);
    const dy = py(outerR + 5, endA);

    return { d, tx, ty, rotateDeg, num, color, textFill, dx, dy };
  });

  return (
    <motion.div
      animate={{ rotate: rotation }}
      transition={{
        duration: isSpinning ? 8 : 0,
        ease: isSpinning ? [0.05, 0.3, 0.85, 1.0] : 'linear',
      }}
      style={{ width: SIZE, height: SIZE }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Outer decorative ring */}
        <circle cx={cx} cy={cy} r={outerR + 10} fill="#3D2B1F" stroke="#D4AF37" strokeWidth="3" />

        {/* Coloured segments */}
        {sectors.map(({ d, tx, ty, rotateDeg, num, color, textFill }, i) => (
          <g key={i}>
            <path d={d} fill={color} stroke="#3D2B1F" strokeWidth="1.2" />
            <text
              x={tx} y={ty}
              fill={textFill}
              fontSize="9.5"
              fontWeight="900"
              textAnchor="middle"
              dominantBaseline="central"
              transform={`rotate(${rotateDeg},${tx},${ty})`}
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              {num}
            </text>
          </g>
        ))}

        {/* Gold dots between segments on rim */}
        {sectors.map(({ dx, dy }, i) => (
          <circle key={`d${i}`} cx={dx} cy={dy} r="2.5" fill="#D4AF37" />
        ))}

        {/* Hub */}
        <circle cx={cx} cy={cy} r={innerR}      fill="#3D2B1F" stroke="#D4AF37" strokeWidth="3" />
        <circle cx={cx} cy={cy} r={innerR - 10} fill="#2C1A0E" stroke="#D4AF37" strokeWidth="1" />

        {/* Hub label */}
        <text x={cx} y={cy - 13} fill="#D4AF37" fontSize="12" fontWeight="900" textAnchor="middle" style={{ fontFamily: "'Outfit', sans-serif" }}>BUNA</text>
        <text x={cx} y={cy + 3}  fill="#D4AF37" fontSize="12" fontWeight="900" textAnchor="middle" style={{ fontFamily: "'Outfit', sans-serif" }}>BINGO</text>
        <text x={cx} y={cy + 17} fill="#FCDD09" fontSize="8.5" textAnchor="middle" style={{ fontFamily: "'Outfit', sans-serif" }}>ቡና ቢንጎ</text>

        {/* Centre dot */}
        <circle cx={cx} cy={cy + 28} r="4" fill="#D4AF37" />
      </svg>
    </motion.div>
  );
}

// ── Result Modal overlay (image1 style) ─────────────────────────────────────
function ResultModal({ result, winAmount, onClose }: { result: number; winAmount: number; onClose: () => void }) {
  const redNums = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  const ballColor = result === 0 ? '#078930' : redNums.includes(result) ? '#DA121A' : '#3D2B1F';
  const label     = result === 0 ? 'GREEN' : redNums.includes(result) ? 'RED' : 'BLACK';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(61,43,31,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, backdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1,   opacity: 1 }}
        exit={{ scale: 0.4,    opacity: 0 }}
        transition={{ type: 'spring', damping: 13 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: `linear-gradient(160deg, #3D2B1F 0%, #2C1A0E 100%)`,
          borderRadius: '24px',
          padding: '32px 44px',
          textAlign: 'center',
          border: '2px solid #D4AF37',
          boxShadow: '0 24px 72px rgba(0,0,0,0.8), inset 0 1px 0 rgba(212,175,55,0.25)',
          minWidth: '260px', maxWidth: '310px',
          position: 'relative',
        }}
      >
        {/* Close */}
        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', color: '#D4AF37', cursor: 'pointer' }}>
          <X size={20} />
        </button>

        <div style={{ fontSize: '12px', color: '#D4AF37', fontWeight: '700', letterSpacing: '3px', marginBottom: '18px' }}>RESULT:</div>

        {/* Number ball */}
        <div style={{
          width: '100px', height: '100px', borderRadius: '50%',
          background: ballColor,
          border: '4px solid #D4AF37',
          margin: '0 auto 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 36px ${ballColor}99, 0 8px 24px rgba(0,0,0,0.6)`,
        }}>
          <span style={{ color: 'white', fontSize: '46px', fontWeight: '900', lineHeight: 1 }}>{result}</span>
        </div>

        <div style={{ fontSize: '12px', color: '#D4AF37', fontWeight: '700', letterSpacing: '2px', marginBottom: '2px' }}>{label}</div>

        {/* Divider */}
        <div style={{ width: '60px', height: '2px', background: 'linear-gradient(90deg,transparent,#D4AF37,transparent)', margin: '12px auto 14px' }} />

        <div style={{ fontSize: '13px', color: '#D4AF3799', fontWeight: '600', marginBottom: '6px' }}>You win:</div>
        <div style={{
          fontSize: '40px', fontWeight: '900',
          color: winAmount > 0 ? '#4CAF50' : '#D4AF37',
          textShadow: winAmount > 0 ? '0 0 24px #4CAF5077' : 'none',
          lineHeight: 1,
        }}>
          {winAmount > 0 ? `+${winAmount.toFixed(2)}` : '0'}
        </div>
        <div style={{ fontSize: '14px', color: '#D4AF37', fontWeight: '700', marginTop: '4px' }}>ETB</div>

        {winAmount > 0 && (
          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: 3, duration: 0.45 }} style={{ fontSize: '28px', marginTop: '8px' }}>
            🎉
          </motion.div>
        )}

        <button onClick={onClose} style={{
          marginTop: '22px', padding: '12px 44px',
          background: 'linear-gradient(90deg, #D4AF37, #B8860B)',
          color: '#3D2B1F', border: 'none', borderRadius: '12px',
          fontWeight: '900', fontSize: '15px', cursor: 'pointer',
          boxShadow: '0 4px 0 #8B6B1D',
        }}>
          CONTINUE
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── How To Play Modal ───────────────────────────────────────────────────────
function HowToPlayModal({ onClose, gold, header }: { onClose: () => void; gold: string; header: string }) {
  const BET_ROWS = [
    { bet: 'Straight Up (ቀጥታ ቁጥር)', desc: 'Pick any single number 0–36', pay: '35:1 🔥', chance: '2.7%' },
    { bet: 'Red / Black (ቀይ / ጥቁር)',  desc: 'Ball color (0 loses)',        pay: '1:1',   chance: '48.6%' },
    { bet: 'Even / Odd (ዝቅ / ጎደሎ)',   desc: 'Even or odd (0 loses)',        pay: '1:1',   chance: '48.6%' },
    { bet: '1–18 / 19–36 (ዝቅ/ከፍ)',   desc: 'Low or high half (0 loses)',   pay: '1:1',   chance: '48.6%' },
    { bet: '1st/2nd/3rd 12 (አስራ ሁለቱ)', desc: 'One of three dozens',       pay: '2:1',   chance: '32.4%' },
    { bet: 'Column 2:1 (አምድ)',         desc: 'One of three columns',        pay: '2:1',   chance: '32.4%' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(61,43,31,0.88)', zIndex: 9998, backdropFilter: 'blur(6px)', overflowY: 'auto', padding: '20px 12px 40px' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0,  opacity: 1 }}
        exit={{ y: 60,    opacity: 0 }}
        transition={{ type: 'spring', damping: 18 }}
        onClick={e => e.stopPropagation()}
        style={{ background: `linear-gradient(160deg, ${header} 0%, #2C1A0E 100%)`, borderRadius: '24px', border: `2px solid ${gold}`, maxWidth: '420px', margin: '0 auto', overflow: 'hidden' }}
      >
        {/* Modal Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${gold}33`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: '900', color: gold, letterSpacing: '1px' }}>🎰 How to Play</div>
            <div style={{ fontSize: '11px', color: `${gold}88`, marginTop: '2px' }}>እንዴት መጫወት ይቻላል</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: gold, cursor: 'pointer' }}><X size={22} /></button>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Round flow */}
          <div style={{ background: `${gold}12`, borderRadius: '12px', padding: '14px', border: `1px solid ${gold}33` }}>
            <div style={{ fontSize: '11px', fontWeight: '900', color: gold, letterSpacing: '2px', marginBottom: '10px' }}>ROUND FLOW • ዙር ሂደት</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { icon: '⏳', label: 'BET', sub: '30s', color: '#27AE60' },
                { icon: '→', label: '', sub: '', color: gold },
                { icon: '🎰', label: 'SPIN', sub: '10s', color: gold },
                { icon: '→', label: '', sub: '', color: gold },
                { icon: '✅', label: 'PAYOUT', sub: '5s', color: '#078930' },
                { icon: '→', label: '', sub: '', color: gold },
                { icon: '🔄', label: 'REPEAT', sub: '', color: '#0097A7' },
              ].map((step, i) => step.label ? (
                <div key={i} style={{ textAlign: 'center', flex: '0 0 auto' }}>
                  <div style={{ fontSize: '18px' }}>{step.icon}</div>
                  <div style={{ fontSize: '8px', fontWeight: '900', color: step.color, letterSpacing: '0.5px' }}>{step.label}</div>
                  {step.sub && <div style={{ fontSize: '7px', color: `${gold}66` }}>{step.sub}</div>}
                </div>
              ) : (
                <div key={i} style={{ color: gold, fontSize: '14px', opacity: 0.4 }}>{step.icon}</div>
              ))}
            </div>
          </div>

          {/* Bet types table */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: '900', color: gold, letterSpacing: '2px', marginBottom: '8px' }}>BET TYPES & PAYOUTS • ዓይነቶችና ክፍያ</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {/* Header row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 50px', gap: '4px', padding: '4px 8px' }}>
                <div style={{ fontSize: '9px', color: `${gold}66`, fontWeight: '900', textTransform: 'uppercase' }}>BET</div>
                <div style={{ fontSize: '9px', color: `${gold}66`, fontWeight: '900', textAlign: 'center' }}>PAYOUT</div>
                <div style={{ fontSize: '9px', color: `${gold}66`, fontWeight: '900', textAlign: 'right' }}>ODDS</div>
              </div>
              {BET_ROWS.map((row, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 50px', gap: '4px', background: i % 2 === 0 ? `${gold}08` : 'transparent', padding: '8px', borderRadius: '6px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '900', color: '#F5E6BE' }}>{row.bet}</div>
                    <div style={{ fontSize: '9px', color: `${gold}77`, marginTop: '1px' }}>{row.desc}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: `${gold}22`, border: `1px solid ${gold}55`, borderRadius: '6px', padding: '3px 7px', fontSize: '11px', fontWeight: '900', color: gold, textAlign: 'center' }}>{row.pay}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: '10px', color: `${gold}88`, fontWeight: '700' }}>{row.chance}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Zero rule */}
          <div style={{ background: '#07893022', border: '1px solid #07893066', borderRadius: '10px', padding: '12px 14px', display: 'flex', gap: '10px' }}>
            <div style={{ fontSize: '24px', lineHeight: 1 }}>🟢</div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '900', color: '#4CAF50', marginBottom: '3px' }}>Zero Rule • ዜሮ ደንብ</div>
              <div style={{ fontSize: '10px', color: '#F5E6BE', lineHeight: 1.5 }}>
                When <strong style={{ color: '#4CAF50' }}>0</strong> lands, all outside bets (Red/Black, Even/Odd, High/Low, Dozens, Columns) <strong style={{ color: '#DA121A' }}>lose</strong>. Only a Straight Up on 0 wins at 35:1.
              </div>
              <div style={{ fontSize: '10px', color: `${gold}88`, marginTop: '4px' }}>0 ሲወድቅ የውጪ ሁሉም ጥቅሎች ያጣሉ</div>
            </div>
          </div>

          {/* Quick tips */}
          <div style={{ background: `${gold}10`, borderRadius: '10px', padding: '12px 14px', border: `1px solid ${gold}22` }}>
            <div style={{ fontSize: '11px', fontWeight: '900', color: gold, letterSpacing: '2px', marginBottom: '8px' }}>💡 QUICK TIPS • ጠቃሚ ምክሮች</div>
            {[
              { emoji: '🛡️', tip: 'Safe: Red/Black or Even/Odd — ~49% win chance' },
              { emoji: '⚖️', tip: 'Balanced: Dozen (2:1) + one outside bet' },
              { emoji: '🔥', tip: 'Big win: Straight Up pays 35:1 (low chance)' },
              { emoji: '💰', tip: 'Bonus balance is used first automatically' },
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '6px' }}>
                <span style={{ fontSize: '14px' }}>{t.emoji}</span>
                <span style={{ fontSize: '10px', color: '#F5E6BE', lineHeight: 1.5 }}>{t.tip}</span>
              </div>
            ))}
          </div>

          {/* Close button */}
          <button onClick={onClose} style={{ padding: '14px', background: `linear-gradient(90deg, ${gold}, #B8860B)`, color: '#3D2B1F', border: 'none', borderRadius: '12px', fontWeight: '900', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 0 #8B6B1D' }}>
            Got it! ገባኝ ✓
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Chip bubble badge ────────────────────────────────────────────────────────
function Chip({ val, small }: { val: number; small?: boolean }) {
  const s = small ? 14 : 18;
  return (
    <div style={{
      position: 'absolute', top: '-6px', right: '-6px',
      background: '#D4AF37', color: '#3D2B1F', borderRadius: '50%',
      width: s, height: s, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: small ? '6px' : '7px', fontWeight: '900', zIndex: 10,
      border: '1px solid #3D2B1F', boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
      pointerEvents: 'none',
    }}>
      {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
    </div>
  );
}

// ── Number cell (betting board) ──────────────────────────────────────────────
function NumCell({ num, bet, onClick, gold, header }: { num: number; bet?: number; onClick: () => void; gold: string; header: string }) {
  const red = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  const bg = num === 0 ? '#078930' : red.includes(num) ? '#C0392B' : header;
  const border = num === 0 ? '#27AE60' : `${gold}55`;
  return (
    <div onClick={onClick}
      style={{ background: bg, color: '#F5E6BE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '900', borderRadius: '3px', position: 'relative', cursor: 'pointer', border: `1px solid ${border}`, minHeight: '28px', userSelect: 'none' }}>
      {num}
      {(bet ?? 0) > 0 && <Chip val={bet!} small />}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
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

  const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });
  const [showHelp, setShowHelp] = useState(false);

  // Refresh balance
  const refreshBalance = () =>
    getMe().then(u => {
      if (u?.wallet) { setBalance(Number(u.wallet.balance)); setBonusBalance(Number(u.wallet.bonusBalance)); }
    }).catch(console.error);

  useEffect(() => { refreshBalance(); }, []);

  // Compute rotation that lands the wheel on the result
  const computeRotation = (resultNum: number) => {
    const idx = WHEEL_ORDER.indexOf(resultNum);
    const degPerSlot = 360 / TOTAL;
    const targetOffset = idx * degPerSlot + degPerSlot / 2;
    const next = accumulated.current + (360 * 6) + (360 - targetOffset % 360);
    accumulated.current = next;
    return next;
  };

  // Sockets
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

    socket.on('roulette-tick', (d: any) => {
      setStatus(d.status);
      setSecondsRemaining(d.secondsRemaining);
    });

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
      setTimeout(() => {
        setIsSpinning(false);
        setShowResult(true);
        refreshBalance();
      }, 8500);
    });

    socket.on('roulette-bet-success', () => setBetConfirmed(true));
    socket.on('roulette-bet-error',   (d: any) => {
      setIsPlacing(false);
      setModal({ isOpen: true, title: 'Bet Failed', message: d.message || 'Could not place bet.' });
    });

    return () => {
      socket.off('roulette-state');
      socket.off('roulette-tick');
      socket.off('roulette-spinning');
      socket.off('roulette-result');
      socket.off('roulette-bet-success');
      socket.off('roulette-bet-error');
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
    setMyBets(prev => ({ ...prev, [key]: (prev[key] || 0) + selectedChip }));
    setTotalBet(prev => prev + selectedChip);
  };

  const clearBets = () => { setMyBets({}); setTotalBet(0); };

  const timerPct = status === 'BETTING' ? (secondsRemaining / 30) * 100 : 0;
  const timerCol = timerPct > 60 ? '#27AE60' : timerPct > 25 ? '#D4AF37' : '#C0392B';

  // RED/BLACK helper for history bubbles
  const redNums = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  const numColor = (n: number) => n === 0 ? '#078930' : redNums.includes(n) ? '#C0392B' : T.header;

  return (
    <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Outfit', sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ background: T.header, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${T.gold}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => router.push('/')}>
          <ArrowLeft size={22} color={T.gold} />
          <div style={{ fontSize: '19px', fontWeight: '900', color: T.gold, letterSpacing: '1.5px' }}>
            ROULETTE <span style={{ color: '#FCDD09', fontSize: '11px', fontWeight: '700' }}>ሩሌት</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => setShowHelp(true)} style={{ background: 'none', border: 'none', color: T.gold, cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="How to Play">
            <HelpCircle size={22} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: `${T.gold}18`, border: `1px solid ${T.gold}44`, borderRadius: '20px', padding: '5px 12px', color: '#4CAF50', fontSize: '13px', fontWeight: '900' }}>
            <WalletIcon size={14} /> {(balance + bonusBalance).toFixed(2)}
          </div>
        </div>
      </div>

      {/* ── Timer progress bar ── */}
      <div style={{ height: '4px', background: T.border }}>
        <motion.div
          animate={{ width: `${timerPct}%` }}
          transition={{ duration: 0.9, ease: 'linear' }}
          style={{ height: '100%', background: timerCol, borderRadius: '0 2px 2px 0', transition: 'background 0.5s' }}
        />
      </div>

      {/* ── Status row ── */}
      <div style={{ padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.statBg, borderBottom: `1px solid ${T.gold}22` }}>
        <div style={{ fontSize: '12px', fontWeight: '900', color: status === 'BETTING' ? '#27AE60' : status === 'SPINNING' ? T.gold : T.gold, letterSpacing: '0.5px' }}>
          {status === 'BETTING'  && `⏳ Place bets • ${secondsRemaining}s`}
          {status === 'SPINNING' && '🎰 Spinning...'}
          {status === 'PAYOUT'   && `✅ Result: ${currentResult}`}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {history.slice(0, 6).map((n, i) => (
            <div key={i} style={{ width: '21px', height: '21px', borderRadius: '50%', background: numColor(n), color: '#F5E6BE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '900', border: `1px solid ${T.gold}55` }}>
              {n}
            </div>
          ))}
        </div>
      </div>

      {/* ── Wheel area ── */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '14px 0 8px', position: 'relative', background: T.bg }}>
        {/* Fixed pointer */}
        <div style={{
          position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)',
          width: 0, height: 0,
          borderLeft: '13px solid transparent', borderRight: '13px solid transparent',
          borderTop: `26px solid ${T.gold}`,
          zIndex: 10, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
        }} />
        <div style={{ borderRadius: '50%', boxShadow: `0 0 50px ${T.gold}33, 0 16px 48px rgba(0,0,0,0.35)` }}>
          <RouletteWheel rotation={wheelRotation} isSpinning={isSpinning} />
        </div>
      </div>

      {/* ── Betting Board ── */}
      <div style={{ flex: 1, padding: '10px 8px 6px', background: T.header, borderTopLeftRadius: '20px', borderTopRightRadius: '20px', boxShadow: `0 -6px 24px rgba(0,0,0,0.3)` }}>

        {/* Numbers: 0 | 3×12 grid | 2:1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 28px', gap: '3px', marginBottom: '3px' }}>

          {/* 0 — spans all 3 number rows */}
          <div onClick={() => onBet('num_0')}
            style={{ background: '#078930', color: '#F5E6BE', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', fontWeight: '900', fontSize: '14px', position: 'relative', cursor: 'pointer', border: `1px solid ${T.gold}55`, gridRow: '1/4', userSelect: 'none' }}>
            0 {myBets['num_0'] > 0 && <Chip val={myBets['num_0']} />}
          </div>

          {/* Row 3,6,9…36 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2px', minHeight: '26px' }}>
            {[3,6,9,12,15,18,21,24,27,30,33,36].map(n => (
              <NumCell key={n} num={n} bet={myBets[`num_${n}`]} onClick={() => onBet(`num_${n}`)} gold={T.gold} header={T.header} />
            ))}
          </div>

          {/* Col 1 */}
          <div onClick={() => onBet('col_1')}
            style={{ background: `${T.gold}22`, border: `1px solid ${T.gold}`, color: T.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '900', borderRadius: '3px', cursor: 'pointer', position: 'relative', userSelect: 'none' }}>
            2:1 {myBets['col_1'] > 0 && <Chip val={myBets['col_1']} small />}
          </div>

          {/* Row 2,5,8…35 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2px', minHeight: '26px' }}>
            {[2,5,8,11,14,17,20,23,26,29,32,35].map(n => (
              <NumCell key={n} num={n} bet={myBets[`num_${n}`]} onClick={() => onBet(`num_${n}`)} gold={T.gold} header={T.header} />
            ))}
          </div>

          {/* Col 2 */}
          <div onClick={() => onBet('col_2')}
            style={{ background: `${T.gold}22`, border: `1px solid ${T.gold}`, color: T.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '900', borderRadius: '3px', cursor: 'pointer', position: 'relative', userSelect: 'none' }}>
            2:1 {myBets['col_2'] > 0 && <Chip val={myBets['col_2']} small />}
          </div>

          {/* Row 1,4,7…34 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2px', minHeight: '26px' }}>
            {[1,4,7,10,13,16,19,22,25,28,31,34].map(n => (
              <NumCell key={n} num={n} bet={myBets[`num_${n}`]} onClick={() => onBet(`num_${n}`)} gold={T.gold} header={T.header} />
            ))}
          </div>

          {/* Col 3 */}
          <div onClick={() => onBet('col_3')}
            style={{ background: `${T.gold}22`, border: `1px solid ${T.gold}`, color: T.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '900', borderRadius: '3px', cursor: 'pointer', position: 'relative', userSelect: 'none' }}>
            2:1 {myBets['col_3'] > 0 && <Chip val={myBets['col_3']} small />}
          </div>
        </div>

        {/* Dozens */}
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 1fr 28px', gap: '3px', marginBottom: '3px' }}>
          <div />
          {[
            { label: '1st 12', key: 'doz_1' },
            { label: '2nd 12', key: 'doz_2' },
            { label: '3rd 12', key: 'doz_3' },
          ].map(d => (
            <div key={d.key} onClick={() => onBet(d.key)}
              style={{ background: `${T.gold}18`, border: `1px solid ${T.gold}`, color: T.gold, padding: '7px 0', textAlign: 'center', fontSize: '10px', fontWeight: '900', borderRadius: '3px', cursor: 'pointer', position: 'relative', userSelect: 'none' }}>
              {d.label}
              {myBets[d.key] > 0 && <Chip val={myBets[d.key]} small />}
            </div>
          ))}
          <div />
        </div>

        {/* Outside bets */}
        <div style={{ display: 'grid', gridTemplateColumns: '28px repeat(6,1fr) 28px', gap: '2px' }}>
          <div />
          {[
            { label: '1-18',  key: '1-18',  bg: `${T.gold}18` },
            { label: 'EVEN',  key: 'even',  bg: `${T.gold}18` },
            { label: 'RED',   key: 'red',   bg: '#C0392B' },
            { label: 'BLACK', key: 'black', bg: T.header },
            { label: 'ODD',   key: 'odd',   bg: `${T.gold}18` },
            { label: '19-36', key: '19-36', bg: `${T.gold}18` },
          ].map(o => (
            <div key={o.key} onClick={() => onBet(o.key)}
              style={{ background: o.bg, border: `1px solid ${T.gold}`, color: ['red','black'].includes(o.key) ? '#F5E6BE' : T.gold, padding: '8px 0', textAlign: 'center', fontSize: '9px', fontWeight: '900', borderRadius: '3px', cursor: 'pointer', position: 'relative', userSelect: 'none' }}>
              {o.label}
              {myBets[o.key] > 0 && <Chip val={myBets[o.key]} small />}
            </div>
          ))}
          <div />
        </div>
      </div>

      {/* ── Chips & Actions ── */}
      <div style={{ background: T.header, padding: '12px 10px 16px', borderTop: `1px solid ${T.gold}22` }}>

        {/* Chip selector */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
          {CHIP_VALUES.map(val => (
            <div key={val} onClick={() => setSelectedChip(val)}
              style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: selectedChip === val
                  ? `linear-gradient(135deg, ${T.gold}, ${T.goldDk})`
                  : `${T.gold}22`,
                color: selectedChip === val ? T.header : T.gold,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: '900',
                border: `2px solid ${selectedChip === val ? T.gold : `${T.gold}44`}`,
                boxShadow: selectedChip === val ? `0 0 12px ${T.gold}88` : 'none',
                cursor: 'pointer',
                transform: selectedChip === val ? 'scale(1.12)' : 'scale(1)',
                transition: 'all 0.15s',
                userSelect: 'none',
              }}>
              {val >= 1000 ? '1K' : val}
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={clearBets}
            disabled={status !== 'BETTING' || totalBet === 0}
            style={{ flex: 1, padding: '13px', background: 'transparent', color: T.gold, border: `2px solid ${T.gold}`, borderRadius: '10px', fontWeight: '900', fontSize: '13px', cursor: 'pointer', opacity: status !== 'BETTING' || totalBet === 0 ? 0.35 : 1 }}>
            CLEAR
          </button>
          <button onClick={handlePlaceBet}
            disabled={status !== 'BETTING' || totalBet === 0 || isPlacing || betConfirmed}
            style={{
              flex: 3, padding: '13px',
              background: betConfirmed
                ? '#27AE60'
                : `linear-gradient(90deg, ${T.gold}, ${T.goldDk})`,
              color: betConfirmed ? 'white' : T.header,
              border: 'none', borderRadius: '10px', fontWeight: '900', fontSize: '13px',
              cursor: 'pointer',
              opacity: status !== 'BETTING' || totalBet === 0 || isPlacing ? 0.45 : 1,
              boxShadow: betConfirmed ? '0 3px 0 #1a5e20' : `0 3px 0 ${T.goldDk}`,
            }}>
            {betConfirmed
              ? `✅ BET PLACED (${totalBet} ETB)`
              : isPlacing
              ? 'PLACING...'
              : `PLACE BET • ${totalBet} ETB`}
          </button>
        </div>
      </div>

      {/* Result overlay */}
      <AnimatePresence>
        {showResult && currentResult !== null && (
          <ResultModal result={currentResult} winAmount={winAmount} onClose={() => setShowResult(false)} />
        )}
        {showHelp && (
          <HowToPlayModal onClose={() => setShowHelp(false)} gold={T.gold} header={T.header} />
        )}
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5E6BE', color: '#3D2B1F', fontSize: '18px', fontFamily: "'Outfit',sans-serif", fontWeight: '900' }}>
        🎰 Loading Roulette...
      </div>
    }>
      <RouletteContent />
    </Suspense>
  );
}
