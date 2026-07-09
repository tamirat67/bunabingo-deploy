'use client';
import React, { useEffect, useState } from 'react';
import { getLeaderboard } from '../../lib/api';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../context/ThemeContext';
import { Play, Wallet as WalletIcon, Trophy, History, User, Medal } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ScoresPage() {
  const router = useRouter();
  const { T } = useTheme();
  const [board, setBoard] = useState('score');
  const [time, setTime] = useState('today');
  const [players, setPlayers] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    getLeaderboard(time).then(setPlayers).catch(() => setPlayers([]));
  }, [time]);

  if (!mounted) return null;

  const colors = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: '100px', fontFamily: "'Outfit', sans-serif", color: T.text, transition: 'all 0.3s ease' }}>

      {/* ── Header ── */}
      <div style={{ background: T.header, padding: '12px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${T.gold}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', background: T.gold, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trophy size={18} color={T.header} />
          </div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: T.gold, letterSpacing: '0.5px' }}>LEADERBOARD</div>
        </div>
      </div>

      <div style={{ padding: '20px 15px' }}>

        {/* ── Board Toggle ── */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          {['score', 'bonus'].map(b => (
            <div key={b} onClick={() => setBoard(b)} style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', background: board === b ? T.gold : 'transparent', color: board === b ? T.header : T.text, fontWeight: '900', fontSize: '13px', cursor: 'pointer', border: board === b ? 'none' : `1px solid ${T.border}` }}>
              {b === 'score' ? 'Score Board' : 'Bonus Board'}
            </div>
          ))}
        </div>

        {/* ── Time Filter ── */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {['today', 'week', 'month'].map(t => (
            <div key={t} onClick={() => setTime(t)} style={{ flex: 1, textAlign: 'center', padding: '7px', borderRadius: '8px', background: time === t ? `${T.gold}22` : 'transparent', color: time === t ? T.gold : T.text, fontWeight: '900', fontSize: '11px', cursor: 'pointer', border: time === t ? `1px solid ${T.gold}` : `1px solid ${T.border}`, textTransform: 'capitalize' }}>
              {t === 'today' ? 'Today' : t === 'week' ? 'This Week' : 'This Month'}
            </div>
          ))}
        </div>

        {/* ── Top 3 Avatars ── */}
        {players.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '25px' }}>
            {players.slice(0, 3).map((p, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: i === 0 ? '56px' : '44px', height: i === 0 ? '56px' : '44px', background: colors[i], borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: i === 0 ? '20px' : '16px', fontWeight: '900', color: 'white', border: `3px solid ${T.gold}` }}>
                  {p.name?.substring(0, 2).toUpperCase() || 'P'}
                </div>
                <div style={{ fontSize: '18px' }}>{medals[i]}</div>
                <div style={{ fontSize: '10px', fontWeight: '900', opacity: 0.6 }}>{p.score || 0}</div>
              </motion.div>
            ))}
          </div>
        )}

        {/* ── Leaderboard List ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {players.map((p, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} style={{ background: T.card, padding: '12px 15px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '12px', border: `1px solid ${T.border}`, boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
              <div style={{ width: '28px', height: '28px', background: i < 3 ? T.gold : `${T.border}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '900', color: i < 3 ? T.header : T.text, flexShrink: 0 }}>
                {i < 3 ? medals[i] : i + 1}
              </div>
              <div style={{ width: '36px', height: '36px', background: colors[i % colors.length], borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '900', color: 'white', flexShrink: 0 }}>
                {p.name?.substring(0, 2).toUpperCase() || 'P'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '900', fontSize: '14px' }}>{p.name || 'Player'}</div>
                <div style={{ fontSize: '11px', opacity: 0.4 }}>ID: {p.tgId || '—'}</div>
              </div>
              <div style={{ fontWeight: '900', color: T.gold, fontSize: '16px' }}>{p.score || 0}</div>
            </motion.div>
          ))}
          {players.length === 0 && (
            <div style={{ background: T.card, borderRadius: '16px', border: `1px solid ${T.border}`, padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ opacity: 0.2, marginBottom: '10px' }}><Trophy size={40} style={{ margin: '0 auto' }} /></div>
              <div style={{ fontSize: '13px', opacity: 0.5 }}>No players yet – be the first!</div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;900&display=swap');
        body { background: ${T.bg} !important; margin: 0; padding: 0; transition: background 0.3s ease; }
      `}</style>
    </div>
  );
}
