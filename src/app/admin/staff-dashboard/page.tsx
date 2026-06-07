"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FiUsers, FiDollarSign, FiTrendingUp, FiShield,
  FiCreditCard, FiRefreshCw, FiArrowRight, FiActivity,
  FiAlertCircle, FiCheckCircle, FiClock, FiBarChart2,
  FiUserCheck
} from 'react-icons/fi';
import api from '@/lib/api';
import '@/app/admin.css';

export default function StaffDashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [agentDetails, setAgentDetails] = useState<Record<string, any>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [meRes, agentsRes, analyticsRes] = await Promise.all([
        api.get('/me'),
        api.get('/admin/agents'),
        api.get('/admin/analytics'),
      ]);
      setUser(meRes.data);
      const agentList = agentsRes.data.agents || [];
      setAgents(agentList);
      setAnalytics(analyticsRes.data);

      // Load per-agent reports concurrently
      if (agentList.length > 0) {
        setLoadingDetails(true);
        const details: Record<string, any> = {};
        await Promise.all(
          agentList.map(async (ag: any) => {
            try {
              const r = await api.get(`/admin/agents/${ag.id}/report`);
              details[ag.id] = r.data;
            } catch (_) {
              details[ag.id] = null;
            }
          })
        );
        setAgentDetails(details);
        setLoadingDetails(false);
      }
    } catch (err) {
      console.error('Staff dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }

  const fmt = (n: number) => Number(n || 0).toLocaleString();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px' }}>
        <div style={{ height: '40px', width: '260px', background: 'rgba(0,0,0,0.06)', borderRadius: '12px' }} className="animate-pulse" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ height: '130px', background: 'rgba(0,0,0,0.04)', borderRadius: '16px' }} className="animate-pulse" />
          ))}
        </div>
        <div style={{ height: '300px', background: 'rgba(0,0,0,0.04)', borderRadius: '16px' }} className="animate-pulse" />
      </div>
    );
  }

  // Aggregate summary numbers
  const totalSalesAllTime = agents.reduce((sum, ag) => {
    const d = agentDetails[ag.id];
    return sum + Number(d?.summary?.totalTicketSales || 0);
  }, 0);

  const totalNetProfit = agents.reduce((sum, ag) => {
    const d = agentDetails[ag.id];
    return sum + Number(d?.summary?.netProfit || 0);
  }, 0);

  const totalPlayers = agents.reduce((sum, ag) => {
    const d = agentDetails[ag.id];
    return sum + Number(d?.players?.length || 0);
  }, 0);

  const totalPendingDeposits = Number(analytics?.pendingDeposits || 0);
  const totalPendingWithdrawals = Number(analytics?.pendingWithdrawals || 0);

  const todaySales = Number(analytics?.today?.globalSales || 0);
  const todayActivePlayers = Number(analytics?.today?.activePlayers || 0);

  const preDepositBalance = Number(analytics?.preDepositBalance || 0);

  return (
    <div className="admin-page">
      {/* Welcome Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>
          👋 Welcome, {user?.firstName || 'Staff'}
        </h1>
        <p style={{ color: '#8c857b', marginTop: '6px', fontSize: '14px', fontWeight: '500' }}>
          Staff Dashboard • Monitoring <strong>{agents.length}</strong> assigned agent{agents.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Top KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <KpiCard
          icon={<FiTrendingUp size={20} />}
          label="Today's Gross Sales"
          value={`${fmt(todaySales)} ETB`}
          color="#22c55e"
          bg="rgba(34,197,94,0.08)"
        />
        <KpiCard
          icon={<FiUsers size={20} />}
          label="Active Players Today"
          value={fmt(todayActivePlayers)}
          color="#3b82f6"
          bg="rgba(59,130,246,0.08)"
        />
        <KpiCard
          icon={<FiBarChart2 size={20} />}
          label="All-Time Sales"
          value={`${fmt(totalSalesAllTime)} ETB`}
          color="#8b5cf6"
          bg="rgba(139,92,246,0.08)"
        />
        <KpiCard
          icon={<FiDollarSign size={20} />}
          label="Net Profit (All-Time)"
          value={`${fmt(totalNetProfit)} ETB`}
          color="#f59e0b"
          bg="rgba(245,158,11,0.08)"
        />
        <KpiCard
          icon={<FiUserCheck size={20} />}
          label="Total Players"
          value={fmt(totalPlayers)}
          color="#06b6d4"
          bg="rgba(6,182,212,0.08)"
        />
        <KpiCard
          icon={<FiCreditCard size={20} />}
          label="Agents Pre-Deposit"
          value={`${fmt(preDepositBalance)} ETB`}
          color="#d97706"
          bg="rgba(217,119,6,0.08)"
        />
      </div>

      {/* Pending Actions Banner */}
      {(totalPendingDeposits > 0 || totalPendingWithdrawals > 0) && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(239,68,68,0.08))',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          flexWrap: 'wrap'
        }}>
          <FiAlertCircle size={22} color="#f59e0b" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '800', color: '#3d2b1f', fontSize: '14px' }}>
              Pending Transactions Require Attention
            </div>
            <div style={{ color: '#8c857b', fontSize: '13px', marginTop: '2px' }}>
              {totalPendingDeposits > 0 && <span><strong>{totalPendingDeposits}</strong> pending deposit{totalPendingDeposits !== 1 ? 's' : ''} </span>}
              {totalPendingWithdrawals > 0 && <span>• <strong>{totalPendingWithdrawals}</strong> pending withdrawal{totalPendingWithdrawals !== 1 ? 's' : ''}</span>}
            </div>
          </div>
          <Link href="/admin/transactions" style={{
            padding: '8px 16px', background: '#f59e0b', color: 'white',
            borderRadius: '10px', fontWeight: '700', fontSize: '13px',
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            View <FiArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Assigned Agents Table */}
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        marginBottom: '32px'
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#3d2b1f' }}>
              <FiShield size={16} style={{ marginRight: '8px', verticalAlign: 'middle', color: '#d97706' }} />
              Assigned Agents
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#8c857b' }}>
              {agents.length} agent{agents.length !== 1 ? 's' : ''} under your supervision
            </p>
          </div>
          <button onClick={loadAll} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '10px',
            border: '1px solid rgba(0,0,0,0.08)', background: '#f9f9f9',
            color: '#3d2b1f', fontWeight: '700', fontSize: '12px', cursor: 'pointer'
          }}>
            <FiRefreshCw size={13} /> Refresh
          </button>
        </div>

        {agents.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#8c857b' }}>
            <FiShield size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p style={{ fontWeight: '700', fontSize: '15px' }}>No agents assigned yet</p>
            <p style={{ fontSize: '13px' }}>Ask the admin to assign agents to your account.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  {['Agent', 'Players', 'All-Time Sales', 'Today\'s Sales', 'Net Profit', 'Pre-Deposit Balance', 'Wallet Balance', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '800', color: '#8c857b', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents.map((agent: any) => {
                  const d = agentDetails[agent.id];
                  const realPlayers = d?.players?.length || 0;
                  const allTimeSales = Number(d?.summary?.totalTicketSales || 0);
                  const netProfit = Number(d?.summary?.netProfit || 0);
                  const preDepBal = Number(agent.agentPreDepositWallet?.balance || 0);
                  const walletBal = Number(agent.wallet?.balance || 0);
                  const isActive = agent.status === 'ACTIVE';

                  // Compute today's sales from analytics if per-agent detail not available
                  const todayAgentSales = loadingDetails ? null : allTimeSales;

                  return (
                    <tr key={agent.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.015)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Agent Name */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #d4af37, #f5e6a3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: '900', fontSize: '14px', color: '#3d2b1f', flexShrink: 0
                          }}>
                            {(agent.firstName || agent.telegramUsername || 'A')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', color: '#3d2b1f', fontSize: '13px' }}>
                              {agent.firstName || agent.telegramUsername || '—'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#8c857b' }}>
                              @{agent.telegramUsername || 'unknown'}
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* Players */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '700', color: '#3d2b1f', fontSize: '14px' }}>{fmt(realPlayers)}</div>
                        <div style={{ fontSize: '11px', color: '#8c857b' }}>real players</div>
                      </td>
                      {/* All-Time Sales */}
                      <td style={{ padding: '14px 16px' }}>
                        {loadingDetails ? (
                          <div style={{ height: '16px', width: '80px', background: '#f0f0f0', borderRadius: '6px' }} className="animate-pulse" />
                        ) : (
                          <>
                            <div style={{ fontWeight: '700', color: '#3d2b1f', fontSize: '14px' }}>{fmt(allTimeSales)}</div>
                            <div style={{ fontSize: '11px', color: '#8c857b' }}>ETB</div>
                          </>
                        )}
                      </td>
                      {/* Today's Sales */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontWeight: '700', color: '#22c55e', fontSize: '14px' }}>—</span>
                        <div style={{ fontSize: '11px', color: '#8c857b' }}>view report</div>
                      </td>
                      {/* Net Profit */}
                      <td style={{ padding: '14px 16px' }}>
                        {loadingDetails ? (
                          <div style={{ height: '16px', width: '70px', background: '#f0f0f0', borderRadius: '6px' }} className="animate-pulse" />
                        ) : (
                          <>
                            <div style={{ fontWeight: '700', color: netProfit >= 0 ? '#22c55e' : '#ef4444', fontSize: '14px' }}>
                              {netProfit >= 0 ? '+' : ''}{fmt(netProfit)}
                            </div>
                            <div style={{ fontSize: '11px', color: '#8c857b' }}>ETB</div>
                          </>
                        )}
                      </td>
                      {/* Pre-Deposit Balance */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '700', color: preDepBal < 1000 ? '#ef4444' : '#3d2b1f', fontSize: '14px' }}>
                          {fmt(preDepBal)}
                        </div>
                        <div style={{ fontSize: '11px', color: preDepBal < 1000 ? '#ef4444' : '#8c857b' }}>
                          {preDepBal < 1000 ? '⚠ Low balance' : 'ETB'}
                        </div>
                      </td>
                      {/* Wallet Balance */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '700', color: '#3d2b1f', fontSize: '14px' }}>{fmt(walletBal)}</div>
                        <div style={{ fontSize: '11px', color: '#8c857b' }}>ETB</div>
                      </td>
                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                          background: isActive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                          color: isActive ? '#16a34a' : '#dc2626'
                        }}>
                          {isActive ? <FiCheckCircle size={11} /> : <FiClock size={11} />}
                          {agent.status}
                        </span>
                      </td>
                      {/* View Report Link */}
                      <td style={{ padding: '14px 16px' }}>
                        <Link href={`/admin/agents/${agent.id}`} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '6px 12px', borderRadius: '8px',
                          background: 'rgba(212,175,55,0.1)', color: '#b45309',
                          fontWeight: '700', fontSize: '12px', textDecoration: 'none',
                          whiteSpace: 'nowrap'
                        }}>
                          Report <FiArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Per-Agent Mini Reports */}
      {agents.length > 0 && (
        <>
          <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#3d2b1f', marginBottom: '16px', marginTop: '8px' }}>
            <FiActivity size={16} style={{ marginRight: '8px', verticalAlign: 'middle', color: '#d97706' }} />
            Agent Deposit Status
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            {agents.map((agent: any) => {
              const d = agentDetails[agent.id];
              const rechargeHistory = d?.rechargeHistory || [];
              const lastRecharge = rechargeHistory[0];
              const preDepBal = Number(agent.agentPreDepositWallet?.balance || 0);
              const totalRecharged = Number(agent.agentPreDepositWallet?.totalRecharged || 0);
              const totalDebited = Number(agent.agentPreDepositWallet?.totalDebited || 0);
              const usagePct = totalRecharged > 0 ? Math.min(100, (totalDebited / totalRecharged) * 100) : 0;

              return (
                <div key={agent.id} style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid rgba(0,0,0,0.06)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
                  padding: '20px',
                  transition: 'box-shadow 0.2s'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontWeight: '800', color: '#3d2b1f', fontSize: '14px' }}>
                        {agent.firstName || agent.telegramUsername || '—'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#8c857b', marginTop: '2px' }}>
                        @{agent.telegramUsername || 'N/A'}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px',
                      background: preDepBal < 1000 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                      color: preDepBal < 1000 ? '#dc2626' : '#16a34a'
                    }}>
                      {preDepBal < 1000 ? '⚠ Low' : '✓ OK'}
                    </span>
                  </div>

                  {/* Pre-Deposit Info */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#8c857b', fontWeight: '600' }}>Pre-Deposit Balance</span>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: preDepBal < 1000 ? '#ef4444' : '#3d2b1f' }}>
                        {fmt(preDepBal)} ETB
                      </span>
                    </div>

                    {/* Usage bar */}
                    <div style={{ height: '6px', background: 'rgba(0,0,0,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${usagePct}%`,
                        background: usagePct > 80 ? '#ef4444' : usagePct > 50 ? '#f59e0b' : '#22c55e',
                        borderRadius: '3px',
                        transition: 'width 0.6s ease'
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#aaa' }}>Used: {fmt(totalDebited)} ETB</span>
                      <span style={{ fontSize: '10px', color: '#aaa' }}>Total Added: {fmt(totalRecharged)} ETB</span>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                    <div style={{ background: 'rgba(59,130,246,0.06)', borderRadius: '10px', padding: '10px' }}>
                      <div style={{ fontSize: '10px', color: '#8c857b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Players</div>
                      <div style={{ fontSize: '16px', fontWeight: '900', color: '#3d2b1f' }}>
                        {loadingDetails ? '…' : fmt(d?.players?.length || 0)}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(34,197,94,0.06)', borderRadius: '10px', padding: '10px' }}>
                      <div style={{ fontSize: '10px', color: '#8c857b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>All Sales</div>
                      <div style={{ fontSize: '14px', fontWeight: '900', color: '#3d2b1f' }}>
                        {loadingDetails ? '…' : `${fmt(d?.summary?.totalTicketSales || 0)}`}
                      </div>
                    </div>
                  </div>

                  {/* Last Recharge */}
                  {lastRecharge && (
                    <div style={{
                      background: 'rgba(245,158,11,0.06)',
                      borderRadius: '10px', padding: '10px',
                      marginBottom: '14px'
                    }}>
                      <div style={{ fontSize: '10px', color: '#8c857b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Last Recharge
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#b45309' }}>
                          +{fmt(Number(lastRecharge.amount))} ETB
                        </span>
                        <span style={{ fontSize: '11px', color: '#8c857b' }}>
                          {new Date(lastRecharge.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  )}

                  <Link href={`/admin/agents/${agent.id}`} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    width: '100%', padding: '10px',
                    background: 'linear-gradient(135deg, #3d2b1f, #6b4226)',
                    color: 'white', borderRadius: '10px',
                    fontWeight: '700', fontSize: '13px', textDecoration: 'none',
                    textAlign: 'center'
                  }}>
                    View Full Report <FiArrowRight size={13} />
                  </Link>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, color, bg }: { icon: React.ReactNode, label: string, value: string, color: string, bg: string }) {
  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '16px',
      border: '1px solid rgba(0,0,0,0.06)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
      padding: '20px',
    }}>
      <div style={{
        width: '42px', height: '42px', borderRadius: '12px',
        background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '14px'
      }}>
        {icon}
      </div>
      <div style={{ fontSize: '11px', color: '#8c857b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontSize: '22px', fontWeight: '900', color: '#3d2b1f', lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}
