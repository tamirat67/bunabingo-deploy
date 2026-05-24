"use client";

import React, { useEffect, useState } from 'react';
import { FiDollarSign, FiClock, FiCheckCircle, FiTrendingUp } from 'react-icons/fi';
import api from '@/lib/api';

export default function CommissionsPage() {
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const statsRes = await api.get('/agent/stats');
        setStats(statsRes.data);
        try {
          const txRes = await api.get('/agent/players');
          setHistory(txRes.data.users || []);
        } catch (e) {}
      } catch (err) {
        console.error('Failed to fetch commission data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return (
    <div className="agent-space-y-6">
      <div className="agent-skeleton" style={{ height: '2.5rem', width: '33%', borderRadius: '0.5rem' }} />
      <div className="agent-skeleton" style={{ height: '10rem', borderRadius: '1rem' }} />
      <div className="agent-skeleton" style={{ height: '16rem', borderRadius: '1rem' }} />
    </div>
  );

  return (
    <div className="agent-space-y-10">

      <div>
        <h1 className="agent-h1">Commissions</h1>
        <p className="agent-subtitle">Track your earnings and payout history.</p>
      </div>

      {/* Overview Cards */}
      <div className="agent-grid-3">

        {/* Available Balance */}
        <div className="agent-card-lg" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="agent-flex-row agent-gap-4">
              <div className="agent-icon-badge gold"><FiDollarSign size={28} /></div>
              <div>
                <p className="agent-label-xs">Available Balance</p>
                <h2 className="agent-h2">{(stats?.commissionBalance || 0).toLocaleString()} ETB</h2>
              </div>
            </div>
            <button className="agent-btn-gold">WITHDRAW NOW</button>
          </div>
          {/* glow */}
          <div style={{ position:'absolute', top:0, right:0, width:'8rem', height:'8rem',
            background:'radial-gradient(circle, rgba(212,175,55,0.08), transparent 70%)',
            borderRadius:'50%', margin:'-2rem -2rem 0 0', pointerEvents:'none' }} />
        </div>

        {/* Total Earned */}
        <div className="agent-card-lg">
          <div className="agent-flex-row agent-gap-4">
            <div className="agent-icon-badge blue"><FiTrendingUp size={28} /></div>
            <div>
              <p className="agent-label-xs">Total Earned</p>
              <h2 className="agent-h2">{(stats?.totalCommissionEarned || 0).toLocaleString()} ETB</h2>
            </div>
          </div>
          <div className="agent-flex-between agent-mt-8" style={{
            padding: '1rem', background: 'rgba(0,0,0,0.2)',
            borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <span style={{ fontSize:'0.75rem', color:'#9ca3af', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>Fixed Commission Rate</span>
            <span className="agent-text-gold" style={{ fontWeight:900, fontSize:'1.125rem' }}>10%</span>
          </div>
        </div>

        {/* Tier Badge */}
        <div className="agent-card-lg agent-flex-center" style={{ flexDirection:'column', textAlign:'center' }}>
          <div style={{ width:'4rem', height:'4rem', background:'rgba(212,175,55,0.1)',
            borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'1rem' }}>
            <FiCheckCircle size={32} style={{ color:'var(--agent-gold)' }} />
          </div>
          <p className="agent-text-gold" style={{ fontWeight:900, fontSize:'0.75rem', letterSpacing:'0.15em', textTransform:'uppercase' }}>TOP AGENT TIER</p>
          <p className="agent-text-muted2" style={{ fontSize:'0.75rem', marginTop:'0.5rem', lineHeight:1.5 }}>
            You are in the highest commission bracket with priority support.
          </p>
        </div>
      </div>

      {/* History Table */}
      <div className="agent-table-wrap">
        <div className="agent-table-header">
          <h3 className="agent-h3">Recent Earnings</h3>
          <FiClock style={{ color:'var(--agent-muted)' }} />
        </div>
        <div className="agent-table-scroll">
          <table className="agent-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Source</th>
                <th>Amount</th>
                <th>Commission</th>
                <th className="right">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.length > 0 ? history.map((item: any, i: number) => (
                <tr key={i}>
                  <td>
                    <div className="agent-player-cell">
                      <div className="agent-avatar-sm">
                        {(item.firstName || 'P').substring(0, 2).toUpperCase()}
                      </div>
                      <span className="agent-player-name">{item.firstName || item.username}</span>
                    </div>
                  </td>
                  <td>Deposit Reward</td>
                  <td style={{ fontWeight:900, color:'#1c1917' }}>{(item.totalDeposited || 500).toLocaleString()} ETB</td>
                  <td className="agent-text-gold" style={{ fontWeight:900 }}>+{(item.totalDeposited ? item.totalDeposited * 0.1 : 50).toLocaleString()} ETB</td>
                  <td className="right">
                    <span className="agent-pill gold">CREDITED</span>
                  </td>
                </tr>
              )) : (
                <tr className="agent-table-empty">
                  <td colSpan={5}>No commission history found yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
