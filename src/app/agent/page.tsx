"use client";

import React, { useEffect, useState } from 'react';
import {
  FiUsers, FiTrendingUp, FiDollarSign,
  FiArrowUpRight, FiUserCheck, FiTarget
} from 'react-icons/fi';
import api from '@/lib/api';

export default function AgentDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const userRes = await api.get('/me');
        setUser(userRes.data);
        const statsRes = await api.get('/agent/stats');
        setStats(statsRes.data);
      } catch (err) {
        console.error('Failed to fetch agent stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleCopy = () => {
    if (!user) return;
    navigator.clipboard.writeText(`t.me/BunaBingoBot?start=${user.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !stats || !user) {
    return (
      <div className="agent-stat-grid" style={{ padding: '0' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="agent-skeleton" style={{ height: '8rem' }} />
        ))}
      </div>
    );
  }

  const statCards = [
    { label: 'My Players',          value: stats.playerCount,                                           icon: FiUsers,     trend: '+5%',   color: 'blue' },
    { label: 'Deposit Volume',       value: `${(stats.totalDeposits || 0).toLocaleString()} ETB`,        icon: FiTrendingUp,trend: '+18%',  color: 'gold' },
    { label: 'Commission Balance',   value: `${(stats.commissionBalance || 0).toLocaleString()} ETB`,    icon: FiDollarSign,trend: 'Live',  color: 'gold' },
    { label: 'Total Earned',         value: `${(stats.totalCommissionEarned || 0).toLocaleString()} ETB`,icon: FiUserCheck, trend: 'All-time', color: 'gold' },
  ];

  return (
    <div className="agent-space-y-10">

      {/* Header */}
      <div className="agent-page-header">
        <div>
          <h1 className="agent-h1">Branch Overview</h1>
          <p className="agent-subtitle">Monitor your performance and track your player activity.</p>
        </div>
        <div className="agent-tier-badge">
          <FiTarget size={14} />
          Top Agent Tier
        </div>
      </div>

      {/* Stat Cards */}
      <div className="agent-stat-grid">
        {statCards.map((card, i) => (
          <div key={i} className="agent-card">
            <div className="agent-card-glow" />
            <div className="agent-flex-between">
              <div className={`agent-icon-badge ${card.color}`}>
                <card.icon size={24} />
              </div>
              <div className="agent-trend up">
                <FiArrowUpRight size={14} style={{ marginRight: 2 }} />
                {card.trend}
              </div>
            </div>
            <p className="agent-stat-label">{card.label}</p>
            <h2 className="agent-stat-value">{card.value}</h2>
          </div>
        ))}
      </div>

      {/* Info Boxes */}
      <div className="agent-grid-2">
        {/* Referral Link */}
        <div className="agent-card-gold">
          <h3 className="agent-h3">Your Referral Link</h3>
          <p className="agent-subtitle agent-mt-1">New users who join using this link will be added to your branch.</p>
          <div className="agent-referral-box agent-mt-6">
            <code>t.me/BunaBingoBot?start={user.id}</code>
            <button className="agent-btn-copy" onClick={handleCopy}>
              {copied ? 'COPIED!' : 'COPY LINK'}
            </button>
          </div>
        </div>

        {/* Commission Rate */}
        <div className="agent-card-lg">
          <h3 className="agent-h3">Commission Rate</h3>
          <p className="agent-subtitle agent-mt-1">You earn a percentage of every deposit made by your players.</p>
          <div className="agent-rate-display agent-mt-4">
            <span className="agent-rate-big">10%</span>
            <div className="agent-rate-meta">
              <p className="agent-text-white" style={{ fontWeight: 900, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Fixed Rate</p>
              <p className="agent-text-muted2" style={{ fontSize: '0.75rem' }}>Standard Agent Commission</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
