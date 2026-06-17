"use client";

import React, { useEffect, useState } from 'react';
import { FiShield, FiAlertTriangle, FiCheckCircle, FiDollarSign, FiTrendingUp, FiUsers, FiCreditCard, FiInfo, FiArrowDownLeft, FiArrowUpRight } from 'react-icons/fi';
import api from '@/lib/api';
import '@/app/admin.css';

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

  const commissionRate = data.commissionRate || 0.30;
  const agentRate = data.agentRate || 0.10;
  const companyRate = data.companyCommissionRate || (commissionRate - agentRate);
  const expectedCommissions = data.expectedCommissions;
  const actualCommissions = data.totalCommissionsDeducted;
  const tolerance = expectedCommissions * 0.05;
  const commissionMismatch = Math.abs(actualCommissions - expectedCommissions) > Math.max(tolerance, 1);
  const totalFlow = data.totalDeposits - data.totalWithdrawals;

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPct = (rate: number) => (rate * 100).toFixed(0) + '%';

  // The real money the company pockets
  const realProfit = data.companyCommissionEarned || 0;
  const netCashFlow = data.netCashFlow ?? totalFlow;

  return (
    <div className="admin-page">
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#3d2b1f', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '28px' }}>🔍</span> System Audit
        </h1>
        <p style={{ color: '#8c857b', marginTop: '8px', fontSize: '14px', lineHeight: '1.6' }}>
          Real-time financial verification. Commission is charged <strong>only on real player cash sales</strong> — bonus ETB and house bot purchases are excluded.
        </p>
        {/* Cash-only banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px',
          background: 'linear-gradient(90deg, #f0fdf4, #dcfce7)', border: '1px solid #86efac',
          borderRadius: '12px', padding: '10px 16px'
        }}>
          <span style={{ fontSize: '18px' }}>✅</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#15803d' }}>All profit metrics use Real Cash Only</div>
            <div style={{ fontSize: '12px', color: '#4ade80' }}>Bonus ETB spent on tickets is fully excluded from company revenue, agent earnings, and commission calculations.</div>
          </div>
        </div>
      </div>

      {/* ─── COMPANY REAL PROFIT (TOP HERO) ─── */}
      <div style={{
        background: 'linear-gradient(135deg, #1a0a00 0%, #3d2b1f 60%, #5c3d2e 100%)',
        borderRadius: '20px',
        padding: '28px 32px',
        marginBottom: '28px',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', background: 'rgba(212,175,55,0.08)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-60px', right: '80px', width: '160px', height: '160px', background: 'rgba(212,175,55,0.05)', borderRadius: '50%' }} />

        <div style={{ fontSize: '13px', fontWeight: '700', color: '#d4af37', letterSpacing: '2px', marginBottom: '8px', textTransform: 'uppercase' }}>
          🏦 Company Real Profit (Your Money)
        </div>
        <div style={{ fontSize: '48px', fontWeight: '900', color: '#d4af37', lineHeight: 1.1, marginBottom: '8px' }}>
          {fmt(realProfit)} ETB
        </div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)', marginBottom: '24px' }}>
          {fmtPct(companyRate)} of {fmt(data.realPlayerSales)} ETB real player ticket sales
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', fontWeight: '700', letterSpacing: '1px', marginBottom: '6px' }}>AGENT SHARE ({fmtPct(agentRate)})</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#fbbf24' }}>{fmt(data.agentCommissionEarned || 0)} ETB</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>Paid to agents</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', fontWeight: '700', letterSpacing: '1px', marginBottom: '6px' }}>NET CASH FLOW</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: netCashFlow >= 0 ? '#4ade80' : '#f87171' }}>
              {netCashFlow >= 0 ? '+' : ''}{fmt(netCashFlow)} ETB
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>Deposits − Withdrawals</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', fontWeight: '700', letterSpacing: '1px', marginBottom: '6px' }}>HOUSE EDGE (GAMES)</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: (data.houseEdgeFromRealPlayers || 0) >= 0 ? '#4ade80' : '#f87171' }}>
              {fmt(data.houseEdgeFromRealPlayers || 0)} ETB
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>Ticket sales − prizes paid</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', fontWeight: '700', letterSpacing: '1px', marginBottom: '6px' }}>PRIZES PAID OUT</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#f87171' }}>{fmt(data.realPlayerPrizes || 0)} ETB</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>To real players</div>
          </div>
        </div>
      </div>

      {/* Row 1: Sales Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        <div className="premium-stat-card">
          <div className="card-top-row">
            <div className="card-icon-container"><FiTrendingUp size={20} /></div>
            <span className="card-pill">All Time</span>
          </div>
          <div className="card-body">
            <div className="card-label">TOTAL GROSS SALES</div>
            <div className="card-value" style={{ fontSize: '22px' }}>{fmt(data.totalSales)} ETB</div>
            <div className="card-subtext">Real + Bot combined volume</div>
          </div>
        </div>

        <div className="premium-stat-card" style={{ border: '2px solid #22c55e' }}>
          <div className="card-top-row">
            <div className="card-icon-container" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}><FiDollarSign size={20} /></div>
            <span className="card-pill" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>✅ Real Cash</span>
          </div>
          <div className="card-body">
            <div className="card-label">REAL PLAYER SALES (CASH ONLY)</div>
            <div className="card-value" style={{ fontSize: '22px', color: '#15803d' }}>{fmt(data.realPlayerSales)} ETB</div>
            <div className="card-subtext">Deposited ETB only · bonus balance excluded</div>
          </div>
        </div>

        <div className="premium-stat-card" style={{ border: '1px solid #fed7aa' }}>
          <div className="card-top-row">
            <div className="card-icon-container" style={{ background: 'rgba(234,179,8,0.1)', color: '#ea580c' }}><FiUsers size={20} /></div>
            <span className="card-pill" style={{ background: 'rgba(234,179,8,0.1)', color: '#ea580c' }}>⚠ Synthetic</span>
          </div>
          <div className="card-body">
            <div className="card-label">BOT SALES (FAKE)</div>
            <div className="card-value" style={{ fontSize: '22px', color: '#9a3412' }}>{fmt(data.botSales)} ETB</div>
            <div className="card-subtext">Synthetic — no commission charged</div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>

        {/* Profit Breakdown Card */}
        <div className="premium-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(212,175,55,0.15)', color: '#d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '22px' }}>💰</span>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#3d2b1f' }}>Profit Breakdown</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#8c857b' }}>How the {fmtPct(commissionRate)} commission is split</p>
            </div>
          </div>

          <table className="premium-table">
            <tbody>
              <tr>
                <td style={{ color: '#8c857b' }}>Real Player Ticket Sales</td>
                <td className="text-right" style={{ fontWeight: '800', color: '#15803d' }}>{fmt(data.realPlayerSales)} ETB</td>
              </tr>
              <tr>
                <td style={{ color: '#8c857b' }}>Total Commission Rate</td>
                <td className="text-right" style={{ fontWeight: '800' }}>{fmtPct(commissionRate)}</td>
              </tr>
              <tr style={{ background: 'rgba(212,175,55,0.06)', borderRadius: '8px' }}>
                <td style={{ fontWeight: '700', color: '#3d2b1f' }}>→ Company Share ({fmtPct(companyRate)})</td>
                <td className="text-right" style={{ fontWeight: '900', color: '#d4af37', fontSize: '16px' }}>{fmt(realProfit)} ETB</td>
              </tr>
              <tr>
                <td style={{ color: '#8c857b' }}>→ Agent Share ({fmtPct(agentRate)})</td>
                <td className="text-right" style={{ fontWeight: '800', color: '#78716c' }}>{fmt(data.agentCommissionEarned || 0)} ETB</td>
              </tr>
              <tr style={{ borderTop: '1px solid #f0ece8' }}>
                <td style={{ color: '#8c857b' }}>Prizes Paid to Real Players</td>
                <td className="text-right" style={{ fontWeight: '800', color: '#ef4444' }}>-{fmt(data.realPlayerPrizes || 0)} ETB</td>
              </tr>
              <tr style={{ background: 'rgba(34,197,94,0.05)' }}>
                <td style={{ fontWeight: '700', color: '#3d2b1f' }}>Game House Edge (Sales − Prizes)</td>
                <td className="text-right" style={{ fontWeight: '900', color: (data.houseEdgeFromRealPlayers || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                  {fmt(data.houseEdgeFromRealPlayers || 0)} ETB
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '12px', background: '#fefce8', border: '1px solid #fde68a', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <FiInfo size={14} style={{ color: '#ca8a04', marginTop: '2px', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: '#713f12', lineHeight: '1.6' }}>
              <strong>Your real money</strong> = {fmtPct(companyRate)} × real player ticket sales = <strong>{fmt(realProfit)} ETB</strong>. This is the commission portion that flows to the company — not agent payouts, not prizes.
            </span>
          </div>
        </div>

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
                <td className="text-right" style={{ fontWeight: '800' }}>{fmtPct(commissionRate)}</td>
              </tr>
              <tr>
                <td style={{ color: '#8c857b' }}>Expected Commissions ({fmtPct(commissionRate)} of Real Sales)</td>
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
                ? (actualCommissions > expectedCommissions
                    ? 'Overcharge variance: Some historical commission logs may have included bot tickets before the bot-exclusion fix was applied.'
                    : 'Undercharge variance: Some historical games were played before the commission system was enabled, or by players without an assigned agent.')
                : 'Commission deductions are within acceptable tolerance of real player sales.'}
            </span>
          </div>

          <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <FiInfo size={14} style={{ color: '#64748b', marginTop: '2px', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.6' }}>
              Commission split: <strong>{fmtPct(companyRate)} → Company</strong>, <strong>{fmtPct(agentRate)} → Agent</strong> ({fmtPct(commissionRate)} total of real player stakes only). Bot sales are synthetic and never deducted from any real wallet.
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
                <td className="text-right" style={{ fontWeight: '900', color: data.agentPreDepositCurrentBalance >= 0 ? '#22c55e' : '#ef4444' }}>
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
              The pre-deposit wallet is funded by agents in advance. Per game, {fmtPct(commissionRate)} of real player stakes is deducted as commission. The remaining balance funds guaranteed prize payouts.
            </span>
          </div>
        </div>

        {/* Global Economy Flow */}
        <div className="premium-card">
          <h3 className="premium-card-title">GLOBAL CASH FLOW (Real Player Deposits &amp; Withdrawals)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginTop: '8px' }}>
            <div className="premium-stat-card" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <FiArrowDownLeft color="#16a34a" size={16} />
                <div className="card-label" style={{ color: '#166534', fontSize: '13px', margin: 0 }}>TOTAL DEPOSITED</div>
              </div>
              <div className="card-value" style={{ color: '#166534', fontSize: '28px', fontWeight: '900' }}>{fmt(data.totalDeposits)} ETB</div>
              <div className="card-subtext" style={{ color: '#15803d', marginTop: '6px' }}>Approved fiat entries</div>
            </div>

            <div className="premium-stat-card" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <FiArrowUpRight color="#b91c1c" size={16} />
                <div className="card-label" style={{ color: '#991b1b', fontSize: '13px', margin: 0 }}>TOTAL WITHDRAWN</div>
              </div>
              <div className="card-value" style={{ color: '#991b1b', fontSize: '28px', fontWeight: '900' }}>{fmt(data.totalWithdrawals)} ETB</div>
              <div className="card-subtext" style={{ color: '#b91c1c', marginTop: '6px' }}>Completed payouts</div>
            </div>

            <div className="premium-stat-card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div className="card-label" style={{ color: '#334155', fontSize: '13px', marginBottom: '8px' }}>NET RETENTION</div>
              <div className="card-value" style={{ color: netCashFlow >= 0 ? '#15803d' : '#991b1b', fontSize: '28px', fontWeight: '900' }}>
                {netCashFlow >= 0 ? '+' : ''}{fmt(netCashFlow)} ETB
              </div>
              <div className="card-subtext" style={{ color: '#475569', marginTop: '6px' }}>Deposits minus withdrawals</div>
            </div>

            <div className="premium-stat-card" style={{ background: '#fefce8', border: '1px solid #fde68a' }}>
              <div className="card-label" style={{ color: '#713f12', fontSize: '13px', marginBottom: '8px' }}>BUNA WALLET (HOUSE WINS)</div>
              <div className="card-value" style={{
                color: Number(data.bunaWalletBalance) >= 0 ? '#713f12' : '#991b1b',
                fontSize: '22px',
                fontWeight: '900'
              }}>
                {fmt(data.bunaWalletBalance)} ETB
              </div>
              <div className="card-subtext" style={{ color: '#92400e', marginTop: '6px' }}>
                {data.totalHouseWins} house bot wins accumulated
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
