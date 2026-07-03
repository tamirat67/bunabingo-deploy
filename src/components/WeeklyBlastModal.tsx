'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Coins, Star, Gift } from 'lucide-react';
import api from '../lib/api';

interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  isWinner: boolean;
}

interface WeeklyBlastModalProps {
  onClose: () => void;
  onRewardClaimed: (amount: number) => void;
}

export default function WeeklyBlastModal({ onClose, onRewardClaimed }: WeeklyBlastModalProps) {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(false);
  const [totalWinners, setTotalWinners] = useState(0);
  const [hasParticipated, setHasParticipated] = useState(false);
  const [isWinner, setIsWinner] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  
  const [isBlasting, setIsBlasting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [drawResult, setDrawResult] = useState<{ isWinner: boolean; amount: number } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [currentRes, lbRes] = await Promise.all([
        api.get('/weekly-blast/current').then(res => res.data),
        api.get('/weekly-blast/leaderboard').then(res => res.data)
      ]);

      setActive(currentRes.active);
      setTotalWinners(currentRes.totalWinners || 0);
      setHasParticipated(currentRes.hasParticipated);
      setIsWinner(currentRes.isWinner);
      setRewardAmount(currentRes.rewardAmount);
      setLeaderboard(lbRes.leaderboard || []);

      // If they already participated, show the result screen immediately instead of the button
      if (currentRes.hasParticipated) {
        setDrawResult({
          isWinner: currentRes.isWinner,
          amount: currentRes.rewardAmount
        });
        setShowResult(true);
      }
    } catch (error) {
      console.error('Failed to fetch weekly blast data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBlast = async () => {
    if (hasParticipated || isBlasting) return;
    
    // Trigger vibration
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100, 50, 200]);
    }

    setIsBlasting(true);
    
    // Optional: play explosion sound
    try {
      const audio = new Audio('/audio/win.mp3'); // Fallback to win if explosion is missing
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (e) {}

    try {
      const res = await api.post('/weekly-blast/draw').then(r => r.data);
      
      // Simulate blast animation delay
      setTimeout(() => {
        setDrawResult({ isWinner: res.isWinner, amount: res.amount });
        setTotalWinners(res.totalWinners);
        setHasParticipated(true);
        setIsBlasting(false);
        setShowResult(true);

        if (res.isWinner) {
          onRewardClaimed(res.amount);
          // Play jackpot sound
          try {
            const audio = new Audio('/audio/jackpot.mp3');
            audio.volume = 0.8;
            audio.play().catch(() => {});
          } catch (e) {}
        }
      }, 1500);

    } catch (error: any) {
      console.error('Draw failed', error);
      setIsBlasting(false);
      alert(error.message || 'Failed to draw. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-12 h-12 border-4 border-[#34c759] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If event is not active and they haven't participated, maybe auto-close or show message
  // But usually, the button in game page won't open this if active=false, but just in case:
  if (!active && !hasParticipated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-[#1C0A35] border border-white/10 rounded-3xl p-6 w-full max-w-sm text-center relative shadow-2xl">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white">
            <X size={24} />
          </button>
          <Gift size={48} className="mx-auto text-white/30 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">ዝግ ነው (Closed)</h2>
          <p className="text-white/70">
            የሳምንታዊ ሽልማት ፍንዳታ በአሁን ሰዓት ዝግ ነው። እባክዎ ቅዳሜ ይጠብቁ!
          </p>
        </div>
      </div>
    );
  }

  const progressPercent = Math.min((totalWinners / 10) * 100, 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-gradient-to-br from-[#2a0e4a] to-[#140524] border border-[#ffb347]/30 rounded-3xl w-full max-w-md relative shadow-[0_0_50px_rgba(255,179,71,0.15)] overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Background glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200%] h-40 bg-[radial-gradient(ellipse_at_top,rgba(255,179,71,0.2),transparent_70%)] pointer-events-none" />

        <div className="p-4 flex justify-between items-center border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-[#ffb347]/20 p-2 rounded-xl">
              <Gift className="text-[#ffb347]" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">ሳምንታዊ ሽልማት ፍንዳታ</h2>
              <p className="text-xs text-[#ffb347]">Weekly Reward Blast</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          
          {/* Progress Bar Section */}
          <div className="bg-black/30 rounded-2xl p-4 mb-8 border border-white/5">
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-medium text-white/80">ያሸነፉ ተጫዋቾች</span>
              <span className="text-xl font-bold text-white">
                <span className="text-[#34c759]">{totalWinners}</span> / 10
              </span>
            </div>
            <div className="h-3 bg-black/50 rounded-full overflow-hidden relative">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#34c759] to-[#2ecc71] rounded-full"
              >
                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] -translate-x-full animate-[shimmer_2s_infinite]" />
              </motion.div>
            </div>
            <p className="text-xs text-white/50 text-center mt-3">
              ጠቅላላ ሽልማት: <span className="text-[#ffb347] font-bold">5,000 ETB</span>
            </p>
          </div>

          {/* Main Action Area */}
          <div className="flex flex-col items-center justify-center min-h-[240px] mb-8 relative">
            <AnimatePresence mode="wait">
              {!showResult ? (
                <motion.div 
                  key="blast-button"
                  exit={{ scale: 0, opacity: 0, rotate: 180 }}
                  className="relative group cursor-pointer"
                  onClick={handleBlast}
                >
                  {/* Glowing rings */}
                  <div className="absolute inset-0 rounded-full bg-[#ffb347] opacity-20 blur-xl group-hover:opacity-40 group-hover:blur-2xl transition-all duration-500" />
                  <div className={`absolute inset-0 rounded-full border-2 border-[#ffb347]/50 ${isBlasting ? 'animate-ping' : 'animate-[pulse_3s_infinite]'}`} />
                  
                  {/* The Button */}
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    animate={isBlasting ? { 
                      scale: [1, 1.2, 0.8, 1.5],
                      rotate: [0, -10, 10, -20, 20, 0],
                      filter: ['brightness(1)', 'brightness(1.5)', 'brightness(2)']
                    } : {
                      y: [0, -10, 0]
                    }}
                    transition={isBlasting ? { duration: 1.5, ease: "easeInOut" } : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="w-40 h-40 rounded-full bg-gradient-to-br from-[#ff6b6b] to-[#c0392b] border-4 border-[#ffb347] shadow-[0_10px_30px_rgba(192,57,43,0.5),inset_0_5px_15px_rgba(255,255,255,0.4)] flex flex-col items-center justify-center relative overflow-hidden"
                  >
                    <div className="absolute top-0 w-full h-1/2 bg-white/20 rounded-t-full" />
                    <span className="text-5xl mb-1 filter drop-shadow-lg">💥</span>
                    <span className="text-white font-black text-xl tracking-wider uppercase drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">
                      ማፈንዳት
                    </span>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div 
                  key="result"
                  initial={{ scale: 0, opacity: 0, rotate: -180 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 15 }}
                  className="w-full"
                >
                  {drawResult?.isWinner ? (
                    <div className="text-center bg-[#34c759]/10 border border-[#34c759]/30 rounded-3xl p-8 relative overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(52,199,89,0.2),transparent)]" />
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                      >
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#34c759] text-white shadow-[0_0_30px_rgba(52,199,89,0.5)] mb-4">
                          <Coins size={40} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">🎉 እንኳን ደስ አለዎት!</h3>
                        <p className="text-lg text-white/90">
                          እርስዎ የ <span className="text-[#34c759] font-bold text-2xl mx-1">{drawResult.amount} ETB</span> አሸናፊ ሆነዋል!
                        </p>
                        <p className="text-sm text-white/50 mt-4">ገንዘቡ ወደ ሂሳብዎ ገብቷል</p>
                      </motion.div>
                    </div>
                  ) : (
                    <div className="text-center bg-white/5 border border-white/10 rounded-3xl p-8">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 text-white/50 mb-4">
                        <Star size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-3">መልካም ዕድል</h3>
                      <p className="text-white/70 leading-relaxed text-sm">
                        ተሳትፎዎን ይቀጥሉ፤ በሚቀጥለው ሳምንታዊ ሽልማት ፍንዳታ ዕድልዎ ይጨምራል!
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Leaderboard Section */}
          <div className="mt-4">
            <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Trophy size={16} /> መሪ ተጫዋቾች (Leaderboard)
            </h3>
            
            <div className="bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
              {leaderboard.length === 0 ? (
                <div className="p-6 text-center text-white/40 text-sm">
                  ምንም መረጃ የለም
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {leaderboard.map((entry) => (
                    <div key={entry.rank} className="p-3 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          entry.rank === 1 ? 'bg-[#FFD700] text-black shadow-[0_0_10px_rgba(255,215,0,0.5)]' :
                          entry.rank === 2 ? 'bg-[#C0C0C0] text-black shadow-[0_0_10px_rgba(192,192,192,0.5)]' :
                          entry.rank === 3 ? 'bg-[#CD7F32] text-black shadow-[0_0_10px_rgba(205,127,50,0.5)]' :
                          'bg-white/10 text-white/60'
                        }`}>
                          #{entry.rank}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white truncate max-w-[120px]">
                            {entry.name}
                          </p>
                          <p className="text-[10px] text-white/40">Score: {Math.round(entry.score)}</p>
                        </div>
                      </div>
                      
                      {entry.isWinner && (
                        <div className="px-2 py-1 rounded-md bg-[#34c759]/20 border border-[#34c759]/30 text-[#34c759] text-[10px] font-bold">
                          WON
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
