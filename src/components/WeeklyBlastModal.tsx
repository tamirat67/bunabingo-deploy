'use client';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Coins, Star, Gift } from 'lucide-react';
import api from '../lib/api';

interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  isWinner: boolean;
  rewardAmount?: number;
}

interface WeeklyBlastModalProps {
  onClose: () => void;
  onRewardClaimed: (amount: number) => void;
}

// Tier display config
const TIER_MEDALS = ['🥇', '🥈', '🥉', '⭐', '⭐', '🎁', '🎁', '🎁', '🎁', '🎁'];
const TIER_LABELS_AM = ['1ኛ ደረጃ', '2ኛ ደረጃ', '3ኛ ደረጃ', '4ኛ–5ኛ ደረጃ', '4ኛ–5ኛ ደረጃ', '6ኛ–10ኛ ደረጃ', '6ኛ–10ኛ ደረጃ', '6ኛ–10ኛ ደረጃ', '6ኛ–10ኛ ደረጃ', '6ኛ–10ኛ ደረጃ'];

export default function WeeklyBlastModal({ onClose, onRewardClaimed }: WeeklyBlastModalProps) {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(false);
  const [totalWinners, setTotalWinners] = useState(0);
  const [hasParticipated, setHasParticipated] = useState(false);
  const [isWinner, setIsWinner] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Dynamic event config from API
  const [eventName, setEventName] = useState('🎊 መልካም አዲስ ዓመት ከBuna Bingo!');
  const [bannerText, setBannerText] = useState('');
  const [rewardTiers, setRewardTiers] = useState<number[]>([5000, 3500, 2500, 1500, 1500, 1200, 1200, 1200, 1200, 1200]);
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [totalRewardPool, setTotalRewardPool] = useState(20000);

  const [isBlasting, setIsBlasting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [drawResult, setDrawResult] = useState<{ isWinner: boolean; amount: number } | null>(null);
  const [showTiers, setShowTiers] = useState(false);

  const [timeLeft, setTimeLeft] = useState<{ months: number; days: number; hours: number; mins: number; secs: number } | null>(null);

  // Banner scroll ref
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      let target: Date;

      if (targetDate) {
        target = targetDate;
      } else {
        // Default: next Saturday at 09:00 EAT
        target = new Date();
        target.setUTCHours(6, 0, 0, 0);
        const daysUntilSaturday = (6 - target.getUTCDay() + 7) % 7;
        target.setUTCDate(target.getUTCDate() + daysUntilSaturday);
        if (now >= target) target.setUTCDate(target.getUTCDate() + 7);
      }

      const diff = target.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft({ months: 0, days: 0, hours: 0, mins: 0, secs: 0 });
        return;
      }

      const totalSecs = Math.floor(diff / 1000);
      const months = Math.floor(totalSecs / (30 * 24 * 3600));
      const remainAfterMonths = totalSecs % (30 * 24 * 3600);
      const days = Math.floor(remainAfterMonths / (24 * 3600));
      const hours = Math.floor((remainAfterMonths % (24 * 3600)) / 3600);
      const mins = Math.floor((remainAfterMonths % 3600) / 60);
      const secs = remainAfterMonths % 60;
      setTimeLeft({ months, days, hours, mins, secs });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

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

      // Load dynamic event config
      if (currentRes.eventName) setEventName(currentRes.eventName);
      if (currentRes.bannerText) setBannerText(currentRes.bannerText);
      if (currentRes.targetDate) setTargetDate(new Date(currentRes.targetDate));
      if (currentRes.totalRewardPool) setTotalRewardPool(currentRes.totalRewardPool);

      // Note: rewardTiers aren't returned from the leaderboard endpoint but shown via totalRewardPool
      if (currentRes.hasParticipated) {
        setDrawResult({ isWinner: currentRes.isWinner, amount: currentRes.rewardAmount });
        setShowResult(true);
      }
    } catch (error) {
      console.error('Failed to fetch weekly blast data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBlast = async () => {
    if (hasParticipated || isBlasting || !active) return;
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
    setIsBlasting(true);
    try {
      const audio = new Audio('/audio/win.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (e) {}

    try {
      const res = await api.post('/weekly-blast/draw').then(r => r.data);
      setTimeout(() => {
        setDrawResult({ isWinner: false, amount: 0 });
        setTotalWinners(res.totalWinners);
        setHasParticipated(true);
        setIsBlasting(false);
        setShowResult(true);
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
        <div className="w-12 h-12 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maxWinners = rewardTiers.length || 10;
  const progressPercent = Math.min((totalWinners / maxWinners) * 100, 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 30 }}
        style={{
          background: 'linear-gradient(145deg, #0f0520 0%, #1a0535 40%, #2a0618 100%)',
          borderRadius: '28px',
          width: '100%',
          maxWidth: '420px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 0 80px rgba(212,175,55,0.2), 0 0 200px rgba(120,0,60,0.15)',
          border: '1px solid rgba(212,175,55,0.2)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '94vh',
        }}
      >
        {/* Top celestial glow */}
        <div style={{ position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)', width: '300px', height: '160px', background: 'radial-gradient(ellipse at top, rgba(212,175,55,0.25), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(255,80,80,0.08), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '180px', height: '180px', background: 'radial-gradient(circle, rgba(100,50,200,0.1), transparent 70%)', pointerEvents: 'none' }} />

        {/* ── Header ── */}
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'relative', zIndex: 2, flexShrink: 0 }}>
          <div style={{ flex: 1, paddingRight: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{ background: 'rgba(212,175,55,0.2)', borderRadius: '12px', padding: '7px', border: '1px solid rgba(212,175,55,0.3)' }}>
                <Gift size={18} color="#d4af37" />
              </div>
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: '900', color: '#fff', margin: 0, lineHeight: 1.3 }}>{eventName}</h2>
                <p style={{ fontSize: '10px', color: 'rgba(212,175,55,0.8)', margin: 0, marginTop: '2px' }}>
                  {totalRewardPool.toLocaleString()} ብር ጠቅላላ ሽልማት
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Scrolling Banner ── */}
        {bannerText && (
          <div style={{ background: 'rgba(212,175,55,0.08)', borderBottom: '1px solid rgba(212,175,55,0.15)', padding: '8px 0', overflow: 'hidden', flexShrink: 0 }}>
            <motion.div
              animate={{ x: [400, -1200] }}
              transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
              style={{ whiteSpace: 'nowrap', fontSize: '11px', fontWeight: '700', color: '#d4af37', paddingLeft: '16px' }}
            >
              {bannerText.replace(/\n/g, '  •  ')}
            </motion.div>
          </div>
        )}

        {/* ── Scrollable Content ── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '20px' }}>

          {/* ── Countdown Timer ── */}
          {timeLeft && (
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px' }}>
                {targetDate ? '⏳ ቀሪ ጊዜ' : '⏳ ቀጣይ ፍንዳታ'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                {[
                  ...(timeLeft.months > 0 ? [{ v: timeLeft.months, l: 'ወር' }] : []),
                  { v: timeLeft.days, l: 'ቀን' },
                  { v: timeLeft.hours, l: 'ሰዓት' },
                  { v: timeLeft.mins, l: 'ደቂቃ' },
                  { v: timeLeft.secs, l: 'ሰ' },
                ].map(({ v, l }) => (
                  <div key={l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '12px', padding: '8px 10px', minWidth: '44px' }}>
                    <span style={{ fontSize: '22px', fontWeight: '900', color: '#d4af37', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                      {v.toString().padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '1px' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Prize Tiers Accordion ── */}
          <div style={{ marginBottom: '20px', background: 'rgba(0,0,0,0.3)', borderRadius: '18px', border: '1px solid rgba(212,175,55,0.15)', overflow: 'hidden' }}>
            <button
              onClick={() => setShowTiers(!showTiers)}
              style={{ width: '100%', padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trophy size={15} color="#d4af37" /> 🏆 የሽልማት አከፋፈል
              </span>
              <span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.4)', transition: 'transform 0.3s', transform: showTiers ? 'rotate(180deg)' : 'rotate(0deg)' }}>⌄</span>
            </button>

            <AnimatePresence>
              {showTiers && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ padding: '0 12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {rewardTiers.map((amount, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        background: i < 3 ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.03)',
                        border: i < 3 ? '1px solid rgba(212,175,55,0.2)' : '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '12px', padding: '10px 12px'
                      }}>
                        <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{TIER_MEDALS[i] || '🎁'}</span>
                        <span style={{ flex: 1, fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.85)' }}>{TIER_LABELS_AM[i] || `${i + 1}ኛ ደረጃ`}</span>
                        <span style={{ fontSize: '14px', fontWeight: '900', color: i < 3 ? '#d4af37' : '#22c55e' }}>{amount.toLocaleString()} ብር</span>
                      </div>
                    ))}
                    <div style={{ background: 'linear-gradient(90deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))', border: '1px solid rgba(212,175,55,0.4)', borderRadius: '12px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#d4af37' }}>💰 ጠቅላላ ሽልማት</span>
                      <span style={{ fontSize: '16px', fontWeight: '900', color: '#d4af37' }}>{totalRewardPool.toLocaleString()} ብር</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Main Blast Button or Result ── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', marginBottom: '20px', position: 'relative' }}>
            <AnimatePresence mode="wait">
              {!showResult ? (
                <motion.div
                  key="blast-button"
                  exit={{ scale: 0, opacity: 0 }}
                  style={{ position: 'relative', cursor: active ? 'pointer' : 'default' }}
                  onClick={active && !isBlasting ? handleBlast : undefined}
                >
                  {/* Pulsing glow rings */}
                  <motion.div
                    animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    style={{ position: 'absolute', inset: '-20px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,55,0.4), transparent 70%)', pointerEvents: 'none' }}
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                    style={{ position: 'absolute', inset: '-10px', borderRadius: '50%', border: '2px solid rgba(212,175,55,0.4)', pointerEvents: 'none' }}
                  />

                  {/* Button */}
                  <motion.div
                    whileHover={{ scale: active ? 1.05 : 1 }}
                    whileTap={{ scale: active ? 0.93 : 1 }}
                    animate={isBlasting
                      ? { scale: [1, 1.3, 0.8, 1.5], rotate: [0, -10, 10, 0], filter: ['brightness(1)', 'brightness(2)'] }
                      : { y: [0, -8, 0] }
                    }
                    transition={isBlasting ? { duration: 1.5 } : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                      width: '148px', height: '148px', borderRadius: '50%',
                      background: active
                        ? 'linear-gradient(145deg, #ff6b35, #c0392b, #8b0000)'
                        : 'linear-gradient(145deg, #4a3728, #2d1f16)',
                      border: `4px solid ${active ? '#d4af37' : 'rgba(255,255,255,0.1)'}`,
                      boxShadow: active ? '0 15px 40px rgba(192,57,43,0.6), inset 0 5px 15px rgba(255,255,255,0.3)' : 'none',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      position: 'relative', overflow: 'hidden',
                    }}
                  >
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', background: 'rgba(255,255,255,0.15)', borderRadius: '50% 50% 0 0', pointerEvents: 'none' }} />
                    <span style={{ fontSize: '44px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>{active ? '💥' : '⏳'}</span>
                    <span style={{ color: 'white', fontWeight: '900', fontSize: '16px', letterSpacing: '1px', textShadow: '0 2px 4px rgba(0,0,0,0.6)', marginTop: '4px' }}>
                      {isBlasting ? 'ሲፈለፈል...' : active ? 'ማፈንዳት' : 'ይጠብቁ'}
                    </span>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key="result"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 14 }}
                  style={{ width: '100%' }}
                >
                  {/* Enrollment success (no instant win in new system) */}
                  <div style={{ textAlign: 'center', background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.25)', borderRadius: '24px', padding: '28px 20px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, rgba(52,199,89,0.1), transparent 70%)', pointerEvents: 'none' }} />
                    <div style={{ fontSize: '52px', marginBottom: '12px' }}>🎊</div>
                    <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#fff', margin: '0 0 8px' }}>
                      ተመዝግበዋል! እንኳን ደስ አለዎት!
                    </h3>
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6', marginBottom: '16px' }}>
                      አፈጻጸምዎ ይቆጠራል። ለምርጥ 10 ደረጃ ይወዳደሩ — ሽልማቱ ፍንዳታ ሲዘጋ ይሰጣሉ!
                    </p>
                    {/* Mini countdown */}
                    {timeLeft && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {[
                          ...(timeLeft.months > 0 ? [{ v: timeLeft.months, l: 'ወር' }] : []),
                          { v: timeLeft.days, l: 'ቀን' },
                          { v: timeLeft.hours, l: 'ሰዓት' },
                          { v: timeLeft.mins, l: 'ደቂቃ' },
                        ].map(({ v, l }) => (
                          <div key={l} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '10px', padding: '6px 10px', textAlign: 'center' }}>
                            <div style={{ fontSize: '18px', fontWeight: '900', color: '#d4af37' }}>{v.toString().padStart(2, '0')}</div>
                            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>{l}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Enrollment Progress ── */}
          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '14px 16px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.7)' }}>ተሳታፊ ተጫዋቾች</span>
              <span style={{ fontSize: '14px', fontWeight: '900', color: '#fff' }}>
                <span style={{ color: '#34c759' }}>{totalWinners}</span> / {maxWinners}
              </span>
            </div>
            <div style={{ height: '8px', background: 'rgba(0,0,0,0.5)', borderRadius: '999px', overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                style={{ height: '100%', background: 'linear-gradient(90deg, #d4af37, #f4d03f)', borderRadius: '999px' }}
              />
            </div>
          </div>

          {/* ── Leaderboard ── */}
          <div>
            <h3 style={{ fontSize: '12px', fontWeight: '800', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trophy size={14} /> መሪ ሰሌዳ (Leaderboard)
            </h3>
            <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
              {leaderboard.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                  ምንም ተሳታፊ የለም አሁን
                </div>
              ) : (
                <div>
                  {leaderboard.map((entry) => (
                    <div
                      key={entry.rank}
                      style={{
                        padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: entry.rank <= 3 ? 'rgba(212,175,55,0.04)' : 'transparent',
                      }}
                    >
                      <div style={{
                        width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: '900', fontSize: '11px',
                        background: entry.rank === 1 ? 'linear-gradient(135deg,#FFD700,#FFA500)' : entry.rank === 2 ? 'linear-gradient(135deg,#C0C0C0,#A0A0A0)' : entry.rank === 3 ? 'linear-gradient(135deg,#CD7F32,#A0522D)' : 'rgba(255,255,255,0.08)',
                        color: entry.rank <= 3 ? '#000' : 'rgba(255,255,255,0.5)',
                        boxShadow: entry.rank === 1 ? '0 0 12px rgba(255,215,0,0.5)' : 'none',
                      }}>
                        {entry.rank <= 3 ? TIER_MEDALS[entry.rank - 1] : `#${entry.rank}`}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '13px', fontWeight: '700', color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</p>
                        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', margin: 0 }}>Score: {Math.round(entry.score)}</p>
                      </div>
                      {entry.rewardAmount && entry.rewardAmount > 0 ? (
                        <div style={{ background: 'rgba(52,199,89,0.15)', border: '1px solid rgba(52,199,89,0.3)', borderRadius: '8px', padding: '3px 8px', fontSize: '11px', fontWeight: '800', color: '#34c759' }}>
                          {entry.rewardAmount.toLocaleString()} ብር
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>—</div>
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
