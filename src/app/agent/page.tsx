"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  FiUsers, FiTrendingUp, FiDollarSign, FiActivity,
  FiArrowUpRight, FiUserCheck, FiTarget, FiAlertTriangle, FiCheckCircle, FiSearch,
  FiCalendar, FiChevronDown, FiArrowRight, FiDownload, FiUpload, FiPlay, FiInfo,
  FiPieChart
} from 'react-icons/fi';
import api from '@/lib/api';
import { Pagination } from '@/components/Pagination';

function AgentDashboardContent() {
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

  const searchParams = useSearchParams();
  const router = useRouter();
  const dateParam = searchParams.get('date') || '';

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const userRes = await api.get('/me');
        setUser(userRes.data);
        
        const url = dateParam ? `/agent/stats?date=${dateParam}` : '/agent/stats';
        const statsRes = await api.get(url);
        setStats(statsRes.data);
        
        // Fetch withdrawals on initial load
        const withdrawalsRes = await api.get('/agent/withdrawals/pending');
        setWithdrawals(withdrawalsRes.data || []);
      } catch (err) {
        console.error('Failed to fetch agent stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dateParam]);

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
      // Refresh stats
      const url = dateParam ? `/agent/stats?date=${dateParam}` : '/agent/stats';
      const statsRes = await api.get(url);
      setStats(statsRes.data);
    } catch (err) {
      console.error(`Failed to ${action} withdrawal:`, err);
      alert(`Error: Failed to ${action} withdrawal`);
    } finally {
      setActionLoading(null);
    }
  }

  const handleCopy = () => {
    if (!user) return;
    navigator.clipboard.writeText(`https://t.me/buna_bingobot?start=${user.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !stats || !user) {
    return (
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="premium-stat-card animate-pulse" style={{ height: '160px' }}></div>
        ))}
      </div>
    );
  }

  // Date label formatting
  const formattedDateLabel = (() => {
    try {
      const activeDateStr = dateParam || (() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      })();
      const [year, month, day] = activeDateStr.split('-');
      const date = new Date(Number(year), Number(month) - 1, Number(day));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return 'TODAY';
    }
  })();

  // Scoped agent variables
  const globalSales = Number(stats.totalSales || 0);
  const companyRevenue = Number(stats.netCommissionPaid || 0); // Real amount deducted from pre-deposit (real players only)
  const agentRevenue = Number(stats.agentTakeHome || 0);
  const totalPlayers = stats.playerCount || 0;
  const activePlayers = stats.activePlayers || 0;
  const activeGames = stats.activeGames || 0;

  const preDepositAdded = Number(stats.preDeposit?.totalAdded || 0);
  const preDepositBalance = Number(stats.preDeposit?.balance || 0);
  const preDepositPercent = preDepositAdded > 0 ? (preDepositBalance / preDepositAdded) * 100 : 0;

  return (
    <div className="admin-page">
      {/* Premium Sub-Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '36px', fontWeight: '900', margin: 0, color: '#3d2b1f', fontFamily: 'Inter, sans-serif' }}>
            WELCOME, {(user.firstName || 'AGENT').toUpperCase()} 👋
          </h1>
          <p style={{ color: '#8c857b', marginTop: '4px', fontSize: '15px', fontWeight: '500' }}>
            Here is your branch performance overview for today.
          </p>
        </div>

        {/* Date Selector Pill */}
        <div style={{ position: 'relative' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            background: '#ffffff', 
            border: '1px solid rgba(0, 0, 0, 0.06)', 
            borderRadius: '12px', 
            padding: '10px 16px', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            cursor: 'pointer',
            fontWeight: '600',
            color: '#3d2b1f',
            fontSize: '14px'
          }}>
            <FiCalendar size={16} style={{ color: '#8c857b' }} />
            <span>{formattedDateLabel}</span>
            <FiChevronDown size={16} style={{ color: '#8c857b' }} />
            <input 
              type="date" 
              value={dateParam || new Date().toISOString().split('T')[0]} 
              onChange={(e) => {
                const val = e.target.value;
                router.push(val ? `/agent?date=${val}` : '/agent');
              }}
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100%', 
                opacity: 0, 
                cursor: 'pointer' 
              }}
            />
          </div>
        </div>
      </div>

      {/* Pre-Deposit Status Banner */}
      {stats.preDeposit && (
        <div className={`agent-status-banner ${(stats.preDeposit.state || 'GREEN').toLowerCase()}`} style={{
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
            <h4 style={{ color: '#1c1917', fontWeight: 800, margin: 0 }}>Wallet Status: {stats.preDeposit.state}</h4>
            <p style={{ color: '#5c554b', margin: 0, fontSize: '0.875rem' }}>{stats.preDeposit.message}</p>
          </div>
          {stats.preDeposit.state !== 'GREEN' && (
            <div style={{ marginLeft: 'auto' }}>
              <button className="agent-btn-copy" style={{ fontSize: '0.75rem', padding: '0.5rem 1rem', background: '#3d2b1f', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }} onClick={() => window.open('https://t.me/Luel1616', '_blank')}>
                RECHARGE NOW
              </button>
            </div>
          )}
        </div>
      )}

      {/* Six Stat Cards Grid */}
      <div className="stat-grid-6">
        <div className="premium-stat-card">
          <div className="card-top-row">
            <div className="card-icon-container">
              <FiPieChart size={20} />
            </div>
            <span className="card-pill">Gross Volume</span>
          </div>
          <div className="card-body">
            <div className="card-label">TOTAL STAKE</div>
            <div className="card-value">{globalSales.toLocaleString()} ETB</div>
            <div className="card-subtext">All Bets Placed</div>
          </div>
        </div>

        <div className="premium-stat-card">
          <div className="card-top-row">
            <div className="card-icon-container">
              <FiDollarSign size={20} />
            </div>
            <span className="card-pill" style={{ color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)' }}>25% Share</span>
          </div>
          <div className="card-body">
            <div className="card-label">COMPANY REVENUE</div>
            <div className="card-value">{companyRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</div>
            <div className="card-subtext">12.5% of Total Stake</div>
          </div>
        </div>

        <div className="premium-stat-card">
          <div className="card-top-row">
            <div className="card-icon-container">
              <FiUsers size={20} />
            </div>
            <span className="card-pill" style={{ color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)' }}>25% Share</span>
          </div>
          <div className="card-body">
            <div className="card-label">AGENT REVENUE</div>
            <div className="card-value">{agentRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</div>
            <div className="card-subtext">12.5% of Total Stake</div>
          </div>
        </div>

        <div className="premium-stat-card">
          <div className="card-top-row">
            <div className="card-icon-container">
              <FiUsers size={20} />
            </div>
            <span className="card-pill" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)' }}>All Time</span>
          </div>
          <div className="card-body">
            <div className="card-label">TOTAL PLAYERS</div>
            <div className="card-value">{totalPlayers}</div>
            <div className="card-subtext">Registered Players</div>
          </div>
        </div>

        <div className="premium-stat-card">
          <div className="card-top-row">
            <div className="card-icon-container">
              <FiActivity size={20} />
            </div>
            <span className="card-pill" style={{ color: '#eab308', background: 'rgba(234, 179, 8, 0.1)' }}>Running Now</span>
          </div>
          <div className="card-body">
            <div className="card-label">ACTIVE PLAYERS</div>
            <div className="card-value">{activePlayers}</div>
            <div className="card-subtext">Active Today</div>
          </div>
        </div>

        <div className="premium-stat-card">
          <div className="card-top-row">
            <div className="card-icon-container">
              <FiPlay size={20} />
            </div>
            <span className="card-pill" style={{ color: '#ec4899', background: 'rgba(236, 72, 153, 0.1)' }}>Running Now</span>
          </div>
          <div className="card-body">
            <div className="card-label">ACTIVE GAMES</div>
            <div className="card-value">{activeGames}</div>
            <div className="card-subtext">Games Running</div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="dashboard-grid" style={{ marginBottom: '40px' }}>
        <div>
          {/* Platform Overview */}
          <div className="premium-card">
            <h3 className="premium-card-title">PLATFORM OVERVIEW</h3>
            
            <div className="overview-row" style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.05)', paddingBottom: '16px' }}>
              <div className="overview-row-left">
                <div className="overview-icon-wrapper green" style={{ width: '40px', height: '40px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FiDownload size={18} />
                </div>
                <div>
                  <div className="overview-row-title" style={{ fontSize: '14px', fontWeight: '700', color: '#1c1917' }}>Pre Deposit</div>
                  <div className="overview-row-subtitle" style={{ fontSize: '12px', color: '#8c857b' }}>Total funds added to platform</div>
                </div>
              </div>
              <div className="overview-row-value green" style={{ fontSize: '15px', fontWeight: '800', color: '#22c55e' }}>
                {preDepositAdded.toLocaleString()} ETB
              </div>
            </div>

            <div className="overview-row" style={{ paddingTop: '16px' }}>
              <div className="overview-row-left">
                <div className="overview-icon-wrapper red" style={{ width: '40px', height: '40px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FiUpload size={18} />
                </div>
                <div>
                  <div className="overview-row-title" style={{ fontSize: '14px', fontWeight: '700', color: '#1c1917' }}>Available Balance</div>
                  <div className="overview-row-subtitle" style={{ fontSize: '12px', color: '#8c857b' }}>Remaining from pre deposit</div>
                </div>
              </div>
              <div className="overview-row-value green" style={{ fontSize: '15px', fontWeight: '800', color: '#22c55e' }}>
                {preDepositBalance.toLocaleString()} ETB
              </div>
            </div>

            {/* Custom Progress Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
              <div style={{ flex: 1, height: '8px', background: '#f1efe9', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(preDepositPercent, 100)}%`, height: '100%', background: '#22c55e', borderRadius: '999px', transition: 'width 0.4s ease' }} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#8c857b', minWidth: '50px', textAlign: 'right' }}>
                {preDepositPercent.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* How Commission Works Card */}
          <div className="premium-card">
            <h3 className="premium-card-title" style={{ fontSize: '14px', fontWeight: '900', borderBottom: 'none', paddingBottom: 0, marginBottom: '8px' }}>
              HOW COMMISSION WORKS (25% PER GAME)
            </h3>
            <p style={{ fontSize: '13px', color: '#8c857b', marginBottom: '20px', lineHeight: '1.5' }}>
              For every bet placed on any game, 25% of the stake goes to the company and 75% goes to winners.
            </p>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: '#faf8f5', borderRadius: '16px', padding: '16px 12px', border: '1px solid rgba(0,0,0,0.03)', margin: '16px 0' }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '10px', fontWeight: '800', color: '#8c857b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Stake</div>
                <div style={{ fontSize: '14px', fontWeight: '900', color: '#3d2b1f', marginTop: '4px' }}>100 ETB</div>
              </div>
              
              <div style={{ color: '#d4cbbd', display: 'flex', alignItems: 'center' }}>
                <FiArrowRight size={18} />
              </div>
              
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '10px', fontWeight: '800', color: '#8c857b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Company (25%)</div>
                <div style={{ fontSize: '14px', fontWeight: '900', color: '#3d2b1f', marginTop: '4px' }}>25 ETB</div>
              </div>
              
              <div style={{ color: '#d4cbbd', display: 'flex', alignItems: 'center' }}>
                <FiArrowRight size={18} />
              </div>
              
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '10px', fontWeight: '800', color: '#8c857b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Winners (75%)</div>
                <div style={{ fontSize: '14px', fontWeight: '900', color: '#3d2b1f', marginTop: '4px' }}>75 ETB</div>
              </div>
            </div>
            
            <p style={{ fontSize: '12px', color: '#8c857b', fontStyle: 'italic', margin: 0 }}>
              This is the same for all games on the platform.
            </p>
          </div>
        </div>

        <div>
          {/* Daily Summary */}
          <div className="premium-card">
            <div className="summary-header-row" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '12px', marginBottom: '16px' }}>
              <span className="summary-header-title">DAILY SUMMARY</span>
              <span className="summary-header-date">TODAY ({formattedDateLabel})</span>
            </div>
            
            <table className="premium-table">
              <thead>
                <tr>
                  <th>METRIC</th>
                  <th className="text-right">TODAY ({formattedDateLabel})</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Total Stake (Gross)</td>
                  <td className="text-right" style={{ fontWeight: '700' }}>{globalSales.toLocaleString()} ETB</td>
                </tr>
                <tr>
                  <td>Total Service Fee (25%)</td>
                  <td className="text-right" style={{ fontWeight: '700' }}>{(globalSales * 0.25).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</td>
                </tr>
                <tr className="highlighted-row">
                  <td>Company Revenue (25%)</td>
                  <td className="text-right">{companyRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</td>
                </tr>
                <tr className="highlighted-row">
                  <td>Agent Revenue (25%)</td>
                  <td className="text-right">{agentRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</td>
                </tr>
                <tr>
                  <td>Total Players</td>
                  <td className="text-right" style={{ fontWeight: '700' }}>{totalPlayers}</td>
                </tr>
                <tr>
                  <td>Active Players</td>
                  <td className="text-right" style={{ fontWeight: '700' }}>{activePlayers}</td>
                </tr>
                <tr>
                  <td>Active Games</td>
                  <td className="text-right" style={{ fontWeight: '700' }}>{activeGames}</td>
                </tr>
              </tbody>
            </table>

            {/* Revenue Split Info Box */}
            <div className="revenue-split-box">
              <div className="revenue-split-title">
                <FiInfo size={14} />
                <span>REVENUE SPLIT (PER 100 ETB STAKE)</span>
              </div>
              <ul className="revenue-split-list">
                <li className="revenue-split-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#d4af37', fontWeight: 'bold' }}>•</span>
                  <span>75% goes to Winners (75 ETB)</span>
                </li>
                <li className="revenue-split-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#d4af37', fontWeight: 'bold' }}>•</span>
                  <span>12.5% goes to Company (12.5 ETB)</span>
                </li>
                <li className="revenue-split-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#d4af37', fontWeight: 'bold' }}>•</span>
                  <span>12.5% goes to Agent (12.5 ETB)</span>
                </li>
              </ul>
            </div>

            {/* Bottom Info Pill */}
            <div className="info-pill" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiInfo size={12} />
              <span>All amounts are in ETB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Referral Link & Profit Share Section */}
      <div className="agent-grid-2" style={{ gap: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', marginBottom: '40px' }}>
        {/* Referral Link */}
        <div className="agent-card-gold" style={{ background: 'linear-gradient(135deg, #faf8f5, #f5f2eb)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '24px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <h3 className="agent-h3" style={{ fontSize: '18px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>Your Referral Link</h3>
          <p className="agent-subtitle agent-mt-1" style={{ fontSize: '13px', color: '#8c857b', marginTop: '6px' }}>New users who join using this link will be added to your branch.</p>
          <div className="agent-referral-box agent-mt-6" style={{ display: 'flex', background: '#ffffff', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)', padding: '10px 14px', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '20px' }}>
            <code style={{ fontSize: '13px', color: '#3d2b1f', fontWeight: '700', wordBreak: 'break-all' }}>t.me/buna_bingobot?start={user.id}</code>
            <button className="agent-btn-copy" style={{ background: '#3d2b1f', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: '800', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }} onClick={handleCopy}>
              {copied ? 'COPIED!' : 'COPY'}
            </button>
          </div>
        </div>

        {/* Commission Rate */}
        <div className="agent-card-lg" style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '24px', padding: '24px' }}>
          <h3 className="agent-h3" style={{ fontSize: '18px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>Your Profit Share</h3>
          <p className="agent-subtitle agent-mt-1" style={{ fontSize: '13px', color: '#8c857b', marginTop: '6px' }}>From the 25% house margin, you keep 50% as your branch profit.</p>
          <div className="agent-rate-display agent-mt-4" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
            <span className="agent-rate-big" style={{ fontSize: '32px', fontWeight: '900', color: '#d4af37' }}>12.50%</span>
            <div className="agent-rate-meta">
              <p className="agent-text-white" style={{ fontWeight: 900, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3d2b1f', margin: 0 }}>Net Profit</p>
              <p className="agent-text-muted2" style={{ fontSize: '11px', color: '#8c857b', margin: 0 }}>Calculated from Total Sales</p>
            </div>
          </div>
          <div className="agent-mt-4 p-3 rounded" style={{ background: '#faf8f5', border: '1px solid rgba(0,0,0,0.03)', borderRadius: '12px', padding: '12px', fontSize: '12px', marginTop: '16px', color: '#5c554b' }}>
            <p className="agent-text-muted2" style={{ margin: 0, lineHeight: '1.6' }}>
              • House Margin: 25%<br/>
              • Admin Cut: 12.5% (Pre-Deposit)<br/>
              • <b>Your Take: 12.5%</b>
            </p>
          </div>
        </div>
      </div>

      {/* Pending Withdrawals Section */}
      <div className="agent-card-lg" style={{ background: '#ffffff', border: withdrawals.length > 0 ? '1px solid #d4af37' : '1px solid rgba(0,0,0,0.05)', borderRadius: '24px', padding: '24px', marginBottom: '40px' }}>
        <div className="agent-flex-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 className="agent-h3" style={{ fontSize: '18px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>Pending Withdrawals</h3>
            <p className="agent-subtitle" style={{ fontSize: '13px', color: '#8c857b', marginTop: '4px' }}>Requests from your branch players that need approval.</p>
          </div>
          <div className={`agent-icon-badge ${withdrawals.length > 0 ? 'gold' : 'blue'}`} style={{ color: withdrawals.length > 0 ? '#d4af37' : '#3b82f6', background: withdrawals.length > 0 ? 'rgba(212,175,55,0.1)' : 'rgba(59,130,246,0.1)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiArrowUpRight size={20} />
          </div>
        </div>

        <div className="data-table-container" style={{ background: 'transparent', border: 'none', overflowX: 'auto' }}>
           <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
             <thead>
               <tr style={{ color: '#8c857b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                 <th style={{ textAlign: 'left', padding: '12px 8px' }}>Player</th>
                 <th style={{ textAlign: 'left', padding: '12px 8px' }}>Amount</th>
                 <th style={{ textAlign: 'left', padding: '12px 8px' }}>Bank / Account</th>
                 <th style={{ textAlign: 'right', padding: '12px 8px' }}>Actions</th>
               </tr>
             </thead>
             <tbody>
               {withdrawalsLoading ? (
                 <tr>
                    <td colSpan={4} style={{ padding: '3rem', textAlign: 'center' }}>
                       <div className="animate-spin" style={{ width: '24px', height: '24px', border: '2px solid #3d2b1f', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }}></div>
                    </td>
                 </tr>
               ) : withdrawals.length === 0 ? (
                 <tr>
                    <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: '#8c857b', fontSize: '13px' }}>
                       No pending withdrawals. You're all caught up!
                    </td>
                 </tr>
               ) : withdrawals.map((wd) => (
                 <tr key={wd.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                    <td style={{ padding: '14px 8px' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '12px', background: '#faf8f5', border: '1px solid rgba(0,0,0,0.05)', color: '#3d2b1f', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>{wd.user?.firstName?.[0] || 'P'}</div>
                          <div>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ color: '#1c1917', fontWeight: 700, fontSize: '0.9rem' }}>{wd.user?.firstName}</div>
                                {wd.user?.wallet && (
                                   <span 
                                     style={{ 
                                       fontSize: '10px', 
                                       padding: '2px 6px', 
                                       fontWeight: '800', 
                                       background: wd.user.isBalanceLegit ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                       color: wd.user.isBalanceLegit ? '#22c55e' : '#ef4444',
                                       borderRadius: '4px'
                                     }}
                                   >
                                     Bal: {Number(wd.user.wallet.balance).toFixed(2)} ETB {wd.user.isBalanceLegit ? '✓' : '⚠️'}
                                   </span>
                                )}
                             </div>
                             <div style={{ color: '#8c857b', fontSize: '0.75rem' }}>@{wd.user?.telegramUsername || 'no_user'}</div>
                          </div>
                       </div>
                    </td>
                   <td style={{ padding: '14px 8px', color: '#1c1917', fontWeight: 800 }}>
                      {Number(wd.amount).toLocaleString()} <span style={{ color: '#8c857b', fontSize: '0.75rem' }}>ETB</span>
                   </td>
                   <td style={{ padding: '14px 8px' }}>
                      <div style={{ color: '#1c1917', fontSize: '0.85rem', fontWeight: '700' }}>{wd.bankName}</div>
                      <div style={{ color: '#8c857b', fontSize: '0.75rem' }}>{wd.accountNumber}</div>
                   </td>
                   <td style={{ padding: '14px 8px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                         <button 
                           onClick={() => handleWithdrawalAction(wd.id, 'reject')}
                           disabled={!!actionLoading}
                           className="agent-btn-copy" 
                           style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', fontSize: '11px', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}
                         >
                           REJECT
                         </button>
                         <button 
                           onClick={() => handleWithdrawalAction(wd.id, 'approve')}
                           disabled={!!actionLoading}
                           className="agent-btn-copy" 
                           style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid #22c55e', fontSize: '11px', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}
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
      <div className="agent-card-lg" style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '24px', padding: '24px' }}>
        <div className="agent-flex-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 className="agent-h3" style={{ fontSize: '18px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>Branch Players</h3>
            <p className="agent-subtitle" style={{ fontSize: '13px', color: '#8c857b', marginTop: '4px' }}>All players joined through your referral link.</p>
          </div>
          <div className="agent-icon-badge blue" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiUsers size={20} />
          </div>
        </div>

        <div className="data-table-container" style={{ background: 'transparent', border: 'none', overflowX: 'auto' }}>
           <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
             <thead>
               <tr style={{ color: '#8c857b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                 <th style={{ textAlign: 'left', padding: '12px 8px' }}>Player</th>
                 <th style={{ textAlign: 'left', padding: '12px 8px' }}>Joined</th>
                 <th style={{ textAlign: 'left', padding: '12px 8px' }}>Balance</th>
                 <th style={{ textAlign: 'right', padding: '12px 8px' }}>Status</th>
               </tr>
             </thead>
             <tbody>
               {playersLoading ? (
                 <tr>
                    <td colSpan={4} style={{ padding: '3rem', textAlign: 'center' }}>
                       <div className="animate-spin" style={{ width: '24px', height: '24px', border: '2px solid #3d2b1f', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }}></div>
                    </td>
                 </tr>
               ) : players.length === 0 ? (
                 <tr>
                    <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: '#8c857b', fontSize: '13px' }}>
                       No players in your branch yet. Share your link!
                    </td>
                 </tr>
               ) : players.map((player) => (
                 <tr key={player.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                   <td style={{ padding: '14px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                         <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '12px', background: '#faf8f5', border: '1px solid rgba(0,0,0,0.05)', color: '#3d2b1f', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>{player.firstName?.[0] || 'P'}</div>
                         <div>
                            <div style={{ color: '#1c1917', fontWeight: 700, fontSize: '0.9rem' }}>{player.firstName}</div>
                            <div style={{ color: '#8c857b', fontSize: '0.75rem' }}>@{player.telegramUsername || 'no_user'}</div>
                         </div>
                      </div>
                   </td>
                   <td style={{ padding: '14px 8px', color: '#5c554b', fontSize: '13px' }}>
                      {new Date(player.createdAt).toLocaleDateString()}
                   </td>
                   <td style={{ padding: '14px 8px', color: '#1c1917', fontWeight: 800 }}>
                      {Number(player.wallet?.balance || 0).toLocaleString()} <span style={{ color: '#8c857b', fontSize: '0.75rem' }}>ETB</span>
                   </td>
                   <td style={{ padding: '14px 8px', textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)', padding: '4px 10px', borderRadius: '999px', fontWeight: '800' }}>ACTIVE</span>
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

export default function AgentDashboard() {
  return (
    <Suspense fallback={
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="premium-stat-card animate-pulse" style={{ height: '160px' }}></div>
        ))}
      </div>
    }>
      <AgentDashboardContent />
    </Suspense>
  );
}
