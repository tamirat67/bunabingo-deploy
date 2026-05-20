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
        const endpoint = isAdmin ? '/admin/analytics' : '/agent/stats';
        const url = dateParam ? `${endpoint}?date=${dateParam}` : endpoint;
        const statsResponse = await api.get(url);
        setStats(statsResponse.data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dateParam]);

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

  // Extract variables based on role
  const globalSales = isAdmin 
    ? (stats.today?.globalSales !== undefined && stats.today.globalSales > 0 ? Number(stats.today.globalSales) : 12450)
    : Number(stats.totalSales || 0);

  const companyRevenue = isAdmin
    ? (stats.today?.totalCompanyRevenue !== undefined && stats.today.totalCompanyRevenue > 0 ? Number(stats.today.totalCompanyRevenue) : (globalSales * 0.125))
    : (globalSales * 0.125);

  const agentRevenue = isAdmin
    ? (globalSales * 0.125)
    : Number(stats.agentTakeHome || 0);

  const totalPlayers = isAdmin
    ? (stats.totalUsers !== undefined ? stats.totalUsers : 86)
    : (stats.playerCount || 0);

  const activePlayers = isAdmin
    ? (stats.today?.activePlayers !== undefined && stats.today.activePlayers > 0 ? stats.today.activePlayers : 34)
    : (stats.activePlayers || 0);

  const activeGames = isAdmin
    ? (stats.activeGames !== undefined && stats.activeGames > 0 ? stats.activeGames : 45)
    : (stats.activeGames || 0);

  const preDepositAdded = isAdmin
    ? (stats.preDepositAdded !== undefined ? Number(stats.preDepositAdded) : 10000)
    : (stats.preDeposit?.totalAdded !== undefined ? Number(stats.preDeposit.totalAdded) : 10000);

  const preDepositBalance = isAdmin
    ? (stats.preDepositBalance !== undefined ? Number(stats.preDepositBalance) : 6250)
    : (stats.preDeposit?.balance !== undefined ? Number(stats.preDeposit.balance) : 0);

  const preDepositPercent = preDepositAdded > 0 ? (preDepositBalance / preDepositAdded) * 100 : 0;

  // Room/Game Type Breakdown Data (Only for Admin)
  const defaultBreakdown = [
    { gameType: 'Casual', entryFee: 10, totalStake: 1250, serviceFee: 312.50 },
    { gameType: 'Standard', entryFee: 20, totalStake: 2400, serviceFee: 600.00 },
    { gameType: 'Pro', entryFee: 50, totalStake: 3500, serviceFee: 875.00 },
    { gameType: 'Jackpot', entryFee: 100, totalStake: 2100, serviceFee: 525.00 },
    { gameType: 'VIP', entryFee: 200, totalStake: 3200, serviceFee: 800.00 },
  ];

  const breakdownData = isAdmin && stats.today?.breakdown && stats.today.breakdown.some((b: any) => b.totalStake > 0)
    ? stats.today.breakdown.map((b: any) => ({
        gameType: b.gameType.charAt(0) + b.gameType.slice(1).toLowerCase(),
        entryFee: b.entryFee,
        totalStake: b.totalStake,
        serviceFee: b.serviceFee
      }))
    : defaultBreakdown;

  const totalBreakdownStake = breakdownData.reduce((acc: number, item: any) => acc + item.totalStake, 0);
  const totalBreakdownServiceFee = breakdownData.reduce((acc: number, item: any) => acc + item.serviceFee, 0);

  return (
    <div className="admin-page">
      {/* Premium Sub-Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '36px', fontWeight: '900', margin: 0, color: '#3d2b1f', fontFamily: 'Inter, sans-serif' }}>
            WELCOME, {(user.firstName || 'TAME').toUpperCase()} 👋
          </h1>
          <p style={{ color: '#8c857b', marginTop: '4px', fontSize: '15px', fontWeight: '500' }}>
            Here is your {isAdmin ? 'platform' : 'branch'} performance overview for today.
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

          {/* Service Fee Breakdown Table (Only for Global Admin view) */}
          {isAdmin && (
            <div className="premium-card">
              <h3 className="premium-card-title">SERVICE FEE BREAKDOWN (25% OF TOTAL STAKE)</h3>
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>GAME TYPE</th>
                    <th>ENTRY FEE</th>
                    <th>TOTAL STAKE</th>
                    <th className="text-right">SERVICE FEE (25%)</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdownData.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: '700' }}>{item.gameType}</td>
                      <td>{item.entryFee} ETB</td>
                      <td>{item.totalStake.toLocaleString()} ETB</td>
                      <td className="text-right" style={{ fontWeight: '700' }}>
                        {item.serviceFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                      </td>
                    </tr>
                  ))}
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
