"use client";

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  FiUsers, FiTrendingUp, FiDollarSign, FiActivity,
  FiArrowUpRight, FiCheckCircle, FiAlertTriangle,
  FiCalendar, FiChevronDown, FiArrowRight, FiDownload, FiUpload,
  FiPlay, FiInfo, FiRefreshCw, FiCopy, FiLink, FiZap
} from 'react-icons/fi';
import api from '@/lib/api';
import { Pagination } from '@/components/Pagination';

function AgentDashboardContent() {
  const [stats, setStats] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const [players, setPlayers] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [playersLoading, setPlayersLoading] = useState(false);

  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const dateParam = searchParams.get('date') || '';

  const fetchStats = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const userRes = await api.get('/me');
      setUser(userRes.data);
      const url = dateParam ? `/agent/stats?date=${dateParam}` : '/agent/stats';
      const statsRes = await api.get(url);
      setStats(statsRes.data);
      const withdrawalsRes = await api.get('/agent/withdrawals/pending');
      setWithdrawals(withdrawalsRes.data || []);
    } catch (err) {
      console.error('Failed to fetch agent stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateParam]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => { fetchPlayers(); }, [page]);

  async function fetchPlayers() {
    try {
      setPlayersLoading(true);
      const res = await api.get(`/agent/players?page=${page}&limit=10`);
      setPlayers(res.data.users || []);
      setTotalPages(res.data.pages || 1);
      setTotalPlayers(res.data.total || 0);
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
      fetchStats(true);
    } catch (err) {
      console.error(`Failed to ${action} withdrawal:`, err);
      alert(`Error: Failed to ${action} withdrawal`);
    } finally {
      setActionLoading(null);
    }
  }

  const referralToken = user?.referralCode || user?.id || '';
  const referralLink = `https://t.me/buna_bingobot?start=${referralToken}`;

  const handleCopy = () => {
    if (!user) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDateLabel = (() => {
    try {
      const activeDateStr = dateParam || (() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      })();
      const [year, month, day] = activeDateStr.split('-');
      const date = new Date(Number(year), Number(month) - 1, Number(day));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return 'TODAY'; }
  })();

  if (loading || !stats || !user) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="premium-stat-card animate-pulse" style={{ height: '140px' }} />
          ))}
        </div>
      </div>
    );
  }

  const globalSales = Number(stats.totalSales || 0);
  const agentRevenue = Number(stats.agentTakeHome || 0);
  const agentRatePct = stats.agentRatePct ?? 10; // from backend — dynamic
  const activePlayers = stats.activePlayers || 0;
  const activeGames = stats.activeGames || 0;
  const totalDeposits = Number(stats.totalDeposits || 0);
  const netCommissionPaid = Number(stats.netCommissionPaid || 0);

  const preDepositAdded = Number(stats.preDeposit?.totalAdded || 0);
  const preDepositBalance = Number(stats.preDeposit?.balance || 0);
  const preDepositPercent = preDepositAdded > 0 ? (preDepositBalance / preDepositAdded) * 100 : 0;
  const preDepositState = stats.preDeposit?.state || 'GREEN';

  const stateColor = preDepositState === 'GREEN' ? '#22c55e' : preDepositState === 'YELLOW' ? '#eab308' : '#ef4444';
  const stateBg = preDepositState === 'GREEN' ? 'rgba(34,197,94,0.1)' : preDepositState === 'YELLOW' ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)';

  return (
    <div className="admin-page">

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '900', margin: 0, color: '#3d2b1f', fontFamily: 'Inter, sans-serif' }}>
            👋 {user.firstName || 'Agent'}'s Dashboard
          </h1>
          <p style={{ color: '#8c857b', marginTop: '4px', fontSize: '13px', fontWeight: '500' }}>
            Branch performance overview • {formattedDateLabel}
            {withdrawals.length > 0 && (
              <span style={{ marginLeft: '10px', background: '#ef4444', color: '#fff', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '999px' }}>
                {withdrawals.length} pending
              </span>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Refresh */}
          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            title="Refresh data"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: '10px', padding: '9px 14px', cursor: 'pointer',
              fontSize: '13px', fontWeight: '700', color: '#3d2b1f',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
            }}
          >
            <FiRefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>

          {/* Date Picker */}
          <div style={{ position: 'relative' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: '10px', padding: '9px 14px',
              fontWeight: '700', color: '#3d2b1f', fontSize: '13px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)', cursor: 'pointer'
            }}>
              <FiCalendar size={14} style={{ color: '#8c857b' }} />
              <span>{formattedDateLabel}</span>
              <FiChevronDown size={13} style={{ color: '#8c857b' }} />
              <input
                type="date"
                value={dateParam || new Date().toISOString().split('T')[0]}
                onChange={e => {
                  const val = e.target.value;
                  router.push(val ? `/agent?date=${val}` : '/agent');
                }}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Pre-Deposit Status Banner ── */}
      {stats.preDeposit && (
        <div style={{
          padding: '14px 20px', borderRadius: '14px', marginBottom: '24px',
          display: 'flex', alignItems: 'center', gap: '14px',
          background: stateBg, border: `1px solid ${stateColor}`,
          flexWrap: 'wrap'
        }}>
          {preDepositState === 'GREEN'
            ? <FiCheckCircle color={stateColor} size={22} />
            : <FiAlertTriangle color={stateColor} size={22} />
          }
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '800', fontSize: '14px', color: '#1c1917' }}>
              Pre-Deposit Wallet: <span style={{ color: stateColor }}>{preDepositState}</span>
            </div>
            <div style={{ fontSize: '12px', color: '#5c554b', marginTop: '2px' }}>{stats.preDeposit.message}</div>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#8c857b', textTransform: 'uppercase' }}>Balance</div>
              <div style={{ fontSize: '17px', fontWeight: '900', color: stateColor }}>{preDepositBalance.toLocaleString()} ETB</div>
            </div>
            {preDepositState !== 'GREEN' && (
              <button
                onClick={() => window.open('https://t.me/Luel1616', '_blank')}
                style={{ background: '#3d2b1f', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: '800' }}
              >
                RECHARGE NOW
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── 6 Stat Cards ── */}
      <div className="stat-grid-6" style={{ marginBottom: '24px' }}>

        <div className="premium-stat-card">
          <div className="card-top-row">
            <div className="card-icon-container"><FiTrendingUp size={20} /></div>
            <span className="card-pill" style={{ color: '#0ea5e9', background: 'rgba(14,165,233,0.1)' }}>Today</span>
          </div>
          <div className="card-body">
            <div className="card-label">TOTAL STAKE (CASH ONLY)</div>
            <div className="card-value">{globalSales.toLocaleString()} ETB</div>
            <div className="card-subtext">Real Player Bets</div>
          </div>
        </div>

        <div className="premium-stat-card">
          <div className="card-top-row">
            <div className="card-icon-container"><FiDollarSign size={20} /></div>
            <span className="card-pill" style={{ color: '#d4af37', background: 'rgba(212,175,55,0.12)' }}>Your {agentRatePct}%</span>
          </div>
          <div className="card-body">
            <div className="card-label">YOUR EARNINGS</div>
            <div className="card-value" style={{ color: '#d4af37' }}>{agentRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</div>
            <div className="card-subtext">{agentRatePct}% of Real Stake (Cash Only)</div>
          </div>
        </div>

        <div className="premium-stat-card">
          <div className="card-top-row">
            <div className="card-icon-container"><FiDownload size={20} /></div>
            <span className="card-pill" style={{ color: '#22c55e', background: 'rgba(34,197,94,0.1)' }}>All Time</span>
          </div>
          <div className="card-body">
            <div className="card-label">TOTAL DEPOSITS</div>
            <div className="card-value">{totalDeposits.toLocaleString()} ETB</div>
            <div className="card-subtext">Branch Deposits</div>
          </div>
        </div>

        <div className="premium-stat-card">
          <div className="card-top-row">
            <div className="card-icon-container"><FiUsers size={20} /></div>
            <span className="card-pill" style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.1)' }}>All Time</span>
          </div>
          <div className="card-body">
            <div className="card-label">BRANCH PLAYERS</div>
            <div className="card-value">{totalPlayers}</div>
            <div className="card-subtext">Registered via Your Link</div>
          </div>
        </div>

        <div className="premium-stat-card">
          <div className="card-top-row">
            <div className="card-icon-container"><FiActivity size={20} /></div>
            <span className="card-pill" style={{ color: '#eab308', background: 'rgba(234,179,8,0.1)' }}>Today</span>
          </div>
          <div className="card-body">
            <div className="card-label">ACTIVE PLAYERS</div>
            <div className="card-value">{activePlayers}</div>
            <div className="card-subtext">Playing Today</div>
          </div>
        </div>

        <div className="premium-stat-card">
          <div className="card-top-row">
            <div className="card-icon-container"><FiPlay size={20} /></div>
            <span className="card-pill" style={{ color: '#ec4899', background: 'rgba(236,72,153,0.1)' }}>Live</span>
          </div>
          <div className="card-body">
            <div className="card-label">ACTIVE GAMES</div>
            <div className="card-value">{activeGames}</div>
            <div className="card-subtext">Running Now</div>
          </div>
        </div>
      </div>

      {/* ── Referral Link + Commission Info ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>

        {/* Referral Card */}
        <div style={{
          background: 'linear-gradient(135deg, #faf8f5, #f5f2eb)',
          border: '1px solid rgba(212,175,55,0.35)',
          borderRadius: '20px', padding: '22px', position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'rgba(212,175,55,0.07)', borderRadius: '50%' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <FiLink size={16} style={{ color: '#d4af37' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>Your Referral Link</h3>
          </div>
          <p style={{ fontSize: '12px', color: '#8c857b', marginBottom: '14px', lineHeight: '1.5' }}>
            Every user who joins through this link is credited to your branch permanently.
          </p>

          {user.referralCode && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.4)', borderRadius: '8px', padding: '5px 12px', marginBottom: '12px' }}>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#8c6a00', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Code</span>
              <code style={{ fontSize: '15px', fontWeight: '900', color: '#3d2b1f', letterSpacing: '0.12em' }}>{user.referralCode}</code>
            </div>
          )}

          <div style={{ display: 'flex', background: '#fff', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.06)', padding: '10px 14px', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <code style={{ fontSize: '11px', color: '#3d2b1f', fontWeight: '700', wordBreak: 'break-all', flex: 1 }}>
              t.me/buna_bingobot?start={referralToken}
            </code>
            <button
              onClick={handleCopy}
              style={{ background: copied ? '#22c55e' : '#3d2b1f', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 14px', fontWeight: '800', cursor: 'pointer', fontSize: '11px', whiteSpace: 'nowrap', transition: 'background 0.2s ease', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <FiCopy size={11} />
              {copied ? 'COPIED!' : 'COPY'}
            </button>
          </div>
          <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px', margin: '8px 0 0 0' }}>
            ⚠ Share only YOUR link — using another agent's link credits them instead.
          </p>
        </div>

        {/* Commission Breakdown */}
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '20px', padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <FiZap size={16} style={{ color: '#d4af37' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>Commission Breakdown</h3>
          </div>
          <p style={{ fontSize: '12px', color: '#8c857b', marginBottom: '16px', lineHeight: '1.5' }}>
            House margin on real cash stakes — your share is {agentRatePct}%. Bonus ETB is not commissionable.
          </p>

          {/* Visual flow — dynamic from settings */}
          {(() => {
            const houseEdge = 30; // full house cut (company + agent combined) — matches settings default
            const companyCut = houseEdge - agentRatePct;
            const winnerPct = 100 - houseEdge;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#faf8f5', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                {[
                  { label: 'Real Stake', value: '100 ETB', color: '#3d2b1f' },
                  null,
                  { label: `Winners (${winnerPct}%)`, value: `${winnerPct} ETB`, color: '#22c55e' },
                  null,
                  { label: `Company (${companyCut}%)`, value: `${companyCut} ETB`, color: '#3b82f6' },
                  null,
                  { label: `You (${agentRatePct}%)`, value: `${agentRatePct} ETB`, color: '#d4af37', bold: true },
                ].map((item, i) => item === null ? (
                  <FiArrowRight key={i} size={12} style={{ color: '#d4cbbd', flexShrink: 0 }} />
                ) : (
                  <div key={i} style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: '9px', fontWeight: '800', color: '#8c857b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{item.label}</div>
                    <div style={{ fontSize: '12px', fontWeight: item.bold ? '900' : '700', color: item.color, marginTop: '3px' }}>{item.value}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Today stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ background: 'rgba(212,175,55,0.08)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', fontWeight: '800', color: '#8c857b', textTransform: 'uppercase' }}>Today Earnings</div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#d4af37', marginTop: '4px' }}>
                {agentRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
              </div>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.07)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', fontWeight: '800', color: '#8c857b', textTransform: 'uppercase' }}>Commission Paid</div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#ef4444', marginTop: '4px' }}>
                {netCommissionPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
              </div>
            </div>
          </div>
        </div>

        {/* Pre-Deposit Wallet Card */}
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '20px', padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <FiDownload size={16} style={{ color: '#22c55e' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>Pre-Deposit Wallet</h3>
          </div>
          <p style={{ fontSize: '12px', color: '#8c857b', marginBottom: '16px', lineHeight: '1.5' }}>
            Funds staked to guarantee winner payouts. Auto-deducted per game.
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#8c857b', textTransform: 'uppercase' }}>Total Added</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#3b82f6' }}>{preDepositAdded.toLocaleString()} ETB</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#8c857b', textTransform: 'uppercase' }}>Remaining</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: stateColor }}>{preDepositBalance.toLocaleString()} ETB</div>
            </div>
          </div>

          <div style={{ height: '8px', background: '#f1efe9', borderRadius: '999px', overflow: 'hidden', marginBottom: '6px' }}>
            <div style={{ width: `${Math.min(preDepositPercent, 100)}%`, height: '100%', background: stateColor, borderRadius: '999px', transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8c857b', fontWeight: '700' }}>
            <span>Used {(100 - preDepositPercent).toFixed(1)}%</span>
            <span>Remaining {preDepositPercent.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* ── Debt Owed to Company (Bot Winnings) ── */}
      {stats.outstandingBotDebt > 0 && (
        <div style={{
          background: '#fff', border: '1px solid #ef4444', borderRadius: '20px', padding: '22px', marginBottom: '24px',
          boxShadow: '0 4px 12px rgba(239,68,68,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <FiAlertTriangle size={18} style={{ color: '#ef4444' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#ef4444', margin: 0 }}>Debt Owed to Company</h3>
          </div>
          <p style={{ fontSize: '13px', color: '#5c554b', marginBottom: '16px', lineHeight: '1.5' }}>
            You are physically holding cash from ticket sales for games where the House Bot won. This money belongs to the company and must be settled.
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239,68,68,0.05)', padding: '16px', borderRadius: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Outstanding Balance</div>
              <div style={{ fontSize: '24px', fontWeight: '900', color: '#b91c1c' }}>{stats.outstandingBotDebt.toLocaleString()} ETB</div>
            </div>
            <button
              onClick={() => alert('Please contact the Administrator to transfer this cash and clear your debt.')}
              style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 18px', fontWeight: '800', cursor: 'pointer', fontSize: '12px' }}
            >
              HOW TO PAY
            </button>
          </div>
        </div>
      )}

      {/* ── Pending Withdrawals ── */}
      <div style={{
        background: '#fff',
        border: withdrawals.length > 0 ? '1px solid #d4af37' : '1px solid rgba(0,0,0,0.06)',
        borderRadius: '20px', padding: '22px', marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>
              Pending Withdrawals
              {withdrawals.length > 0 && (
                <span style={{ marginLeft: '8px', background: '#ef4444', color: '#fff', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '999px' }}>
                  {withdrawals.length}
                </span>
              )}
            </h3>
            <p style={{ fontSize: '12px', color: '#8c857b', marginTop: '3px' }}>Player requests awaiting your approval.</p>
          </div>
          <button onClick={fetchWithdrawals} style={{ background: 'transparent', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: '#3d2b1f', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <FiRefreshCw size={12} />
            Refresh
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#8c857b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: '800' }}>Player</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: '800' }}>Amount</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: '800' }}>Bank / Account</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: '800' }}>Wallet Balance</th>
                <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: '800' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {withdrawalsLoading ? (
                <tr><td colSpan={5} style={{ padding: '2.5rem', textAlign: 'center' }}>
                  <div className="animate-spin" style={{ width: '22px', height: '22px', border: '2px solid #3d2b1f', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }} />
                </td></tr>
              ) : withdrawals.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '2.5rem', textAlign: 'center', color: '#8c857b', fontSize: '13px' }}>
                  ✅ No pending withdrawals — you're all caught up!
                </td></tr>
              ) : withdrawals.map((wd) => (
                <tr key={wd.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <div style={{ width: '30px', height: '30px', fontSize: '11px', background: '#faf8f5', border: '1px solid rgba(0,0,0,0.06)', color: '#3d2b1f', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', flexShrink: 0 }}>
                        {wd.user?.firstName?.[0] || 'P'}
                      </div>
                      <div>
                        <div style={{ color: '#1c1917', fontWeight: '700', fontSize: '13px' }}>{wd.user?.firstName}</div>
                        <div style={{ color: '#8c857b', fontSize: '11px' }}>@{wd.user?.telegramUsername || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 8px', fontWeight: '800', color: '#1c1917' }}>
                    {Number(wd.amount).toLocaleString()} <span style={{ color: '#8c857b', fontSize: '11px' }}>ETB</span>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ fontWeight: '700', color: '#1c1917', fontSize: '13px' }}>{wd.bankName}</div>
                    <div style={{ color: '#8c857b', fontSize: '11px' }}>{wd.accountNumber}</div>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    {wd.user?.wallet && (
                      <span style={{ fontSize: '12px', padding: '3px 8px', fontWeight: '800', background: wd.user.isBalanceLegit ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: wd.user.isBalanceLegit ? '#22c55e' : '#ef4444', borderRadius: '6px' }}>
                        {Number(wd.user.wallet.balance).toFixed(2)} ETB {wd.user.isBalanceLegit ? '✓' : '⚠️'}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleWithdrawalAction(wd.id, 'approve')}
                        disabled={!!actionLoading}
                        style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid #22c55e', fontSize: '11px', padding: '5px 10px', borderRadius: '7px', cursor: 'pointer', fontWeight: '800' }}
                      >
                        {actionLoading === wd.id ? '…' : 'APPROVE'}
                      </button>
                      <button
                        onClick={() => handleWithdrawalAction(wd.id, 'reject')}
                        disabled={!!actionLoading}
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid #ef4444', fontSize: '11px', padding: '5px 10px', borderRadius: '7px', cursor: 'pointer', fontWeight: '800' }}
                      >
                        REJECT
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Branch Players Table ── */}
      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '20px', padding: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>
              Branch Players
              <span style={{ marginLeft: '8px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '999px' }}>
                {totalPlayers} total
              </span>
            </h3>
            <p style={{ fontSize: '12px', color: '#8c857b', marginTop: '3px' }}>All players who joined through your referral link.</p>
          </div>
          <button onClick={fetchPlayers} style={{ background: 'transparent', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: '#3d2b1f', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <FiRefreshCw size={12} />
            Refresh
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#8c857b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: '800' }}>Player</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: '800' }}>Phone</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: '800' }}>Joined</th>
                <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: '800' }}>Balance</th>
                <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: '800' }}>Total Dep.</th>
                <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: '800' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {playersLoading ? (
                <tr><td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center' }}>
                  <div className="animate-spin" style={{ width: '22px', height: '22px', border: '2px solid #3d2b1f', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }} />
                </td></tr>
              ) : players.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#8c857b', fontSize: '13px' }}>
                  No players in your branch yet. Share your referral link to get started!
                </td></tr>
              ) : players.map((player) => (
                <tr key={player.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', transition: 'background 0.15s' }}>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <div style={{ width: '30px', height: '30px', fontSize: '11px', background: 'linear-gradient(135deg, #faf8f5, #f0ece0)', border: '1px solid rgba(212,175,55,0.2)', color: '#3d2b1f', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', flexShrink: 0 }}>
                        {player.firstName?.[0] || 'P'}
                      </div>
                      <div>
                        <div style={{ color: '#1c1917', fontWeight: '700', fontSize: '13px' }}>{player.firstName} {player.lastName || ''}</div>
                        <div style={{ color: '#8c857b', fontSize: '11px' }}>@{player.telegramUsername || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 8px', color: '#5c554b', fontSize: '12px', fontWeight: '600' }}>
                    {player.phone || player.phoneNumber || <span style={{ color: '#d1d5db' }}>Not set</span>}
                  </td>
                  <td style={{ padding: '12px 8px', color: '#8c857b', fontSize: '12px' }}>
                    {new Date(player.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '800', color: '#1c1917' }}>
                    {Number(player.wallet?.balance || 0).toLocaleString()} <span style={{ color: '#8c857b', fontSize: '10px', fontWeight: '600' }}>ETB</span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '800', color: '#1c1917' }}>
                    {Number(player.totalDeposited || 0).toLocaleString()} <span style={{ color: '#8c857b', fontSize: '10px', fontWeight: '600' }}>ETB</span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <span style={{
                      fontSize: '10px', fontWeight: '800',
                      background: player.status === 'BANNED' ? 'rgba(239,68,68,0.1)' : player.status === 'SUSPENDED' ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.1)',
                      color: player.status === 'BANNED' ? '#ef4444' : player.status === 'SUSPENDED' ? '#eab308' : '#22c55e',
                      padding: '4px 10px', borderRadius: '999px'
                    }}>
                      {player.status || 'ACTIVE'}
                    </span>
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

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default function AgentDashboard() {
  return (
    <Suspense fallback={
      <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="premium-stat-card animate-pulse" style={{ height: '140px' }} />
        ))}
      </div>
    }>
      <AgentDashboardContent />
    </Suspense>
  );
}
