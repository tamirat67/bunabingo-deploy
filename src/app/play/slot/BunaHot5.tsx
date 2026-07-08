'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { Loader2, Wallet } from 'lucide-react';
import { getMe } from '../../../lib/api';

import SplashScreen from './components/SplashScreen';
import ReelGrid from './components/ReelGrid';
import MultiplierReel from './components/MultiplierReel';
import BetControls from './components/BetControls';
import AutoplayPanel from './components/AutoplayPanel';
import GambleModal from './components/GambleModal';
import WinBanner from './components/WinBanner';

import { useTelegramHaptics } from './hooks/useTelegramHaptics';
import { useSlotSpin, useSlotConfig, useSlotHistory } from './hooks/useSlotSpin';
import { useGambleFlow } from './hooks/useGambleFlow';

import { SpinPhase, SlotSymbol, WinTier, SpinResult } from './types';

export default function BunaHot5() {
  const router = useRouter();
  const haptic = useTelegramHaptics();

  const { config, fetchConfig, loading: configLoading } = useSlotConfig();
  const { history, fetchHistory } = useSlotHistory();
  const { doSpin, loading: spinLoading, error: spinError, clearError } = useSlotSpin();
  const gambleFlow = useGambleFlow();

  const [phase, setPhase] = useState<SpinPhase>('IDLE');
  const [balance, setBalance] = useState<number>(0);
  const [bet, setBet] = useState<number>(10);
  const [splashDone, setSplashDone] = useState(false);

  // Result state
  const [grid, setGrid] = useState<SlotSymbol[][]>([
    ['CHERRY', 'CHERRY', 'CHERRY'],
    ['CHERRY', 'CHERRY', 'CHERRY'],
    ['CHERRY', 'CHERRY', 'CHERRY']
  ]);
  const [multiplier, setMultiplier] = useState(1);
  const [lineWins, setLineWins] = useState<any[]>([]);
  const [winAmount, setWinAmount] = useState(0);
  const [winTier, setWinTier] = useState<WinTier>('NONE');

  // Animation state
  const [reelStopped, setReelStopped] = useState([true, true, true]);
  const [multStopped, setMultStopped] = useState(true);

  // Autoplay state
  const [autoActive, setAutoActive] = useState(false);
  const [autoPanelOpen, setAutoPanelOpen] = useState(false);
  const autoSpinsLeft = useRef(0);
  const autoStopWin = useRef(0);
  const autoStopLoss = useRef(0);
  const startBalance = useRef(0);

  // Load config & init Telegram & fetch balance
  useEffect(() => {
    fetchConfig();
    getMe().then(me => {
      if (me?.wallet?.balance !== undefined) {
        setBalance(Number(me.wallet.balance));
      }
    }).catch(() => {});
    
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
        tg.enableClosingConfirmation();
      }
    } catch {}
  }, [fetchConfig]);

  // Set initial bet once config loads
  useEffect(() => {
    if (config && bet < config.minBet) setBet(config.minBet);
  }, [config, bet]);

  // Socket for balance updates
  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      const user = tg?.initDataUnsafe?.user;
      if (!user?.id) return;

      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || '';
      const socket = io(socketUrl, { path: '/socket.io', transports: ['websocket'] });

      socket.on('connect', () => {
        socket.emit('authenticate', { userId: user.id.toString() });
      });

      socket.on('balance-updated', (data: any) => {
        if (data && data.newBalance !== undefined) {
          setBalance(Number(data.newBalance));
        }
      });

      return () => { socket.disconnect(); };
    } catch {}
  }, []);

  // Track current spin ID for gamble/collect
  const currentSpinId = useRef<string>('');

  const handleSpin = async () => {
    if (phase !== 'IDLE' || spinLoading || !config) return;

    clearError();
    haptic('spin');
    setPhase('SPINNING');
    setReelStopped([false, false, false]);
    setMultStopped(false);
    setLineWins([]);
    setWinTier('NONE');
    setWinAmount(0);

    const result = await doSpin(bet);
    if (!result) {
      // Error
      haptic('error');
      setPhase('IDLE');
      setReelStopped([true, true, true]);
      setMultStopped(true);
      if (autoActive) setAutoActive(false);
      return;
    }

    currentSpinId.current = result.spinId;

    // ✅ Immediately update balance from spin response (deduct bet)
    if (result.newBalance !== undefined) {
      setBalance(Number(result.newBalance));
    }

    // Sequence the reveal
    setGrid(result.reelResult);
    setMultiplier(result.multiplierResult);
    setLineWins(result.lineWins);
    setWinAmount(result.totalWin);

    // Reel 1
    setTimeout(() => { setReelStopped(prev => [true, prev[1], prev[2]]); haptic('select'); }, 600);
    // Reel 2
    setTimeout(() => { setReelStopped(prev => [prev[0], true, prev[2]]); haptic('select'); }, 1200);
    // Reel 3
    setTimeout(() => { setReelStopped(prev => [prev[0], prev[1], true]); haptic('select'); }, 1800);
    // Multiplier
    setTimeout(() => { 
      setMultStopped(true); 
      setPhase('REVEALING');
      haptic('select');
      resolveWin(result);
    }, 2400);
  };

  const resolveWin = (result: SpinResult) => {
    if (result.totalWin > 0) {
      const w = result.totalWin;
      const t = w >= bet * 50 ? 'MEGA_WIN' : w >= bet * 10 ? 'BIG_WIN' : 'WIN';
      setWinTier(t);
      if (t === 'MEGA_WIN' || t === 'BIG_WIN') haptic('bigwin');
      else haptic('win');

      setPhase('WIN');
      
      // Wait for banner, then offer gamble if enabled and under max rounds
      setTimeout(() => {
        setWinTier('NONE');
        if (config?.gambleMaxRounds > 0 && !autoActive) {
          gambleFlow.startGamble(result.finalPayout);
          setPhase('GAMBLE');
        } else {
          // Autoplay or no gamble — collect automatically
          finishSpin();
        }
      }, 3000);
    } else {
      finishSpin();
    }
  };

  const finishSpin = () => {
    setPhase('IDLE');
    fetchHistory();
    // Fallback: always re-fetch fresh balance from server when spin completes
    getMe().then(me => {
      if (me?.wallet?.balance !== undefined) {
        setBalance(Number(me.wallet.balance));
      }
    }).catch(() => {});

    // Handle Autoplay next tick
    if (autoActive) {
      autoSpinsLeft.current--;
      
      if (autoSpinsLeft.current <= 0) {
        setAutoActive(false);
        return;
      }
      if (autoStopWin.current > 0 && winAmount >= autoStopWin.current) {
        setAutoActive(false);
        return;
      }
      if (autoStopLoss.current > 0 && (startBalance.current - balance) >= autoStopLoss.current) {
        setAutoActive(false);
        return;
      }
      
      setTimeout(handleSpin, 1000);
    }
  };

  const startAutoplay = (count: number, stopWin: number, stopLoss: number) => {
    setAutoActive(true);
    autoSpinsLeft.current = count;
    autoStopWin.current = stopWin;
    autoStopLoss.current = stopLoss;
    startBalance.current = balance;
    handleSpin();
  };

  if (!splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)} />;
  }

  if (configLoading || !config) {
    return <div className="min-h-screen bg-[#110000] flex items-center justify-center"><Loader2 className="animate-spin text-yellow-500 w-10 h-10" /></div>;
  }

  return (
    <div className="min-h-screen text-white flex flex-col relative overflow-hidden" style={{ background: 'radial-gradient(ellipse at top, #065f46 0%, #064e3b 40%, #022c22 100%)' }}>
      {/* Premium subtle emerald glow at top */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(16,185,129,0.3) 0%, transparent 60%)' }} />

      {/* Header */}
      <header className="flex justify-between items-center px-4 py-3 z-10 border-b border-white/10 bg-black/30 backdrop-blur-sm">
        <div className="flex-1 flex items-center justify-start">
          <button onClick={() => router.push('/')} className="text-gray-300 hover:text-white transition-colors font-bold text-[11px] tracking-widest uppercase drop-shadow-md">
            BACK
          </button>
        </div>
        
        <div className="font-black italic tracking-widest text-xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] flex-none text-center">
          <span className="bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-600 bg-clip-text text-transparent">MULTI HOT </span>
          <span className="bg-gradient-to-b from-pink-400 to-pink-600 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]">5</span>
        </div>

        <div className="flex-1 flex justify-end items-center gap-2">
          <div className="flex items-center bg-black/40 rounded-full px-3 py-1 border border-white/10 gap-2 shadow-inner">
            <Wallet className="w-3.5 h-3.5 text-yellow-500" strokeWidth={2.5} />
            <span className="text-[13px] font-bold text-white font-mono">{balance.toFixed(2)}</span>
          </div>
          <button onClick={() => router.push('/history')} className="text-[10px] font-bold text-gray-400 hover:text-white border border-gray-700 bg-black/40 rounded-full px-2.5 py-1 transition-colors uppercase tracking-widest">
            Hist
          </button>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 flex flex-col items-center justify-start px-4 pt-2 pb-24 gap-4 z-10 w-full max-w-md mx-auto relative overflow-y-auto">
        <WinBanner tier={winTier} amount={winAmount} />

        <ReelGrid
          grid={grid}
          spinning={phase === 'SPINNING'}
          reelStopped={reelStopped}
          lineWins={lineWins}
        />

        <MultiplierReel
          multiplier={multiplier}
          spinning={phase === 'SPINNING'}
          stopped={multStopped}
          win={winAmount > 0}
        />

        {spinError && (
          <div className="w-full text-red-500 bg-red-900/30 px-4 py-2 rounded-xl text-sm border border-red-900 text-center mt-2">
            {spinError}
          </div>
        )}

        <div className="w-full mt-2">
          <BetControls
            bet={bet}
            minBet={config.minBet}
            maxBet={config.maxBet}
            betStep={config.betStep}
            balance={balance}
            spinning={phase !== 'IDLE'}
            onBetChange={setBet}
            onSpin={handleSpin}
            autoplayActive={autoActive}
            onAutoplayToggle={() => autoActive ? setAutoActive(false) : setAutoPanelOpen(true)}
          />
        </div>
      </main>

      <AutoplayPanel
        isOpen={autoPanelOpen}
        onClose={() => setAutoPanelOpen(false)}
        onStart={startAutoplay}
      />

      <GambleModal
        isOpen={phase === 'GAMBLE'}
        currentPayout={gambleFlow.currentPayout}
        round={gambleFlow.round}
        maxRounds={config.gambleMaxRounds}
        loading={gambleFlow.loading}
        error={gambleFlow.error}
        onChoice={(c) => {
          gambleFlow.makeChoice(currentSpinId.current, c, (res) => {
            // Always update balance from server response (win or loss)
            if (res.newBalance !== undefined) setBalance(res.newBalance);
            if (res.gambleComplete) {
              if (!res.won) {
                // Lost — show loss state briefly then go to idle
                setTimeout(() => finishSpin(), 2500);
              } else {
                setTimeout(finishSpin, 2000);
              }
            }
          });
        }}
        onCollect={() => {
          gambleFlow.doCollect(currentSpinId.current, (finalPayout, newBalance) => {
            if (newBalance !== undefined) setBalance(newBalance);
            finishSpin();
          });
        }}
      />

      {/* FAB to navigate to Aviator (ፍንዳታ) */}
      <button
        onClick={() => router.push('/play/aviator')}
        className="fixed bottom-4 right-4 z-50 bg-gradient-to-b from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-[0_4px_15px_rgba(220,38,38,0.6)] border-2 border-red-400 font-black text-[11px] tracking-wider active:scale-95 transition-transform"
      >
        ፍንዳታ
      </button>
    </div>
  );
}
