"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  FiUsers, FiTrendingUp, FiDollarSign, FiActivity,
  FiPieChart, FiUserCheck, FiArrowDown, FiArrowUp, 
  FiCreditCard, FiPlay, FiInfo, FiCalendar, FiChevronDown, FiArrowRight, FiDownload, FiUpload
} from 'react-icons/fi';
import api from '@/lib/api';

function DashboardContent() {
  const [stats, setStats] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
  const dateParam = searchParams.get('date') || '';

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const userResponse = await api.get('/me');
        const userData = userResponse.data;
        setUser(userData);
        
        const isAdmin = userData.role === 'ADMIN' || userData.isAdmin;
        const isStaff = userData.role === 'STAFF';

        // Staff users get their own dedicated dashboard
        if (isStaff) {
          router.replace('/admin/staff-dashboard');
          return;
        }
        
        if (isAdmin) {
          try {
            const agentsRes = await api.get('/admin/agents');
            setAgents(agentsRes.data.agents || []);
          } catch (e) { console.error('Failed to load agents', e); }
        }

        const endpoint = isAdmin ? '/admin/analytics' : '/agent/stats';
        let url = dateParam ? `${endpoint}?date=${dateParam}` : endpoint;
        if (isAdmin && selectedAgent) {
          url += (url.includes('?') ? '&' : '?') + `agentId=${selectedAgent}`;
        }
        const statsResponse = await api.get(url);
        setStats(statsResponse.data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dateParam, selectedAgent]);

  if (loading || !stats) {
    return (
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="premium-stat-card animate-pulse" style={{ height: '160px' }}></div>
        ))}
      </div>
    );
  }

  const isAdmin = user.role === 'ADMIN' || user.isAdmin;

  // Formatting date for displaying on sub-headers
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

  // Extract variables based on role — NO fake fallbacks, only real data
  // globalSales = today's total gross (all cards including bots)
  const globalSales = isAdmin 
    ? Number(stats.today?.globalSales || 0)
    : Number(stats.totalSales || 0);

  // todayRealSales = today's gross from REAL players only
  const todayRealSales = isAdmin ? Number(stats.today?.realSales || 0) : Number(stats.totalSales || 0);

  // Dynamic Rates from API
  const companyRevenueRate = stats.companyRevenueRate !== undefined ? stats.companyRevenueRate : 20;
  const agentRevenueRate = stats.agentRevenueRate !== undefined ? stats.agentRevenueRate : 10;
  const companyCommissionRate = stats.companyCommissionRate !== undefined ? stats.companyCommissionRate : 30;

  // Company Revenue = dynamic rate of REAL gross only
  const companyRevenue = isAdmin
    ? Number(stats.today?.totalCompanyRevenue ?? (todayRealSales * (companyRevenueRate / 100)))
    : (todayRealSales * (companyRevenueRate / 100));

  // Agent Revenue = dynamic rate of REAL gross only
  const agentRevenue = isAdmin
    ? Number(stats.today?.totalAgentRevenue ?? (todayRealSales * (agentRevenueRate / 100)))
    : Number(stats.agentTakeHome || 0);

  const totalPlayers = isAdmin
    ? (stats.totalUsers || 0)
    : (stats.playerCount || 0);

  const activePlayers = isAdmin
    ? (stats.today?.activePlayers || 0)
    : (stats.activePlayers || 0);

  const activeGames = isAdmin
    ? (stats.activeGames || 0)
    : (stats.activeGames || 0);

  const preDepositAdded = isAdmin
    ? Number(stats.preDepositAdded || 0)
    : Number(stats.preDeposit?.totalAdded || 0);

  const preDepositBalance = isAdmin
    ? Number(stats.preDepositBalance || 0)
    : Number(stats.preDeposit?.balance || 0);

  const preDepositPercent = preDepositAdded > 0 ? (preDepositBalance / preDepositAdded) * 100 : 0;

  const bunaWalletBalance = isAdmin
    ? Number(stats.bunaWalletBalance || 0)
    : 0;

  // Real vs Bot accounting breakdown (all-time)
  const realGrossSales      = isAdmin ? Number(stats.realGrossSales || 0) : 0;
  const botGrossSales       = isAdmin ? Number(stats.botGrossSales  || 0) : 0;
  const realCompanyRevenue  = isAdmin ? Number(stats.realCompanyRevenue || 0) : 0;
  const realAgentRevenue    = isAdmin ? Number(stats.realAgentRevenue  || 0) : 0;
  const botCompanyRevenue   = isAdmin ? Number(stats.botCompanyRevenue  || 0) : 0;
  const botWinPayoutAmount  = isAdmin ? Number(stats.botWinPayoutAmount || 0) : 0;
  const botWinCount         = isAdmin ? Number(stats.botWinCount || 0) : 0;
  const totalGross          = realGrossSales + botGrossSales;
  const realPct             = totalGross > 0 ? (realGrossSales / totalGross) * 100 : 0;
  const botPct              = totalGross > 0 ? (botGrossSales  / totalGross) * 100 : 0;

  const breakdownData = isAdmin && stats.today?.breakdown && stats.today.breakdown.some((b: any) => b.totalStake > 0)
    ? stats.today.breakdown.map((b: any) => ({
        gameType: b.gameType.charAt(0) + b.gameType.slice(1).toLowerCase(),
        entryFee: b.entryFee,
        totalStake: b.totalStake,
        serviceFee: b.serviceFee
      }))
    : [];

  const totalBreakdownStake = breakdownData.reduce((acc: number, item: any) => acc + item.totalStake, 0);
  const totalBreakdownServiceFee = breakdownData.reduce((acc: number, item: any) => acc + item.serviceFee, 0);

  return (
    <div className="admin-page">
      {/* Premium Sub-Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '900', margin: 0, color: '#3d2b1f', fontFamily: 'Inter, sans-serif' }}>
            👋 Welcome back, {user.firstName || 'Admin'}
          </h1>
          <p style={{ color: '#8c857b', marginTop: '4px', fontSize: '14px', fontWeight: '500' }}>
            {isAdmin && !selectedAgent ? 'Platform-wide overview' : 'Branch performance overview'} • {formattedDateLabel}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Agent Selector Dropdown */}
          {isAdmin && (
            <div style={{ position: 'relative' }}>
              <select 
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                style={{
                  appearance: 'none',
                  background: '#ffffff',
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                  borderRadius: '12px',
                  padding: '10px 36px 10px 16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  cursor: 'pointer',
                  fontWeight: '600',
                  color: '#3d2b1f',
                  fontSize: '14px',
                  outline: 'none',
                }}
              >
                <option value="">All Agents (Global)</option>
                {agents.map((ag: any) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.firstName || ag.telegramUsername || ag.id.slice(0,8)}
                  </option>
                ))}
              </select>
              <FiChevronDown size={16} style={{ color: '#8c857b', position: 'absolute', right: '14px', top: '12px', pointerEvents: 'none' }} />
            </div>
          )}

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
                router.push(val ? `/admin?date=${val}` : '/admin');
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
      </div>

      {/* Prize Reserve Wallet Banner */}
      {isAdmin && (
        <div className="premium-card" style={{
          background: 'linear-gradient(135deg, #0c1a2e 0%, #0a1220 100%)',
          color: '#ffffff',
          padding: '24px 32px',
          borderRadius: '24px',
          marginBottom: '32px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          border: '1px solid rgba(59, 130, 246, 0.4)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '24px'
        }}>
          {/* Left: Label */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{
                background: 'rgba(59,130,246,0.15)',
                border: '1px solid rgba(59,130,246,0.4)',
                color: '#60a5fa',
                fontSize: '10px',
                fontWeight: '900',
                letterSpacing: '2px',
                padding: '3px 10px',
                borderRadius: '999px',
                textTransform: 'uppercase'
              }}>
                🏦 PRIZE RESERVE WALLET
              </span>
            </div>
            <h2 style={{ fontSize: '28px', fontWeight: '900', margin: 0, color: '#ffffff', fontFamily: 'Inter, sans-serif' }}>
              AGENT PRE-DEPOSIT
            </h2>
            <p style={{ color: '#94a3b8', margin: '6px 0 0 0', fontSize: '13px', fontWeight: '500', lineHeight: '1.5' }}>
              Real cash deposited by agents to fund guaranteed prize payouts.<br />
              <span style={{ color: '#4ade80', fontWeight: '700' }}>This is real money — deducted per game to pay winners.</span>
            </p>
          </div>

          {/* Right: Two parallel values */}
          <div style={{ display: 'flex', gap: '32px', alignItems: 'center', flexWrap: 'wrap' }}>

            {/* Total Recharged */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#60a5fa', letterSpacing: '1px', marginBottom: '4px', textTransform: 'uppercase' }}>
                Total Admin Refills
              </div>
              <div style={{ fontSize: '32px', fontWeight: '900', color: '#60a5fa', fontFamily: 'Inter, sans-serif' }}>
                +{preDepositAdded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span style={{ fontSize: '18px', color: '#60a5fa', marginLeft: '6px' }}>ETB</span>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                Cumulative refills admin added to agents
              </div>
            </div>

            <div style={{ width: '1px', height: '60px', background: 'rgba(59,130,246,0.25)', flexShrink: 0 }} />

            {/* Remaining Balance */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#4ade80', letterSpacing: '1px', marginBottom: '4px', textTransform: 'uppercase' }}>
                Remaining Balance
              </div>
              <div style={{ fontSize: '32px', fontWeight: '900', color: '#4ade80', fontFamily: 'Inter, sans-serif' }}>
                {preDepositBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span style={{ fontSize: '18px', color: '#4ade80', marginLeft: '6px' }}>ETB</span>
              </div>
              <div style={{ fontSize: '11px', color: '#6ee7b7', marginTop: '2px' }}>
                {preDepositPercent.toFixed(1)}% of total recharged remaining
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Six Stat Cards Grid */}
      <div className="stat-grid-6">
        <div className="premium-stat-card">
          <div className="card-top-row">
            <div className="card-icon-container">
              <FiPieChart size={20} />
            </div>
            <span className="card-pill" style={{ color: '#0ea5e9', background: 'rgba(14, 165, 233, 0.1)' }}>Today</span>
          </div>
          <div className="card-body">
            <div className="card-label">TOTAL TURNOVER (STAKE)</div>
            <div className="card-value">{globalSales.toLocaleString()} ETB</div>
            <div className="card-subtext">Includes Re-betted Winnings</div>
          </div>
        </div>

        <div className="premium-stat-card">
          <div className="card-top-row">
            <div className="card-icon-container">
              <FiDollarSign size={20} />
            </div>
            <span className="card-pill" style={{ color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)' }}>Today's {companyRevenueRate}%</span>
          </div>
          <div className="card-body">
            <div className="card-label">COMPANY REVENUE</div>
            <div className="card-value">{companyRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</div>
            <div className="card-subtext">{companyRevenueRate}% of Real Stake</div>
          </div>
        </div>

        <div className="premium-stat-card">
          <div className="card-top-row">
            <div className="card-icon-container">
              <FiUsers size={20} />
            </div>
            <span className="card-pill" style={{ color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)' }}>Today's {agentRevenueRate}%</span>
          </div>
          <div className="card-body">
            <div className="card-label">AGENT REVENUE</div>
            <div className="card-value">{agentRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</div>
            <div className="card-subtext">{agentRevenueRate}% of Real Stake</div>
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

      {/* ── Real vs Bot Accounting Card ── */}
      {isAdmin && (
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          border: '1px solid rgba(0,0,0,0.06)',
          padding: '24px 28px',
          marginBottom: '32px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <span style={{ fontSize: '13px', fontWeight: '900', color: '#3d2b1f', textTransform: 'uppercase', letterSpacing: '1px' }}>
              📊 Real Money vs House Bot Accounting (All Time)
            </span>
            <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '999px', fontWeight: '700' }}>
              {realPct.toFixed(1)}% Real | {botPct.toFixed(1)}% Synthetic
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
            {/* Real Gross Sales */}
            <div style={{ background: '#f0fdf4', borderRadius: '14px', padding: '16px', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '10px', fontWeight: '900', color: '#059669', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>✅ Real Gross Sales</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#065f46' }}>{realGrossSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px' }}>ETB — from real players</div>
              <div style={{ height: '4px', background: '#d1fae5', borderRadius: '999px', marginTop: '10px' }}>
                <div style={{ width: `${realPct}%`, height: '100%', background: '#10b981', borderRadius: '999px' }} />
              </div>
            </div>

            {/* Bot Gross Sales */}
            <div style={{ background: '#fff7ed', borderRadius: '14px', padding: '16px', border: '1px solid #fed7aa' }}>
              <div style={{ fontSize: '10px', fontWeight: '900', color: '#ea580c', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>⚠ Bot Gross Sales</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#9a3412' }}>{botGrossSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div style={{ fontSize: '11px', color: '#ea580c', marginTop: '4px' }}>ETB — synthetic / fake</div>
              <div style={{ height: '4px', background: '#fed7aa', borderRadius: '999px', marginTop: '10px' }}>
                <div style={{ width: `${botPct}%`, height: '100%', background: '#f97316', borderRadius: '999px' }} />
              </div>
            </div>

            {/* Real Company Revenue (dynamic) */}
            <div style={{ background: '#f0fdf4', borderRadius: '14px', padding: '16px', border: '1px solid #86efac' }}>
              <div style={{ fontSize: '10px', fontWeight: '900', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>✅ Company Revenue ({companyRevenueRate}%)</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#14532d' }}>{realCompanyRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px' }}>ETB — {companyRevenueRate}% of real gross (all-time)</div>
            </div>

            {/* Real Agent Revenue (dynamic) */}
            <div style={{ background: '#eff6ff', borderRadius: '14px', padding: '16px', border: '1px solid #93c5fd' }}>
              <div style={{ fontSize: '10px', fontWeight: '900', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>✅ Agent Revenue ({agentRevenueRate}%)</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#1e3a8a' }}>{realAgentRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '4px' }}>ETB — {agentRevenueRate}% of real gross (all-time)</div>
            </div>

            {/* House Bot Advantage */}
            <div style={{ background: '#fefce8', borderRadius: '14px', padding: '16px', border: '1px solid #fde047' }}>
              <div style={{ fontSize: '10px', fontWeight: '900', color: '#ca8a04', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>🤖 House Bot Advantage</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#854d0e' }}>{botWinPayoutAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div style={{ fontSize: '11px', color: '#ca8a04', marginTop: '4px' }}>ETB — from {botWinCount.toLocaleString()} bot wins</div>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="dashboard-grid">
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

            {/* Custom Progress Bar matching mockup */}
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
              HOW COMMISSION WORKS ({companyCommissionRate}% ON REAL STAKE)
            </h3>
            <p style={{ fontSize: '13px', color: '#8c857b', marginBottom: '20px', lineHeight: '1.5' }}>
              For every bet placed by a <b>REAL PLAYER</b>, {companyCommissionRate}% of the stake goes to commission and {100 - companyCommissionRate}% goes to the prize pool. Bot stakes are not charged commission and go 100% to winners.
            </p>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: '#faf8f5', borderRadius: '16px', padding: '16px 12px', border: '1px solid rgba(0,0,0,0.03)', margin: '16px 0' }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '10px', fontWeight: '800', color: '#8c857b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Real Stake</div>
                <div style={{ fontSize: '14px', fontWeight: '900', color: '#3d2b1f', marginTop: '4px' }}>100 ETB</div>
              </div>
              
              <div style={{ color: '#d4cbbd', display: 'flex', alignItems: 'center' }}>
                <FiArrowRight size={18} />
              </div>
              
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '10px', fontWeight: '800', color: '#8c857b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Commission ({companyCommissionRate}%)</div>
                <div style={{ fontSize: '14px', fontWeight: '900', color: '#3d2b1f', marginTop: '4px' }}>{companyCommissionRate} ETB</div>
              </div>
              
              <div style={{ color: '#d4cbbd', display: 'flex', alignItems: 'center' }}>
                <FiArrowRight size={18} />
              </div>
              
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '10px', fontWeight: '800', color: '#8c857b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Winners ({100 - companyCommissionRate}%)</div>
                <div style={{ fontSize: '14px', fontWeight: '900', color: '#3d2b1f', marginTop: '4px' }}>{100 - companyCommissionRate} ETB</div>
              </div>
            </div>
            
            <p style={{ fontSize: '12px', color: '#8c857b', fontStyle: 'italic', margin: 0 }}>
              Of the {companyCommissionRate} ETB commission: {companyRevenueRate} ETB to Company, {agentRevenueRate} ETB to Agent.
            </p>
          </div>

          {/* Service Fee Breakdown Table (Only for Global Admin view) */}
          {isAdmin && (
            <div className="premium-card">
              <h3 className="premium-card-title">DAILY GAME ROOM BREAKDOWN</h3>
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>GAME TYPE</th>
                    <th>ENTRY FEE</th>
                    <th>TOTAL STAKE</th>
                    <th className="text-right">REVENUE ({companyRevenueRate}% Company + {agentRevenueRate}% Agent)</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdownData.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: '700' }}>{item.gameType}</td>
                      <td>{item.entryFee} ETB</td>
                      <td>{item.totalStake.toLocaleString()} ETB</td>
                      <td className="text-right" style={{ fontWeight: '700' }}>
                        {(item.totalStake * (companyCommissionRate / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                      </td>
                    </tr>
                  ))}
                  {breakdownData.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#8c857b', fontSize: '13px' }}>
                        No games played today yet.
                      </td>
                    </tr>
                  )}
                  <tr className="total-row">
                    <td>TOTAL</td>
                    <td>—</td>
                    <td>{totalBreakdownStake.toLocaleString()} ETB</td>
                    <td className="text-right">
                      {totalBreakdownServiceFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
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
                  <td>Total Turnover (Gross Stake)</td>
                  <td className="text-right" style={{ fontWeight: '700' }}>{globalSales.toLocaleString()} ETB</td>
                </tr>
                <tr>
                  <td>Total Service Fee ({companyCommissionRate}% of Real)</td>
                  <td className="text-right" style={{ fontWeight: '700' }}>{((companyRevenue + agentRevenue) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</td>
                </tr>
                <tr className="highlighted-row">
                  <td>Company Revenue ({companyRevenueRate}%)</td>
                  <td className="text-right">{companyRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</td>
                </tr>
                <tr className="highlighted-row">
                  <td>Agent Revenue ({agentRevenueRate}%)</td>
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
                <span>REVENUE SPLIT (PER 100 ETB REAL STAKE)</span>
              </div>
              <ul className="revenue-split-list">
                <li className="revenue-split-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#d4af37', fontWeight: 'bold' }}>•</span>
                  <span>{100 - companyCommissionRate}% goes to Winners ({100 - companyCommissionRate} ETB)</span>
                </li>
                <li className="revenue-split-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#d4af37', fontWeight: 'bold' }}>•</span>
                  <span>{companyRevenueRate}% goes to Company ({companyRevenueRate} ETB)</span>
                </li>
                <li className="revenue-split-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#d4af37', fontWeight: 'bold' }}>•</span>
                  <span>{agentRevenueRate}% goes to Agent ({agentRevenueRate} ETB)</span>
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
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense fallback={
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="premium-stat-card animate-pulse" style={{ height: '160px' }}></div>
        ))}
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
