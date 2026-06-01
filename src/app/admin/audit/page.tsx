"use client";

import React, { useEffect, useState } from 'react';
import { FiShield, FiAlertTriangle, FiCheckCircle, FiDollarSign } from 'react-icons/fi';
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

  // Auditing logic
  const companyRevenueMismatch = Math.abs(data.totalCommissionsDeducted - data.expectedCommissions) > 1; // 1 ETB tolerance
  const totalFlow = data.totalDeposits - data.totalWithdrawals;

  return (
    <div className="admin-page">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#3d2b1f', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FiShield style={{ color: '#d4af37' }} />
          SYSTEM AUDIT & DATA REALITY SYNC
        </h1>
        <p style={{ color: '#8c857b', marginTop: '8px' }}>
          Real-time financial verification comparing actual wallet balances vs logged metrics.
        </p>
      </div>

      <div className="dashboard-grid">
        {/* Company Commission Audit */}
        <div className="premium-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiDollarSign size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#3d2b1f' }}>Commission Audit</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#8c857b' }}>Expected vs Actual Deductions</p>
            </div>
          </div>

          <table className="premium-table">
            <tbody>
              <tr>
                <td style={{ color: '#8c857b' }}>Gross Sales (All Time)</td>
                <td className="text-right" style={{ fontWeight: '800' }}>{data.totalSales.toLocaleString()} ETB</td>
              </tr>
              <tr>
                <td style={{ color: '#8c857b' }}>Expected Company Revenue ({(data.commissionRate ? data.commissionRate * 100 : 12.5).toFixed(1)}%)</td>
                <td className="text-right" style={{ fontWeight: '800' }}>{data.expectedCommissions.toLocaleString()} ETB</td>
              </tr>
              <tr style={{ background: companyRevenueMismatch ? 'rgba(239, 68, 68, 0.05)' : 'rgba(34, 197, 94, 0.05)' }}>
                <td style={{ fontWeight: '700', color: '#3d2b1f' }}>Actual Deducted Commissions</td>
                <td className="text-right" style={{ fontWeight: '900', color: companyRevenueMismatch ? '#ef4444' : '#22c55e' }}>
                  {data.totalCommissionsDeducted.toLocaleString()} ETB
                </td>
              </tr>
            </tbody>
          </table>
          
          <div style={{ marginTop: '16px', padding: '12px', borderRadius: '12px', background: companyRevenueMismatch ? '#fef2f2' : '#f0fdf4', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {companyRevenueMismatch ? <FiAlertTriangle color="#ef4444" size={20} /> : <FiCheckCircle color="#22c55e" size={20} />}
            <span style={{ fontSize: '13px', fontWeight: '600', color: companyRevenueMismatch ? '#991b1b' : '#166534' }}>
              {companyRevenueMismatch ? 'Discrepancy detected in commission tracking!' : 'Commission deductions are perfectly synced with total sales.'}
            </span>
          </div>
        </div>

        {/* Buna Wallet / House Bot Audit */}
        <div className="premium-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiShield size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#3d2b1f' }}>Buna Wallet Audit</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#8c857b' }}>System Winnings Verification</p>
            </div>
          </div>

          <table className="premium-table">
            <tbody>
              <tr>
                <td style={{ color: '#8c857b' }}>Total House Bot Wins</td>
                <td className="text-right" style={{ fontWeight: '800' }}>{data.totalHouseWins.toLocaleString()} Games</td>
              </tr>
              <tr>
                <td style={{ fontWeight: '700', color: '#3d2b1f' }}>Actual System Wallet Balance</td>
                <td className="text-right" style={{ fontWeight: '900', color: '#22c55e' }}>
                  {data.bunaWalletBalance.toLocaleString()} ETB
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: '16px', padding: '12px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '13px', color: '#64748b' }}>
            The Buna Wallet receives exactly 75% of the prize pool every time the House Bot wins a game. The balance above represents total collected system winnings.
          </div>
        </div>

        {/* Global Economy Flow */}
        <div className="premium-card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="premium-card-title">GLOBAL ECONOMY FLOW</h3>
          <div className="stat-grid-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="premium-stat-card" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
              <div className="card-label" style={{ color: '#166534' }}>TOTAL DEPOSITS</div>
              <div className="card-value" style={{ color: '#166534' }}>{data.totalDeposits.toLocaleString()} ETB</div>
              <div className="card-subtext" style={{ color: '#15803d' }}>Approved Fiat Entries</div>
            </div>
            
            <div className="premium-stat-card" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
              <div className="card-label" style={{ color: '#991b1b' }}>TOTAL WITHDRAWALS</div>
              <div className="card-value" style={{ color: '#991b1b' }}>{data.totalWithdrawals.toLocaleString()} ETB</div>
              <div className="card-subtext" style={{ color: '#b91c1c' }}>Completed Payouts</div>
            </div>
            
            <div className="premium-stat-card" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
              <div className="card-label" style={{ color: '#334155' }}>SYSTEM NET RETENTION</div>
              <div className="card-value" style={{ color: '#0f172a' }}>{totalFlow.toLocaleString()} ETB</div>
              <div className="card-subtext" style={{ color: '#475569' }}>Deposits minus Withdrawals</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
