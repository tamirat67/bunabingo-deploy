"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiArrowLeft, FiCalendar, FiTrendingUp, FiDollarSign,
  FiAlertTriangle, FiCheckCircle, FiUsers, FiBarChart2, FiExternalLink
} from 'react-icons/fi';
import api from '@/lib/api';
import '@/app/admin.css';

export default function CompanyProfitPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [timeRange, setTimeRange] = useState('all');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/admin/company-profit?range=${timeRange}`);
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load company profit data');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (n: number) => Number(n || 0).toLocaleString();
  const fmtPct = (r: number) => (r * 100).toFixed(1) + '%';

  const rangLabel = timeRange === 'all' ? 'All Time' : timeRange === 'today' ? 'Today' : timeRange === 'week' ? 'Last 7 Days' : 'Last 30 Days';

  if (loading) {
    return (
      <div className="admin-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="animate-spin" style={{ width: '44px', height: '44px', border: '4px solid #d4af37', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }} />
          <p style={{ marginTop: '16px', fontWeight: '700', color: '#3d2b1f' }}>Calculating company profits…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#78716c', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '24px' }}>
          <FiArrowLeft /> Back
        </button>
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '20px', borderRadius: '12px', fontWeight: '600' }}>
          ⚠️ {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { totals, agents, companyRate, agentRate } = data;
  const totalCompanyProfit = totals.companyShare + totals.outstandingBotDebt;

  return (
    <div className="admin-page">
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#78716c', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}>
          <FiArrowLeft /> Back to Dashboard
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>🏦 Company Profit Summary</h1>
            <p style={{ color: '#78716c', margin: '6px 0 0', fontSize: '14px' }}>
              Company earns <strong style={{ color: '#d4af37' }}>{fmtPct(companyRate)}</strong> of all ticket sales + Bot Winnings · Agent earns <strong>{fmtPct(agentRate)}</strong>
            </p>
          </div>

          {/* Time Filter */}
          <div style={{ position: 'relative' }}>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              style={{
                appearance: 'none', background: '#ffffff', border: '1.5px solid #e7e5e4',
                borderRadius: '14px', padding: '12px 40px 12px 16px',
                cursor: 'pointer', fontWeight: '800', color: '#3d2b1f', fontSize: '14px', outline: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}
            >
              <option value="all">📅 All Time</option>
              <option value="today">📅 Today</option>
              <option value="week">📅 Last 7 Days (Weekly)</option>
              <option value="month">📅 Last 30 Days (Monthly)</option>
            </select>
            <FiCalendar size={16} style={{ color: '#8c857b', position: 'absolute', right: '14px', top: '14px', pointerEvents: 'none' }} />
          </div>
        </div>
      </div>

      {/* Global Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #1a0a00 0%, #3d2b1f 60%, #5c3d2e 100%)',
        borderRadius: '20px', padding: '32px', marginBottom: '28px',
        color: 'white', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '220px', height: '220px', background: 'rgba(212,175,55,0.08)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-60px', left: '60px', width: '180px', height: '180px', background: 'rgba(212,175,55,0.05)', borderRadius: '50%' }} />

        <div style={{ fontSize: '12px', fontWeight: '800', color: '#d4af37', letterSpacing: '2px', marginBottom: '8px', textTransform: 'uppercase' }}>
          🏆 Total Company Profit — {rangLabel}
        </div>
        <div style={{ fontSize: 'clamp(32px, 8vw, 48px)', fontWeight: '900', color: '#d4af37', marginBottom: '4px', lineHeight: 1.1 }}>
          {fmt(totalCompanyProfit)} <span style={{ fontSize: 'clamp(16px, 4vw, 20px)', color: 'rgba(212,175,55,0.7)' }}>ETB</span>
        </div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '28px' }}>
          Company Share + Outstanding Bot Debt from all agents
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
          <div style={{ background: 'rgba(212,175,55,0.15)', borderRadius: '14px', padding: '16px', border: '1px solid rgba(212,175,55,0.3)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', fontWeight: '800', letterSpacing: '1px', marginBottom: '6px' }}>COMPANY SHARE ({fmtPct(companyRate)})</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#d4af37' }}>{fmt(totals.companyShare)}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>ETB from ticket sales</div>
          </div>
          <div style={{ background: 'rgba(239,68,68,0.15)', borderRadius: '14px', padding: '16px', border: '1px solid rgba(239,68,68,0.3)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', fontWeight: '800', letterSpacing: '1px', marginBottom: '6px' }}>TOTAL BOT WINNINGS</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#f87171' }}>{fmt(totals.botDebtAdded)}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>ETB bot advantage</div>
          </div>
          <div style={{ background: 'rgba(239,68,68,0.2)', borderRadius: '14px', padding: '16px', border: '1px solid rgba(239,68,68,0.4)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', fontWeight: '800', letterSpacing: '1px', marginBottom: '6px' }}>OUTSTANDING BOT DEBT</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#fca5a5' }}>{fmt(totals.outstandingBotDebt)}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>ETB to collect in cash</div>
          </div>
          <div style={{ background: 'rgba(16,185,129,0.15)', borderRadius: '14px', padding: '16px', border: '1px solid rgba(16,185,129,0.3)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', fontWeight: '800', letterSpacing: '1px', marginBottom: '6px' }}>TOTAL TICKET SALES</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#6ee7b7' }}>{fmt(totals.totalTicketSales)}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>ETB across all branches</div>
          </div>
          <div style={{ background: 'rgba(59,130,246,0.15)', borderRadius: '14px', padding: '16px', border: '1px solid rgba(59,130,246,0.3)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', fontWeight: '800', letterSpacing: '1px', marginBottom: '6px' }}>REAL MONEY DEPOSITED</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#93c5fd' }}>{fmt(totals.totalDeposited)}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>ETB real cash from players</div>
          </div>
          <div style={{ background: 'rgba(245,158,11,0.15)', borderRadius: '14px', padding: '16px', border: '1px solid rgba(245,158,11,0.3)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', fontWeight: '800', letterSpacing: '1px', marginBottom: '6px' }}>AGENT EARNINGS ({fmtPct(agentRate)})</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#fcd34d' }}>{fmt(totals.agentEarned)}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>ETB agents keep</div>
          </div>
        </div>
      </div>

      {/* Per-Agent Table */}
      <div className="data-table-container" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f5f5f4', background: '#fafaf9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiUsers color="#d4af37" /> Per-Agent Profit Breakdown — {rangLabel}
          </h3>
          <span style={{ fontSize: '12px', color: '#78716c', fontWeight: '700' }}>{agents.length} active agents</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: '900px' }}>
            <thead>
              <tr>
                <th>Agent</th>
                <th style={{ textAlign: 'right' }}>Real Deposits</th>
                <th style={{ textAlign: 'right' }}>Ticket Sales</th>
                <th style={{ textAlign: 'right', color: '#d4af37' }}>Company Share ({fmtPct(companyRate)})</th>
                <th style={{ textAlign: 'right', color: '#ef4444' }}>Bot Winnings</th>
                <th style={{ textAlign: 'right', color: '#ef4444' }}>Outstanding Debt</th>
                <th style={{ textAlign: 'right' }}>Net Cash Flow</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent: any, i: number) => {
                const totalOwed = agent.companyShare + agent.outstandingBotDebt;
                const isHighDebt = agent.outstandingBotDebt > 1000;
                return (
                  <tr key={agent.agentId} style={{ background: i % 2 === 0 ? 'white' : '#fafaf9' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          background: 'linear-gradient(135deg, #d4af37, #f59e0b)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '900', color: 'white', fontSize: '14px', flexShrink: 0
                        }}>
                          {(agent.agentName?.[0] || 'A').toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '800', color: '#3d2b1f', fontSize: '14px' }}>{agent.agentName}</div>
                          <div style={{ fontSize: '11px', color: '#a8a29e' }}>
                            {agent.agentUsername ? `@${agent.agentUsername}` : ''} · {agent.realPlayersCount} players
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: '#10b981' }}>
                      {fmt(agent.totalDeposited)} ETB
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: '#3d2b1f' }}>
                      {fmt(agent.totalTicketSales)} ETB
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: '900', color: '#d4af37', fontSize: '15px' }}>
                        {fmt(agent.companyShare)} ETB
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: '#ef4444' }}>
                      {fmt(agent.botDebtAdded)} ETB
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {agent.outstandingBotDebt > 0 ? (
                        <span style={{
                          background: isHighDebt ? '#fef2f2' : '#fff7ed',
                          color: isHighDebt ? '#ef4444' : '#f59e0b',
                          padding: '4px 10px', borderRadius: '8px', fontWeight: '900', fontSize: '13px',
                          border: `1px solid ${isHighDebt ? '#fecaca' : '#fde68a'}`
                        }}>
                          {isHighDebt ? '🔴' : '🟡'} {fmt(agent.outstandingBotDebt)} ETB
                        </span>
                      ) : (
                        <span style={{ color: '#10b981', fontWeight: '700', fontSize: '13px' }}>✅ Cleared</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: agent.netCashFlow >= 0 ? '#10b981' : '#ef4444' }}>
                      {agent.netCashFlow >= 0 ? '+' : ''}{fmt(agent.netCashFlow)} ETB
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => router.push(`/admin/agents/${agent.agentId}`)}
                        style={{
                          background: 'linear-gradient(135deg, #d4af37, #f59e0b)',
                          color: 'white', border: 'none', borderRadius: '8px',
                          padding: '6px 12px', cursor: 'pointer', fontWeight: '800', fontSize: '12px',
                          display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        <FiExternalLink size={12} /> View
                      </button>
                    </td>
                  </tr>
                );
              })}

              {/* Totals row */}
              <tr style={{ background: 'linear-gradient(135deg, #1a0a00, #3d2b1f)', color: 'white' }}>
                <td style={{ fontWeight: '900', fontSize: '14px', color: '#d4af37' }}>
                  📊 TOTAL — {agents.length} agents
                </td>
                <td style={{ textAlign: 'right', fontWeight: '900', color: '#6ee7b7' }}>
                  {fmt(totals.totalDeposited)} ETB
                </td>
                <td style={{ textAlign: 'right', fontWeight: '900', color: 'white' }}>
                  {fmt(totals.totalTicketSales)} ETB
                </td>
                <td style={{ textAlign: 'right', fontWeight: '900', color: '#d4af37', fontSize: '15px' }}>
                  {fmt(totals.companyShare)} ETB
                </td>
                <td style={{ textAlign: 'right', fontWeight: '900', color: '#fca5a5' }}>
                  {fmt(totals.botDebtAdded)} ETB
                </td>
                <td style={{ textAlign: 'right', fontWeight: '900', color: '#fca5a5', fontSize: '15px' }}>
                  {fmt(totals.outstandingBotDebt)} ETB
                </td>
                <td style={{ textAlign: 'right', fontWeight: '900', color: totals.netCashFlow >= 0 ? '#6ee7b7' : '#fca5a5' }}>
                  {totals.netCashFlow >= 0 ? '+' : ''}{fmt(totals.netCashFlow)} ETB
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '24px' }}>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '16px', padding: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#16a34a', letterSpacing: '1px', marginBottom: '8px' }}>✅ COMMISSION AUTO-COLLECTED</div>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#16a34a' }}>{fmt(totals.botDebtSettled)} ETB</div>
          <div style={{ fontSize: '12px', color: '#4ade80', marginTop: '4px' }}>Already settled by agents via pre-deposit</div>
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '16px', padding: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#ef4444', letterSpacing: '1px', marginBottom: '8px' }}>⚠️ CASH TO COLLECT FROM AGENTS</div>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#ef4444' }}>{fmt(totals.outstandingBotDebt)} ETB</div>
          <div style={{ fontSize: '12px', color: '#fca5a5', marginTop: '4px' }}>Physical cash outstanding from bot wins</div>
        </div>
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '16px', padding: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#d97706', letterSpacing: '1px', marginBottom: '8px' }}>💰 TOTAL COMPANY PURE PROFIT</div>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#d97706' }}>{fmt(totalCompanyProfit)} ETB</div>
          <div style={{ fontSize: '12px', color: '#fbbf24', marginTop: '4px' }}>Company Share + Outstanding Bot Debt</div>
        </div>
      </div>
    </div>
  );
}
