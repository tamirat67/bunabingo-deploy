'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { Loader2 } from 'lucide-react';
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
    return <div className="min-h-screen bg-[#051505] flex items-center justify-center"><Loader2 className="animate-spin text-green-500 w-10 h-10" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#051505] text-white flex flex-col relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 30%, rgba(34,197,94,0.1) 0%, transparent 60%)' }} />

      {/* Header */}
      <header className="flex justify-between items-center p-4 z-10">
        <button onClick={() => router.push('/')} className="text-green-500 font-bold">◀ BACK</button>
        <div className="font-black italic tracking-widest text-xl bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent drop-shadow-md">
          BUNA HOT 5
        </div>
        <button onClick={() => router.push('/history')} className="text-gray-400">History</button>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 z-10 w-full max-w-md mx-auto relative">
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
          <div className="mt-4 text-red-500 bg-red-900/30 px-4 py-2 rounded-xl text-sm border border-red-900">
            {spinError}
          </div>
        )}

        <div className="mt-auto w-full pb-6">
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
        onChoice={(c) => {
          gambleFlow.makeChoice(currentSpinId.current, c, (res) => {
            if (res.gambleComplete) setTimeout(finishSpin, 2000);
          });
        }}
        onCollect={() => {
          gambleFlow.doCollect(currentSpinId.current, () => finishSpin());
        }}
      />
    </div>
  );
}
