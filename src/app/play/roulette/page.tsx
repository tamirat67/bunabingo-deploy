'use client';
import { useEffect, useState, useRef, Suspense, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '../../../context/SocketContext';
import { useTheme } from '../../../context/ThemeContext';
import BunaModal from '../../../components/BunaModal';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Wallet as WalletIcon } from 'lucide-react';
import { getMe } from '../../../lib/api';

const CHIP_VALUES = [5, 10, 50, 100, 500, 1000];

function RouletteContent() {
  const router = useRouter();
  const { T } = useTheme();
  const { socket, isConnected } = useSocket();

  const [balance, setBalance] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  
  // Game State
  const [status, setStatus] = useState<'BETTING' | 'SPINNING' | 'PAYOUT'>('BETTING');
  const [secondsRemaining, setSecondsRemaining] = useState(30);
  const [history, setHistory] = useState<number[]>([]);
  const [currentResult, setCurrentResult] = useState<number | null>(null);
  
  // Betting State
  const [selectedChip, setSelectedChip] = useState(10);
  const [myBets, setMyBets] = useState<Record<string, number>>({}); // betKey -> total amount
  const [totalBetAmount, setTotalBetAmount] = useState(0);
  const [isPlacingBet, setIsPlacingBet] = useState(false);

  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '' });

  // Load balance
  useEffect(() => {
    getMe().then(user => {
      if (user?.wallet) {
        setBalance(Number(user.wallet.balance));
        setBonusBalance(Number(user.wallet.bonusBalance));
      }
    }).catch(console.error);
  }, []);

  // Socket Integration
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit('join-roulette');

    socket.on('roulette-state', (state: any) => {
      setStatus(state.status);
      setSecondsRemaining(state.secondsRemaining);
      setHistory(state.history);
      setCurrentResult(state.currentResult);
      if (state.status === 'BETTING' && state.secondsRemaining > 28) {
         setMyBets({}); // Clear local bets on new round
         setTotalBetAmount(0);
      }
    });

    socket.on('roulette-tick', (data: any) => {
      setStatus(data.status);
      setSecondsRemaining(data.secondsRemaining);
    });

    socket.on('roulette-spinning', (data: any) => {
      setStatus('SPINNING');
      setCurrentResult(data.result);
      setSecondsRemaining(data.secondsRemaining);
    });

    socket.on('roulette-result', (data: any) => {
      setStatus('PAYOUT');
      setCurrentResult(data.result);
      setHistory(data.history);
      setSecondsRemaining(data.secondsRemaining);
    });

    socket.on('roulette-win-123', () => {}); // Fallback, handled dynamically below

    // We only attach dynamic listeners if we know the user ID, but we can just rely on balance update
    // Actually, let's refresh balance when round ends
    return () => {
      socket.off('roulette-state');
      socket.off('roulette-tick');
      socket.off('roulette-spinning');
      socket.off('roulette-result');
      socket.emit('leave-roulette');
    };
  }, [socket, isConnected]);

  // Refresh balance at start of betting
  useEffect(() => {
    if (status === 'BETTING' && secondsRemaining === 30) {
      getMe().then(user => {
        if (user?.wallet) {
          setBalance(Number(user.wallet.balance));
          setBonusBalance(Number(user.wallet.bonusBalance));
        }
      }).catch(console.error);
    }
  }, [status, secondsRemaining]);

  const handlePlaceBet = async () => {
    if (totalBetAmount <= 0) return;
    if (!socket || !isConnected) {
      setModalConfig({ isOpen: true, title: 'Error', message: 'You are disconnected.' });
      return;
    }
    
    setIsPlacingBet(true);
    let successCount = 0;
    
    // We send each bet to the server
    for (const [key, amount] of Object.entries(myBets)) {
      if (amount <= 0) continue;
      
      let betType = '';
      let betValue = '';
      
      if (key.startsWith('num_')) {
        betType = 'STRAIGHT';
        betValue = key.replace('num_', '');
      } else if (key.startsWith('col_')) {
        betType = 'COLUMN';
        betValue = key.replace('col_', '').toUpperCase() + 'ST'; // Quick map: 1 -> 1ST, 2 -> 2ND, 3 -> 3RD
        if (key === 'col_2') betValue = '2ND';
        if (key === 'col_3') betValue = '3RD';
      } else if (key.startsWith('doz_')) {
        betType = 'DOZEN';
        betValue = key.replace('doz_', '').toUpperCase() + 'ST';
        if (key === 'doz_2') betValue = '2ND';
        if (key === 'doz_3') betValue = '3RD';
      } else {
        betType = ['RED', 'BLACK'].includes(key.toUpperCase()) ? 'COLOR' :
                  ['EVEN', 'ODD'].includes(key.toUpperCase()) ? 'EVEN_ODD' : 'HIGH_LOW';
        betValue = key.toUpperCase();
      }

      socket.emit('roulette-place-bet', { amount, betType, betValue });
      successCount++;
    }
    
    // Optimistically update balance
    setBalance(prev => Math.max(0, prev - totalBetAmount));
    
    setTimeout(() => {
      setIsPlacingBet(false);
      setModalConfig({ isOpen: true, title: 'Bets Placed', message: `Successfully placed ${totalBetAmount} ETB in bets.` });
    }, 500);
  };

  const onBoardClick = (key: string) => {
    if (status !== 'BETTING') return;
    setMyBets(prev => ({ ...prev, [key]: (prev[key] || 0) + selectedChip }));
    setTotalBetAmount(prev => prev + selectedChip);
  };

  const handleClear = () => {
    setMyBets({});
    setTotalBetAmount(0);
  };

  // UI Helpers
  const getNumberColor = (num: number) => {
    if (num === 0) return '#27AE60'; // Green
    const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    return redNumbers.includes(num) ? '#E74C3C' : '#2C3E50'; // Red : Black
  };

  // Wheel animation degrees
  const getWheelRotation = () => {
    if (status === 'BETTING') return 0;
    if (currentResult === null) return 0;
    
    // Order of numbers on a European Roulette wheel
    const wheelOrder = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
    const index = wheelOrder.indexOf(currentResult);
    const degreePerSlot = 360 / 37;
    // Base spin (e.g. 5 full rotations) + offset to land on the target
    const targetDegree = (360 * 5) - (index * degreePerSlot);
    return targetDegree;
  };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Outfit', sans-serif" }}>
      
      {/* ── Header ── */}
      <div style={{ background: T.header, padding: '12px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${T.gold}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => router.push('/')}>
          <ArrowLeft size={24} color={T.gold} />
          <div style={{ fontSize: '20px', fontWeight: '900', color: T.gold, letterSpacing: '1px' }}>ROULETTE</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#4CAF50', fontSize: '14px', fontWeight: '900' }}>
          <WalletIcon size={16} /> {(balance + bonusBalance).toFixed(2)}
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div style={{ padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: '16px', fontWeight: '900', color: T.header }}>
          {status === 'BETTING' && `Betting closes in: ${secondsRemaining}s`}
          {status === 'SPINNING' && 'Spinning...'}
          {status === 'PAYOUT' && `Result: ${currentResult}`}
        </div>
        <div style={{ display: 'flex', gap: '5px' }}>
          {history.slice(0, 5).map((num, i) => (
            <div key={i} style={{ width: '20px', height: '20px', borderRadius: '50%', background: getNumberColor(num), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
              {num}
            </div>
          ))}
        </div>
      </div>

      {/* ── Wheel Area ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
         <motion.div 
            animate={{ rotate: getWheelRotation() }}
            transition={{ duration: status === 'SPINNING' ? 8 : 0, ease: "circOut" }}
            style={{ width: '200px', height: '200px', borderRadius: '50%', background: 'conic-gradient(from 0deg, #27AE60 0 9.7deg, #E74C3C 9.7deg 19.4deg, #2C3E50 19.4deg 29.1deg, #E74C3C 29.1deg 38.8deg, #2C3E50 38.8deg 48.5deg, #E74C3C 48.5deg 58.2deg, #2C3E50 58.2deg 67.9deg, #E74C3C 67.9deg 77.6deg, #2C3E50 77.6deg 87.3deg, #E74C3C 87.3deg 97.0deg, #2C3E50 97.0deg 106.7deg, #E74C3C 106.7deg 116.4deg, #2C3E50 116.4deg 126.1deg, #E74C3C 126.1deg 135.8deg, #2C3E50 135.8deg 145.5deg, #E74C3C 145.5deg 155.2deg, #2C3E50 155.2deg 164.9deg, #E74C3C 164.9deg 174.6deg, #2C3E50 174.6deg 184.3deg, #E74C3C 184.3deg 194.0deg, #2C3E50 194.0deg 203.7deg, #E74C3C 203.7deg 213.4deg, #2C3E50 213.4deg 223.1deg, #E74C3C 223.1deg 232.8deg, #2C3E50 232.8deg 242.5deg, #E74C3C 242.5deg 252.2deg, #2C3E50 252.2deg 261.9deg, #E74C3C 261.9deg 271.6deg, #2C3E50 271.6deg 281.3deg, #E74C3C 281.3deg 291.0deg, #2C3E50 291.0deg 300.7deg, #E74C3C 300.7deg 310.4deg, #2C3E50 310.4deg 320.1deg, #E74C3C 320.1deg 329.8deg, #2C3E50 329.8deg 339.5deg, #E74C3C 339.5deg 349.2deg, #2C3E50 349.2deg 360deg)', border: `8px solid ${T.header}`, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
         >
            <div style={{ width: '140px', height: '140px', borderRadius: '50%', background: T.header, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.gold, fontSize: '40px', fontWeight: '900' }}>
               {status === 'PAYOUT' && currentResult !== null ? currentResult : '?'}
            </div>
         </motion.div>
         {/* The pointer indicating the result */}
         <div style={{ position: 'absolute', top: '10px', width: 0, height: 0, borderLeft: '15px solid transparent', borderRight: '15px solid transparent', borderTop: `25px solid ${T.gold}` }} />
      </div>

      {/* ── Betting Board ── */}
      <div style={{ padding: '10px', background: T.header, borderTopLeftRadius: '20px', borderTopRightRadius: '20px', boxShadow: '0 -5px 20px rgba(0,0,0,0.3)' }}>
         <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 40px', gap: '5px' }}>
            
            {/* 0 */}
            <div onClick={() => onBoardClick('num_0')} style={{ background: '#27AE60', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', fontWeight: '900', position: 'relative', minHeight: '120px' }}>
              0
              {myBets['num_0'] && <div style={{ position: 'absolute', background: 'white', color: 'black', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', zIndex: 10 }}>{myBets['num_0']}</div>}
            </div>

            {/* Numbers 1-36 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gridAutoFlow: 'row dense', gap: '2px' }}>
               {[...Array(36)].map((_, i) => {
                 const num = i + 1;
                 const key = `num_${num}`;
                 return (
                   <div key={key} onClick={() => onBoardClick(key)} style={{ background: getNumberColor(num), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '900', padding: '10px 0', borderRadius: '2px', position: 'relative', cursor: 'pointer' }}>
                     {num}
                     {myBets[key] && <div style={{ position: 'absolute', background: 'white', color: 'black', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', zIndex: 10 }}>{myBets[key]}</div>}
                   </div>
                 );
               })}
            </div>

            {/* 2:1 Columns */}
            <div style={{ display: 'grid', gridTemplateRows: 'repeat(3, 1fr)', gap: '2px' }}>
               {['1', '2', '3'].map((col) => {
                 const key = `col_${col}`;
                 return (
                   <div key={key} onClick={() => onBoardClick(key)} style={{ border: `1px solid ${T.gold}`, color: T.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', position: 'relative', cursor: 'pointer' }}>
                     2:1
                     {myBets[key] && <div style={{ position: 'absolute', background: 'white', color: 'black', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', zIndex: 10 }}>{myBets[key]}</div>}
                   </div>
                 );
               })}
            </div>
         </div>

         {/* Dozens */}
         <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 40px', gap: '5px', marginTop: '5px' }}>
            <div />
            {['1', '2', '3'].map((doz) => {
               const key = `doz_${doz}`;
               return (
                 <div key={key} onClick={() => onBoardClick(key)} style={{ border: `1px solid ${T.gold}`, color: T.gold, padding: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold', position: 'relative', cursor: 'pointer' }}>
                   {doz}st 12
                   {myBets[key] && <div style={{ position: 'absolute', background: 'white', color: 'black', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', zIndex: 10, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>{myBets[key]}</div>}
                 </div>
               );
            })}
            <div />
         </div>

         {/* Outside Bets */}
         <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 1fr 1fr 1fr 40px', gap: '2px', marginTop: '5px' }}>
            <div />
            {['1-18', 'EVEN', 'RED', 'BLACK', 'ODD', '19-36'].map((out) => {
               const key = out.toLowerCase();
               return (
                 <div key={key} onClick={() => onBoardClick(key)} style={{ background: out === 'RED' ? '#E74C3C' : out === 'BLACK' ? '#2C3E50' : 'transparent', border: `1px solid ${T.gold}`, color: ['RED','BLACK'].includes(out) ? 'white' : T.gold, padding: '10px 0', textAlign: 'center', fontSize: '10px', fontWeight: 'bold', position: 'relative', cursor: 'pointer' }}>
                   {out}
                   {myBets[key] && <div style={{ position: 'absolute', background: 'white', color: 'black', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', zIndex: 10, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>{myBets[key]}</div>}
                 </div>
               );
            })}
            <div />
         </div>

      </div>

      {/* ── Chips & Actions ── */}
      <div style={{ background: '#2C1E16', padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
         
         <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            {CHIP_VALUES.map((val) => (
               <div 
                 key={val} 
                 onClick={() => setSelectedChip(val)}
                 style={{ 
                   width: '40px', height: '40px', 
                   borderRadius: '50%', 
                   background: selectedChip === val ? 'linear-gradient(135deg, #F39C12, #D35400)' : 'linear-gradient(135deg, #7F8C8D, #34495E)',
                   color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                   fontSize: '12px', fontWeight: '900', border: `2px solid ${selectedChip === val ? '#FFF' : '#BDC3C7'}`,
                   boxShadow: selectedChip === val ? '0 0 10px #F39C12' : 'none',
                   cursor: 'pointer', transform: selectedChip === val ? 'scale(1.1)' : 'scale(1)', transition: '0.2s'
                 }}>
                  {val}
               </div>
            ))}
         </div>

         <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
            <button onClick={handleClear} disabled={status !== 'BETTING' || totalBetAmount === 0} style={{ flex: 1, padding: '12px', background: '#E74C3C', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '900', opacity: status !== 'BETTING' || totalBetAmount === 0 ? 0.5 : 1 }}>
               CLEAR
            </button>
            <button onClick={handlePlaceBet} disabled={status !== 'BETTING' || totalBetAmount === 0 || isPlacingBet} style={{ flex: 2, padding: '12px', background: '#27AE60', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '900', opacity: status !== 'BETTING' || totalBetAmount === 0 || isPlacingBet ? 0.5 : 1 }}>
               {isPlacingBet ? 'PLACING...' : `PLACE BET (${totalBetAmount} ETB)`}
            </button>
         </div>

      </div>

      <BunaModal 
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
      />
    </div>
  );
}

export default function RoulettePage() {
  return (
    <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: '#D4AF37' }}>Loading...</div>}>
      <RouletteContent />
    </Suspense>
  );
}
