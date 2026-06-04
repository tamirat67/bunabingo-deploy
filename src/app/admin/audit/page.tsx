"use client";

import React, { useEffect, useState } from 'react';
import { FiShield, FiAlertTriangle, FiCheckCircle, FiDollarSign, FiTrendingUp, FiUsers, FiCreditCard, FiInfo } from 'react-icons/fi';
import api from '@/lib/api';

export default function AdminAuditPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAudit() {
      try {
        const res = await api.get('/admin/audit');
        setData(res.data.data);
      } catch (err) {
        console.error('Failed to load audit data', err);
      } finally {
        setLoading(false);
      }
    }
    loadAudit();
  }, []);

  if (loading || !data) {
    return (
      <div className="admin-page" style={{ padding: '24px' }}>
        <div className="animate-pulse" style={{ height: '200px', background: 'rgba(0,0,0,0.05)', borderRadius: '16px' }}></div>
      </div>
    );
  }

  // Commission audit: compare actual deductions against REAL player sales × rate
  const commissionRate = data.commissionRate || 0.30;
  const expectedCommissions = data.expectedCommissions; // realPlayerSales × rate
  const actualCommissions = data.totalCommissionsDeducted;
  // Tolerance of 5% — some variance is acceptable due to rounding per game
  const tolerance = expectedCommissions * 0.05;
  const commissionMismatch = Math.abs(actualCommissions - expectedCommissions) > Math.max(tolerance, 1);
  const totalFlow = data.totalDeposits - data.totalWithdrawals;

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="admin-page">
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#3d2b1f', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FiShield style={{ color: '#d4af37' }} />
          SYSTEM AUDIT &amp; DATA REALITY SYNC
        </h1>
        <p style={{ color: '#8c857b', marginTop: '8px', fontSize: '14px' }}>
          Real-time financial verification. Commission is charged only on <strong>real player</strong> sales — house bot purchases are synthetic and not charged.
        </p>
      </div>

      {/* Row 1: Sales Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {/* Total Gross */}
        <div className="premium-stat-card">
          <div className="card-top-row">
            <div className="card-icon-container"><FiTrendingUp size={20} /></div>
            <span className="card-pill">All Time</span>
          </div>
          <div className="card-body">
            <div className="card-label">TOTAL GROSS SALES</div>
            <div className="card-value" style={{ fontSize: '20px' }}>{fmt(data.totalSales)} ETB</div>
            <div className="card-subtext">Real + Bot combined volume</div>
          </div>
        </div>

        {/* Real Player Sales */}
        <div className="premium-stat-card" style={{ border: '2px solid #22c55e' }}>
          <div className="card-top-row">
            <div className="card-icon-container" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}><FiDollarSign size={20} /></div>
            <span className="card-pill" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>✅ Real Cash</span>
          </div>
          <div className="card-body">
            <div className="card-label">REAL PLAYER SALES</div>
            <div className="card-value" style={{ fontSize: '20px', color: '#15803d' }}>{fmt(data.realPlayerSales)} ETB</div>
            <div className="card-subtext">Commission base (non-bot tickets)</div>
          </div>
        </div>

        {/* Bot Sales */}
        <div className="premium-stat-card" style={{ border: '1px solid #fed7aa' }}>
          <div className="card-top-row">
            <div className="card-icon-container" style={{ background: 'rgba(234,179,8,0.1)', color: '#ea580c' }}><FiUsers size={20} /></div>
            <span className="card-pill" style={{ background: 'rgba(234,179,8,0.1)', color: '#ea580c' }}>⚠ Synthetic</span>
          </div>
          <div className="card-body">
            <div className="card-label">BOT SALES (FAKE)</div>
            <div className="card-value" style={{ fontSize: '20px', color: '#9a3412' }}>{fmt(data.botSales)} ETB</div>
            <div className="card-subtext">Synthetic — no commission charged</div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Commission Audit Card */}
        <div className="premium-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiDollarSign size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#3d2b1f' }}>Commission Audit</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#8c857b' }}>Expected vs Actual Deductions (Real Players Only)</p>
            </div>
          </div>

          <table className="premium-table">
            <tbody>
              <tr>
                <td style={{ color: '#8c857b' }}>Real Player Sales (Commission Base)</td>
                <td className="text-right" style={{ fontWeight: '800', color: '#15803d' }}>{fmt(data.realPlayerSales)} ETB</td>
              </tr>
              <tr>
                <td style={{ color: '#8c857b' }}>Commission Rate</td>
                <td className="text-right" style={{ fontWeight: '800' }}>{(commissionRate * 100).toFixed(0)}%</td>
              </tr>
              <tr>
                <td style={{ color: '#8c857b' }}>Expected Commissions ({(commissionRate * 100).toFixed(0)}% of Real Sales)</td>
                <td className="text-right" style={{ fontWeight: '800' }}>{fmt(expectedCommissions)} ETB</td>
              </tr>
              <tr style={{ background: commissionMismatch ? 'rgba(239, 68, 68, 0.05)' : 'rgba(34, 197, 94, 0.05)' }}>
                <td style={{ fontWeight: '700', color: '#3d2b1f' }}>Actual Deducted Commissions (Pre-Deposit Logs)</td>
                <td className="text-right" style={{ fontWeight: '900', color: commissionMismatch ? '#ef4444' : '#22c55e' }}>
                  {fmt(actualCommissions)} ETB
                </td>
              </tr>
              <tr>
                <td style={{ color: '#8c857b' }}>Variance</td>
                <td className="text-right" style={{ fontWeight: '800', color: Math.abs(actualCommissions - expectedCommissions) < 1 ? '#22c55e' : '#eab308' }}>
                  {fmt(Math.abs(actualCommissions - expectedCommissions))} ETB ({expectedCommissions > 0 ? ((Math.abs(actualCommissions - expectedCommissions) / expectedCommissions) * 100).toFixed(1) : '0'}%)
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: '16px', padding: '12px', borderRadius: '12px', background: commissionMismatch ? '#fef2f2' : '#f0fdf4', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {commissionMismatch ? <FiAlertTriangle color="#ef4444" size={20} /> : <FiCheckCircle color="#22c55e" size={20} />}
            <span style={{ fontSize: '13px', fontWeight: '600', color: commissionMismatch ? '#991b1b' : '#166534' }}>
              {commissionMismatch
                ? 'Variance detected — some historical commission logs may have included bot tickets before the fix was applied.'
                : 'Commission deductions are within acceptable tolerance of real player sales.'}
            </span>
          </div>

          {/* Info note */}
          <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <FiInfo size={14} style={{ color: '#64748b', marginTop: '2px', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.6' }}>
              Commission split: <strong>20% → Company</strong>, <strong>10% → Agent</strong> (30% total of real player stakes only). Bot sales are synthetic and never deducted from any real wallet.
            </span>
          </div>
        </div>

        {/* Agent Pre-Deposit Wallet Audit */}
        <div className="premium-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiCreditCard size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#3d2b1f' }}>Agent Pre-Deposit Audit</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#8c857b' }}>Prize Reserve Wallet — All Agents Combined</p>
            </div>
          </div>

          <table className="premium-table">
            <tbody>
              <tr>
                <td style={{ color: '#8c857b' }}>Total Admin Refills (All Agents)</td>
                <td className="text-right" style={{ fontWeight: '800', color: '#22c55e' }}>+{fmt(data.agentPreDepositTotalRecharged)} ETB</td>
              </tr>
              <tr>
                <td style={{ color: '#8c857b' }}>Total Debited (Commission Paid Out)</td>
                <td className="text-right" style={{ fontWeight: '800', color: '#ef4444' }}>-{fmt(data.agentPreDepositTotalDebited)} ETB</td>
              </tr>
              <tr style={{ background: 'rgba(34, 197, 94, 0.04)' }}>
                <td style={{ fontWeight: '700', color: '#3d2b1f' }}>Current Total Balance</td>
                <td className="text-right" style={{ fontWeight: '900', color: '#22c55e' }}>
                  {fmt(data.agentPreDepositCurrentBalance)} ETB
                </td>
              </tr>
              <tr>
                <td style={{ color: '#8c857b' }}>Active Agents</td>
                <td className="text-right" style={{ fontWeight: '800' }}>{data.agentsCount}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: '16px', padding: '12px', borderRadius: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <FiInfo size={14} style={{ color: '#3b82f6', marginTop: '2px', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: '#1e40af', lineHeight: '1.6' }}>
              The pre-deposit wallet is funded by agents in advance. Per game, 30% of real player stakes is deducted as commission. The remaining balance funds guaranteed prize payouts.
            </span>
          </div>
        </div>

        {/* Global Economy Flow */}
        <div className="premium-card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="premium-card-title">GLOBAL CASH FLOW (Real Player Deposits &amp; Withdrawals)</h3>
          <div className="stat-grid-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="premium-stat-card" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div className="card-label" style={{ color: '#166534' }}>TOTAL DEPOSITED</div>
              <div className="card-value" style={{ color: '#166534', fontSize: '22px' }}>{fmt(data.totalDeposits)} ETB</div>
              <div className="card-subtext" style={{ color: '#15803d' }}>Approved fiat entries</div>
            </div>

            <div className="premium-stat-card" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
              <div className="card-label" style={{ color: '#991b1b' }}>TOTAL WITHDRAWN</div>
              <div className="card-value" style={{ color: '#991b1b', fontSize: '22px' }}>{fmt(data.totalWithdrawals)} ETB</div>
              <div className="card-subtext" style={{ color: '#b91c1c' }}>Completed payouts</div>
            </div>

            <div className="premium-stat-card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div className="card-label" style={{ color: '#334155' }}>NET RETENTION</div>
              <div className="card-value" style={{ color: totalFlow >= 0 ? '#15803d' : '#991b1b', fontSize: '22px' }}>
                {totalFlow >= 0 ? '+' : ''}{fmt(totalFlow)} ETB
              </div>
              <div className="card-subtext" style={{ color: '#475569' }}>Deposits minus withdrawals</div>
            </div>

            <div className="premium-stat-card" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }}>
              <div className="card-label" style={{ color: '#6b21a8' }}>BUNA WALLET BALANCE</div>
              <div className="card-value" style={{ color: '#6b21a8', fontSize: '22px' }}>{fmt(data.bunaWalletBalance)} ETB</div>
              <div className="card-subtext" style={{ color: '#7c3aed' }}>System winnings ({data.totalHouseWins} house bot wins)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
