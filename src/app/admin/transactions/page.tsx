"use client";

import React, { useEffect, useState } from 'react';
import { 
  FiCheck, FiX, FiEye, FiArrowUpRight, FiArrowDownLeft, 
  FiClock, FiCreditCard, FiActivity, FiArrowUp, FiArrowDown
} from 'react-icons/fi';
import api from '@/lib/api';
import { Pagination } from '@/components/Pagination';
import '@/app/admin.css';

export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination for transaction history
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);

  // Financial summary
  const [summary, setSummary] = useState({
    pendingDepositsCount: 0,
    pendingDepositsSum: 0,
    pendingWithdrawalsCount: 0,
    pendingWithdrawalsSum: 0,
    totalDeposited: 0,
    totalWithdrawn: 0
  });

  useEffect(() => {
    fetchData();
  }, [activeTab, historyPage]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch top financial summary
      const summaryRes = await api.get('/admin/transactions/summary');
      setSummary(summaryRes.data);

      // 2. Fetch active tab data
      if (activeTab === 'pending') {
        const [depRes, wdRes] = await Promise.all([
          api.get('/admin/deposits/pending'),
          api.get('/admin/withdrawals/pending')
        ]);
        setPendingDeposits(depRes.data || []);
        setPendingWithdrawals(wdRes.data || []);
      } else {
        const txRes = await api.get(`/admin/transactions?page=${historyPage}`);
        setHistory(txRes.data.transactions || []);
        setHistoryTotalPages(txRes.data.pages || 1);
        setHistoryTotalCount(txRes.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string, type: 'deposit' | 'withdrawal') => {
    if (!confirm(`Are you sure you want to approve this ${type}?`)) return;
    try {
      const endpoint = type === 'deposit' ? `/admin/deposits/${id}/approve` : `/admin/withdrawals/${id}/approve`;
      await api.post(endpoint);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Approval failed.');
    }
  };

  const handleReject = async (id: string, type: 'deposit' | 'withdrawal') => {
    const reason = prompt(`Reason for rejecting this ${type}:`);
    if (reason === null) return;
    try {
      const endpoint = type === 'deposit' ? `/admin/deposits/${id}/reject` : `/admin/withdrawals/${id}/reject`;
      await api.post(endpoint, { reason });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Rejection failed.');
    }
  };

  return (
    <div className="admin-page">
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>Financial Hub</h1>
          <p style={{ color: '#78716c', margin: '4px 0 0', fontSize: '14px' }}>Authorize pending payments and audit ledger history</p>
        </div>
        
        <div style={{ display: 'flex', background: 'white', padding: '6px', borderRadius: '16px', border: '1px solid #e7e5e4', gap: '4px' }}>
          <button 
            className={`login-button ${activeTab === 'pending' ? 'active' : ''}`}
            style={{ 
              padding: '10px 20px', 
              borderRadius: '12px', 
              background: activeTab === 'pending' ? '#3d2b1f' : 'transparent', 
              color: activeTab === 'pending' ? 'white' : '#3d2b1f',
              width: 'auto'
            }}
            onClick={() => { setActiveTab('pending'); setHistoryPage(1); }}
          >
            Pending Requests { (summary.pendingDepositsCount + summary.pendingWithdrawalsCount) > 0 && (
              <span style={{ background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', marginLeft: '6px', fontWeight: '800' }}>
                {summary.pendingDepositsCount + summary.pendingWithdrawalsCount}
              </span>
            )}
          </button>
          <button 
            className={`login-button ${activeTab === 'history' ? 'active' : ''}`}
            style={{ 
              padding: '10px 20px', 
              borderRadius: '12px', 
              background: activeTab === 'history' ? '#3d2b1f' : 'transparent', 
              color: activeTab === 'history' ? 'white' : '#3d2b1f',
              width: 'auto'
            }}
            onClick={() => setActiveTab('history')}
          >
            Transaction History
          </button>
        </div>
      </div>

      {/* Top summary about transactions history (beautifully implemented!) */}
      <div className="stat-grid-4">
        <div className="premium-stat-card" style={{ borderLeft: '4px solid #eab308' }}>
          <div className="card-top-row">
            <div className="card-icon-container" style={{ background: '#fef9c3', color: '#ca8a04' }}>
              <FiClock size={20} />
            </div>
            <span className="card-pill" style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#ca8a04' }}>Pending</span>
          </div>
          <div className="card-body">
            <div className="card-label">PENDING DEPOSITS</div>
            <div className="card-value">{summary.pendingDepositsSum.toLocaleString()} ETB</div>
            <div className="card-subtext">{summary.pendingDepositsCount} pending request{summary.pendingDepositsCount !== 1 ? 's' : ''}</div>
          </div>
        </div>

        <div className="premium-stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="card-top-row">
            <div className="card-icon-container" style={{ background: '#fee2e2', color: '#dc2626' }}>
              <FiCreditCard size={20} />
            </div>
            <span className="card-pill" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}>Pending</span>
          </div>
          <div className="card-body">
            <div className="card-label">PENDING WITHDRAWALS</div>
            <div className="card-value">{summary.pendingWithdrawalsSum.toLocaleString()} ETB</div>
            <div className="card-subtext">{summary.pendingWithdrawalsCount} pending request{summary.pendingWithdrawalsCount !== 1 ? 's' : ''}</div>
          </div>
        </div>

        <div className="premium-stat-card" style={{ borderLeft: '4px solid #22c55e' }}>
          <div className="card-top-row">
            <div className="card-icon-container" style={{ background: '#dcfce7', color: '#16a34a' }}>
              <FiArrowDownLeft size={20} />
            </div>
            <span className="card-pill" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a' }}>Volume</span>
          </div>
          <div className="card-body">
            <div className="card-label">TOTAL DEPOSITED</div>
            <div className="card-value">{summary.totalDeposited.toLocaleString()} ETB</div>
            <div className="card-subtext">Approved and credited</div>
          </div>
        </div>

        <div className="premium-stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="card-top-row">
            <div className="card-icon-container" style={{ background: '#dbeafe', color: '#2563eb' }}>
              <FiArrowUpRight size={20} />
            </div>
            <span className="card-pill" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb' }}>Volume</span>
          </div>
          <div className="card-body">
            <div className="card-label">TOTAL WITHDRAWN</div>
            <div className="card-value">{summary.totalWithdrawn.toLocaleString()} ETB</div>
            <div className="card-subtext">Approved and paid out</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '100px', textAlign: 'center' }}>
          <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid #d4af37', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }}></div>
          <p style={{ marginTop: '16px', fontWeight: '700', color: '#3d2b1f' }}>Reviewing ledger...</p>
        </div>
      ) : activeTab === 'pending' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          {/* Pending Deposits */}
          <section>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#3d2b1f', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FiArrowDownLeft style={{ color: '#22c55e' }} /> Deposit Requests
            </h2>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Reference</th>
                    <th>Proof</th>
                    <th>Time</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDeposits.map((d: any) => (
                    <tr key={d.id}>
                      <td>
                        <div style={{ fontWeight: '700' }}>{d.user?.firstName || 'Player'}</div>
                        <div style={{ fontSize: '12px', color: '#78716c' }}>ID: {d.user?.telegramId?.toString()}</div>
                      </td>
                      <td style={{ fontWeight: '800', color: '#22c55e' }}>+{parseFloat(d.amount).toLocaleString()} ETB</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: '600' }}>{d.reference || d.txnId || 'N/A'}</td>
                      <td>
                        {d.receiptUrl ? (
                          <a href={d.receiptUrl} target="_blank" rel="noopener noreferrer" className="badge badge-gold" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <FiEye size={12} /> View Slip
                          </a>
                        ) : 'No Proof'}
                      </td>
                      <td style={{ color: '#78716c', fontSize: '13px' }}>{new Date(d.createdAt).toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button onClick={() => handleApprove(d.id, 'deposit')} className="login-button" style={{ padding: '8px', background: '#f0fdf4', color: '#22c55e', width: 'auto', minWidth: '40px' }} title="Approve Deposit"><FiCheck /></button>
                          <button onClick={() => handleReject(d.id, 'deposit')} className="login-button" style={{ padding: '8px', background: '#fef2f2', color: '#ef4444', width: 'auto', minWidth: '40px' }} title="Reject Deposit"><FiX /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pendingDeposits.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#78716c' }}>No pending deposits.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          {/* Pending Withdrawals */}
          <section>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#3d2b1f', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FiArrowUpRight style={{ color: '#3b82f6' }} /> Withdrawal Requests
            </h2>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Account Info</th>
                    <th>Bank</th>
                    <th>Time</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingWithdrawals.map((w: any) => (
                    <tr key={w.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ fontWeight: '700' }}>{w.user?.firstName || 'Player'}</div>
                          {w.user && (
                            <span 
                              style={{ 
                                fontSize: '10px', 
                                padding: '2px 6px', 
                                fontWeight: '800',
                                background: w.isBalanceLegit ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: w.isBalanceLegit ? '#22c55e' : '#ef4444',
                                borderRadius: '4px'
                              }}
                            >
                              Bal: {Number(w.user.wallet?.balance || 0).toFixed(2)} ETB {w.isBalanceLegit ? '✓' : '⚠️'}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: '#78716c' }}>ID: {w.user?.telegramId?.toString()}</div>
                      </td>
                      <td style={{ fontWeight: '800', color: '#ef4444' }}>-{parseFloat(w.amount).toLocaleString()} ETB</td>
                      <td>
                        <div style={{ fontWeight: '700' }}>{w.accountName}</div>
                        <div style={{ fontSize: '13px', color: '#3d2b1f', fontFamily: 'monospace' }}>{w.accountNumber}</div>
                      </td>
                      <td>
                        <span className="badge badge-blue">{w.bankName}</span>
                      </td>
                      <td style={{ color: '#78716c', fontSize: '13px' }}>{new Date(w.createdAt).toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button onClick={() => handleApprove(w.id, 'withdrawal')} className="login-button" style={{ padding: '8px', background: '#f0fdf4', color: '#22c55e', width: 'auto', minWidth: '40px' }} title="Approve Withdrawal"><FiCheck /></button>
                          <button onClick={() => handleReject(w.id, 'withdrawal')} className="login-button" style={{ padding: '8px', background: '#fef2f2', color: '#ef4444', width: 'auto', minWidth: '40px' }} title="Reject Withdrawal"><FiX /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pendingWithdrawals.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#78716c' }}>No pending withdrawals.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : (
        /* Transaction Ledger History */
        <div>
          <div className="data-table-container" style={{ marginBottom: '24px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Balance After</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((tx: any) => (
                  <tr key={tx.id}>
                    <td>
                      <div style={{ fontWeight: '700' }}>{tx.user?.firstName || 'Player'}</div>
                      <div style={{ fontSize: '12px', color: '#78716c' }}>ID: {tx.user?.telegramId?.toString()}</div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#78716c' }}>{tx.id.slice(0, 18)}...</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
                        {tx.type === 'DEPOSIT' || tx.type === 'PRIZE_WIN' || tx.type === 'REFERRAL_BONUS' || tx.type === 'REFUND' ? (
                          <FiArrowDownLeft color="#22c55e" />
                        ) : (
                          <FiArrowUpRight color="#ef4444" />
                        )}
                        {tx.type}
                      </div>
                    </td>
                    <td style={{ fontWeight: '800', color: tx.type === 'DEPOSIT' || tx.type === 'PRIZE_WIN' || tx.type === 'REFERRAL_BONUS' || tx.type === 'REFUND' ? '#22c55e' : '#ef4444' }}>
                      {tx.type === 'DEPOSIT' || tx.type === 'PRIZE_WIN' || tx.type === 'REFERRAL_BONUS' || tx.type === 'REFUND' ? '+' : '-'}{parseFloat(tx.amount).toLocaleString()} ETB
                    </td>
                    <td style={{ fontWeight: '700' }}>{parseFloat(tx.balanceAfter).toLocaleString()} ETB</td>
                    <td>
                      <span className={`badge ${tx.status?.toUpperCase() === 'COMPLETED' ? 'badge-green' : 'badge-gold'}`}>
                        {tx.status?.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ color: '#78716c', fontSize: '13px' }}>{new Date(tx.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {history.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '60px', color: '#78716c' }}>No transaction history found.</td></tr>}
              </tbody>
            </table>
          </div>

          <Pagination 
            currentPage={historyPage} 
            totalPages={historyTotalPages} 
            onPageChange={setHistoryPage} 
            loading={loading}
          />
        </div>
      )}
    </div>
  );
}
