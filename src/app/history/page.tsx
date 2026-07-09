'use client';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import api, { getHistory, getGlobalHistory } from '../../lib/api';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../context/ThemeContext';
import { RefreshCw, Search, Trophy, Calendar, Clock, User, Play, Wallet as WalletIcon, History as HistoryIcon } from 'lucide-react';
import { motion } from 'framer-motion';

export default function HistoryPage() {
  const router = useRouter();
  const { T } = useTheme();
  const [tab, setTab] = useState('recent');
  const [filter, setFilter] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [globalHistory, setGlobalHistory] = useState<any[]>([]);
  const [myHistory, setMyHistory] = useState<any[]>([]);
  const [branchHistory, setBranchHistory] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const meRes = await api.get('/me');
      setUser(meRes.data);
      
      getGlobalHistory().then(setGlobalHistory).catch(() => {});
      getHistory().then(setMyHistory).catch(() => {});
      
      if (meRes.data.role === 'AGENT' || meRes.data.role === 'agent' || meRes.data.role === 'ADMIN' || meRes.data.isAdmin) {
        if (meRes.data.role === 'AGENT' || meRes.data.role === 'agent') {
          api.get('/agent/winners').then(res => setBranchHistory(res.data.winners)).catch(() => {});
        } else {
          getGlobalHistory().then(setBranchHistory).catch(() => {});
        }
        setTab(meRes.data.role === 'ADMIN' || meRes.data.isAdmin ? 'recent' : 'branch');
      }
    } catch (e) {}
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    setMounted(true);
    loadData();
    // Auto-refresh every 30 seconds
    intervalRef.current = setInterval(() => loadData(true), 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadData]);

  if (!mounted) return null;

  const currentData = tab === 'recent' ? globalHistory : tab === 'my' ? myHistory : branchHistory;
  const filteredData = currentData.filter(item => {
    if (filter && Number(item.game?.room?.ticketPrice) !== filter) return false;
    if (search && !item.user?.firstName?.toLowerCase().includes(search.toLowerCase()) &&
        !item.gameId?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: '100px', fontFamily: "'Outfit', sans-serif", color: T.text, transition: 'all 0.3s ease' }}>

      {/* ── Header ── */}
      <div style={{ background: T.header, padding: '12px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${T.gold}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', background: T.gold, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HistoryIcon size={18} color={T.header} />
          </div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: T.gold, letterSpacing: '0.5px' }}>BINGO HISTORY</div>
          {/* Live badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: '20px', padding: '2px 8px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'livePulse 1.5s ease-in-out infinite' }} />
            <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: '900' }}>LIVE</span>
          </div>
        </div>
        <RefreshCw size={20} color={T.gold} onClick={() => loadData()} style={{ cursor: 'pointer', transition: 'transform 0.5s', transform: refreshing ? 'rotate(360deg)' : 'none' }} />
      </div>

      <div style={{ padding: '20px 15px' }}>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          {[
            ['recent', 'Global'], 
            ['my', 'Personal'],
            ...(user?.role === 'AGENT' || user?.role === 'agent' ? [['branch', 'My Branch']] : []),
            ...(user?.role === 'ADMIN' || user?.isAdmin ? [['branch', 'All Winners']] : [])
          ].map(([key, label]) => (
            <div key={key} onClick={() => setTab(key)} style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', background: tab === key ? T.gold : 'transparent', color: tab === key ? T.header : T.text, fontWeight: '900', fontSize: '13px', cursor: 'pointer', border: tab === key ? 'none' : `1px solid ${T.border}` }}>
              {label}
            </div>
          ))}
        </div>

        {/* ── Filter Chips ── */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', flexWrap: 'wrap' }}>
          {[10, 20, 50, 100, 200].map(amt => (
            <div key={amt} onClick={() => setFilter(filter === amt ? null : amt)} style={{ padding: '6px 14px', borderRadius: '20px', background: filter === amt ? T.gold : 'transparent', color: filter === amt ? T.header : T.text, fontWeight: '900', fontSize: '12px', cursor: 'pointer', border: filter === amt ? 'none' : `1px solid ${T.border}` }}>
              {amt} ETB
            </div>
          ))}
        </div>

        {/* ── Search Bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: T.card, padding: '10px 15px', borderRadius: '12px', border: `1px solid ${T.border}`, marginBottom: '20px' }}>
          <Search size={16} style={{ opacity: 0.4, flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search by player or game ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: "'Outfit', sans-serif", fontSize: '13px', color: T.text }}
          />
        </div>

        {/* ── History List ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredData.map((item, i) => {
            const date = new Date(item.paidAt);
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const name = item.user?.firstName || item.user?.telegramUsername || 'Player';
            const refCode = item.gameId?.substring(0, 6).toUpperCase() || '—';
            const boardNum = item.ticketId?.substring(0, 4).toUpperCase() || '—';
            const prize = Number(item.prizeAmount || 0).toFixed(0);

            return (
              <motion.div key={item.id || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} style={{ background: T.card, padding: '14px', borderRadius: '16px', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                <div style={{ width: '44px', height: '44px', background: `${T.gold}22`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Trophy size={22} color={T.gold} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '900', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <User size={12} style={{ opacity: 0.5, flexShrink: 0 }} /> {name}
                  </div>
                  <div style={{ fontSize: '11px', opacity: 0.4, marginTop: '2px' }}>Game #{refCode} · Board #{boardNum}</div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px', fontSize: '10px', opacity: 0.4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Calendar size={10} /> {dateStr}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={10} /> {timeStr}</span>
                  </div>
                </div>
                <div style={{ fontWeight: '900', fontSize: '18px', color: T.gold, flexShrink: 0 }}>
                  {prize} <span style={{ fontSize: '10px', opacity: 0.5 }}>ETB</span>
                </div>
              </motion.div>
            );
          })}

          {filteredData.length === 0 && (
            <div style={{ background: T.card, borderRadius: '16px', border: `1px solid ${T.border}`, padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ opacity: 0.2, marginBottom: '10px' }}><HistoryIcon size={40} style={{ margin: '0 auto' }} /></div>
              <div style={{ fontSize: '13px', opacity: 0.5 }}>No games found</div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;900&display=swap');
        body { background: ${T.bg} !important; margin: 0; padding: 0; transition: background 0.3s ease; }
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
