"use client";

import React, { useEffect, useState } from 'react';
import {
  FiUsers, FiTrendingUp, FiDollarSign,
  FiArrowUpRight, FiUserCheck, FiTarget, FiAlertTriangle, FiCheckCircle, FiSearch
} from 'react-icons/fi';
import api from '@/lib/api';
import { Pagination } from '@/components/Pagination';

export default function AgentDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const userRes = await api.get('/me');
        setUser(userRes.data);
        const statsRes = await api.get('/agent/stats');
        setStats(statsRes.data);
        fetchWithdrawals();
      } catch (err) {
        console.error('Failed to fetch agent stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  async function fetchWithdrawals() {
    try {
      setWithdrawalsLoading(true);
      const res = await api.get('/agent/withdrawals/pending');
      setWithdrawals(res.data || []);
    } catch (err) {
      console.error('Failed to fetch withdrawals:', err);
    } finally {
      setWithdrawalsLoading(false);
    }
  }

  async function handleWithdrawalAction(id: string, action: 'approve' | 'reject') {
    if (!window.confirm(`Are you sure you want to ${action} this withdrawal?`)) return;
    
    try {
      setActionLoading(id);
      await api.post(`/agent/withdrawals/${id}/${action}`, { reason: 'Processed by Branch Agent' });
      fetchWithdrawals();
      // Also refresh stats since balance might change
      const statsRes = await api.get('/agent/stats');
      setStats(statsRes.data);
    } catch (err) {
      console.error(`Failed to ${action} withdrawal:`, err);
      alert(`Error: Failed to ${action} withdrawal`);
    } finally {
      setActionLoading(null);
    }
  }

  useEffect(() => {
    fetchPlayers();
  }, [page]);

  async function fetchPlayers() {
    try {
      setPlayersLoading(true);
      const res = await api.get(`/agent/players?page=${page}`);
      setPlayers(res.data.users || []);
      setTotalPages(res.data.pages || 1);
    } catch (err) {
      console.error('Failed to fetch players:', err);
    } finally {
      setPlayersLoading(false);
    }
  }

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
    { label: 'My Players',          value: stats.playerCount,                                           icon: FiUsers,     trend: 'Live',   color: 'blue' },
    { label: 'Agent Wallet',        value: `${(stats.preDeposit?.balance || 0).toLocaleString()} ETB`,  icon: FiDollarSign,trend: stats.preDeposit?.state, color: stats.preDeposit?.state === 'GREEN' ? 'green' : stats.preDeposit?.state === 'YELLOW' ? 'gold' : 'red' },
    { label: 'Net Commission Paid', value: `${(stats.netCommissionPaid || 0).toLocaleString()} ETB`,   icon: FiTrendingUp, trend: 'To Admin', color: 'blue' },
    { label: 'Agent Take-Home',      value: `${(stats.agentTakeHome || 0).toLocaleString()} ETB`,      icon: FiUserCheck, trend: '18.75% Net', color: 'gold' },
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

      {/* Pre-Deposit Status Banner */}
      {stats.preDeposit && (
        <div className={`agent-status-banner ${stats.preDeposit.state.toLowerCase()}`} style={{
          padding: '1rem 1.5rem',
          borderRadius: '1rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          background: stats.preDeposit.state === 'GREEN' ? 'rgba(34, 197, 94, 0.1)' : stats.preDeposit.state === 'YELLOW' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${stats.preDeposit.state === 'GREEN' ? '#22c55e' : stats.preDeposit.state === 'YELLOW' ? '#eab308' : '#ef4444'}`,
        }}>
          {stats.preDeposit.state === 'GREEN' ? <FiCheckCircle color="#22c55e" size={24} /> : <FiAlertTriangle color={stats.preDeposit.state === 'YELLOW' ? '#eab308' : '#ef4444'} size={24} />}
          <div>
            <h4 style={{ color: '#fff', fontWeight: 700, margin: 0 }}>Wallet Status: {stats.preDeposit.state}</h4>
            <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0, fontSize: '0.875rem' }}>{stats.preDeposit.message}</p>
          </div>
          {stats.preDeposit.state !== 'GREEN' && (
            <div style={{ marginLeft: 'auto' }}>
              <button className="agent-btn-copy" style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }} onClick={() => window.open('https://t.me/bunabingosupport', '_blank')}>
                RECHARGE NOW
              </button>
            </div>
          )}
        </div>
      )}

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
          <h3 className="agent-h3">Your Profit Share</h3>
          <p className="agent-subtitle agent-mt-1">From the 25% house margin, you keep 75% as your profit.</p>
          <div className="agent-rate-display agent-mt-4">
            <span className="agent-rate-big">18.75%</span>
            <div className="agent-rate-meta">
              <p className="agent-text-white" style={{ fontWeight: 900, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Net Profit</p>
              <p className="agent-text-muted2" style={{ fontSize: '0.75rem' }}>Calculated from Total Sales</p>
            </div>
          </div>
          <div className="agent-mt-4 p-3 rounded" style={{ background: 'rgba(255,255,255,0.05)', fontSize: '0.8rem' }}>
            <p className="agent-text-muted2" style={{ margin: 0 }}>
              • House Margin: 25%<br/>
              • Admin Cut: 6.25% (Pre-Deposit)<br/>
              • <b>Your Take: 18.75%</b>
            </p>
          </div>
        </div>
      </div>

      {/* Pending Withdrawals Section */}
      <div className="agent-card-lg" style={{ marginTop: '2rem', border: withdrawals.length > 0 ? '1px solid #d4af37' : '1px solid rgba(255,255,255,0.05)' }}>
        <div className="agent-flex-between" style={{ marginBottom: '1.5rem' }}>
          <div>
            <h3 className="agent-h3">Pending Withdrawals</h3>
            <p className="agent-subtitle">Requests from your branch players that need approval.</p>
          </div>
          <div className={`agent-icon-badge ${withdrawals.length > 0 ? 'gold' : 'blue'}`}>
            <FiArrowUpRight size={20} />
          </div>
        </div>

        <div className="data-table-container" style={{ background: 'transparent', border: 'none' }}>
           <table className="data-table">
             <thead>
               <tr style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                 <th style={{ textAlign: 'left', padding: '1rem' }}>Player</th>
                 <th style={{ textAlign: 'left', padding: '1rem' }}>Amount</th>
                 <th style={{ textAlign: 'left', padding: '1rem' }}>Bank / Account</th>
                 <th style={{ textAlign: 'right', padding: '1rem' }}>Actions</th>
               </tr>
             </thead>
             <tbody>
               {withdrawalsLoading ? (
                 <tr>
                    <td colSpan={4} style={{ padding: '3rem', textAlign: 'center' }}>
                       <div className="animate-spin" style={{ width: '24px', height: '24px', border: '2px solid #d4af37', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }}></div>
                    </td>
                 </tr>
               ) : withdrawals.length === 0 ? (
                 <tr>
                    <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                       No pending withdrawals. You're all caught up!
                    </td>
                 </tr>
               ) : withdrawals.map((wd) => (
                 <tr key={wd.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1rem' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>{wd.user?.firstName?.[0] || 'P'}</div>
                          <div>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>{wd.user?.firstName}</div>
                                {wd.user?.wallet && (
                                   <span 
                                     style={{ 
                                       fontSize: '10px', 
                                       padding: '2px 6px', 
                                       fontWeight: '800', 
                                       background: wd.user.isBalanceLegit ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                       color: wd.user.isBalanceLegit ? '#4ade80' : '#f87171',
                                       borderRadius: '4px'
                                     }}
                                   >
                                     Bal: {Number(wd.user.wallet.balance).toFixed(2)} ETB {wd.user.isBalanceLegit ? '✓' : '⚠️'}
                                   </span>
                                )}
                             </div>
                             <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>@{wd.user?.telegramUsername || 'no_user'}</div>
                          </div>
                       </div>
                    </td>
                   <td style={{ padding: '1rem', color: '#fff', fontWeight: 800 }}>
                      {Number(wd.amount).toLocaleString()} <span style={{ color: '#d4af37', fontSize: '0.7rem' }}>ETB</span>
                   </td>
                   <td style={{ padding: '1rem' }}>
                      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>{wd.bankName}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>{wd.accountNumber}</div>
                   </td>
                   <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                         <button 
                           onClick={() => handleWithdrawalAction(wd.id, 'reject')}
                           disabled={!!actionLoading}
                           className="agent-btn-copy" 
                           style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', fontSize: '0.7rem', padding: '0.4rem 0.8rem' }}
                         >
                           REJECT
                         </button>
                         <button 
                           onClick={() => handleWithdrawalAction(wd.id, 'approve')}
                           disabled={!!actionLoading}
                           className="agent-btn-copy" 
                           style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid #22c55e', fontSize: '0.7rem', padding: '0.4rem 0.8rem' }}
                         >
                           {actionLoading === wd.id ? '...' : 'APPROVE'}
                         </button>
                      </div>
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
      </div>

      {/* Branch Players Table */}
      <div className="agent-card-lg" style={{ marginTop: '2rem' }}>
        <div className="agent-flex-between" style={{ marginBottom: '1.5rem' }}>
          <div>
            <h3 className="agent-h3">Branch Players</h3>
            <p className="agent-subtitle">All players joined through your referral link.</p>
          </div>
          <div className="agent-icon-badge blue">
            <FiUsers size={20} />
          </div>
        </div>

        <div className="data-table-container" style={{ background: 'transparent', border: 'none' }}>
           <table className="data-table">
             <thead>
               <tr style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                 <th style={{ textAlign: 'left', padding: '1rem' }}>Player</th>
                 <th style={{ textAlign: 'left', padding: '1rem' }}>Joined</th>
                 <th style={{ textAlign: 'left', padding: '1rem' }}>Balance</th>
                 <th style={{ textAlign: 'right', padding: '1rem' }}>Status</th>
               </tr>
             </thead>
             <tbody>
               {playersLoading ? (
                 <tr>
                    <td colSpan={4} style={{ padding: '3rem', textAlign: 'center' }}>
                       <div className="animate-spin" style={{ width: '24px', height: '24px', border: '2px solid #d4af37', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }}></div>
                    </td>
                 </tr>
               ) : players.length === 0 ? (
                 <tr>
                    <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                       No players in your branch yet. Share your link!
                    </td>
                 </tr>
               ) : players.map((player) => (
                 <tr key={player.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                   <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                         <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>{player.firstName?.[0] || 'P'}</div>
                         <div>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>{player.firstName}</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>@{player.telegramUsername || 'no_user'}</div>
                         </div>
                      </div>
                   </td>
                   <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
                      {new Date(player.createdAt).toLocaleDateString()}
                   </td>
                   <td style={{ padding: '1rem', color: '#fff', fontWeight: 800 }}>
                      {Number(player.wallet?.balance || 0).toLocaleString()} <span style={{ color: '#d4af37', fontSize: '0.7rem' }}>ETB</span>
                   </td>
                   <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>ACTIVE</span>
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>

        <Pagination 
          currentPage={page} 
          totalPages={totalPages} 
          onPageChange={setPage} 
          loading={playersLoading}
        />
      </div>

    </div>
  );
}
