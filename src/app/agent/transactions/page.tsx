"use client";

import React, { useEffect, useState, useCallback } from 'react';
import {
  FiCheck, FiX, FiEye, FiArrowUpRight, FiArrowDownLeft,
  FiClock, FiCreditCard, FiActivity, FiRefreshCw
} from 'react-icons/fi';
import api from '@/lib/api';
import { Pagination } from '@/components/Pagination';

const CREDIT_TYPES = new Set(['DEPOSIT', 'PRIZE_WIN', 'REFERRAL_BONUS', 'REFERRAL_COMMISSION', 'REFUND']);

export default function AgentTransactionsPage() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);

  const [summary, setSummary] = useState({
    pendingDepositsCount: 0,
    pendingDepositsSum: 0,
    pendingWithdrawalsCount: 0,
    pendingWithdrawalsSum: 0,
    totalDeposited: 0,
    totalWithdrawn: 0,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const summaryRes = await api.get('/agent/transactions/summary');
      setSummary(summaryRes.data);

      if (activeTab === 'pending') {
        const [depRes, wdRes] = await Promise.all([
          api.get('/agent/deposits/pending'),
          api.get('/agent/withdrawals/pending'),
        ]);
        setPendingDeposits(depRes.data || []);
        setPendingWithdrawals(wdRes.data || []);
      } else {
        const txRes = await api.get(`/agent/transactions?page=${historyPage}`);
        setHistory(txRes.data.transactions || []);
        setHistoryTotalPages(txRes.data.pages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, historyPage]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (id: string, type: 'deposit' | 'withdrawal', action: 'approve' | 'reject') => {
    if (action === 'reject') {
      const reason = prompt(`Reason for rejecting this ${type}:`);
      if (reason === null) return;
      try {
        setActionLoading(id);
        await api.post(`/agent/${type}s/${id}/reject`, { reason });
        fetchData();
      } catch (err: any) {
        alert(err.response?.data?.error || 'Rejection failed.');
      } finally { setActionLoading(null); }
    } else {
      if (!confirm(`Approve this ${type}?`)) return;
      try {
        setActionLoading(id);
        await api.post(`/agent/${type}s/${id}/approve`);
        fetchData();
      } catch (err: any) {
        alert(err.response?.data?.error || 'Approval failed.');
      } finally { setActionLoading(null); }
    }
  };

  const totalPending = summary.pendingDepositsCount + summary.pendingWithdrawalsCount;

  return (
    <div className="agent-space-y-8">

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '8px' }}>
        <div>
          <h1 className="agent-h1">Financial Hub</h1>
          <p className="agent-subtitle">Authorize branch payments and audit ledger history.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '5px', borderRadius: '16px', border: '1px solid var(--agent-border)', gap: '4px' }}>
            <button
              onClick={() => { setActiveTab('pending'); }}
              style={{
                padding: '10px 18px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '13px',
                background: activeTab === 'pending' ? 'var(--agent-accent)' : 'transparent',
                color: activeTab === 'pending' ? '#000' : 'var(--agent-muted)',
                transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              Pending Requests
              {totalPending > 0 && (
                <span style={{ background: '#ef4444', color: 'white', padding: '2px 7px', borderRadius: '8px', fontSize: '10px', fontWeight: '900' }}>
                  {totalPending}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              style={{
                padding: '10px 18px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '13px',
                background: activeTab === 'history' ? 'var(--agent-accent)' : 'transparent',
                color: activeTab === 'history' ? '#000' : 'var(--agent-muted)',
                transition: 'all 0.2s'
              }}
            >
              Transaction History
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchData}
            title="Refresh"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--agent-border)', borderRadius: '12px', padding: '10px 14px', cursor: 'pointer', color: 'var(--agent-muted)', display: 'flex', alignItems: 'center' }}
          >
            <FiRefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {/* Pending Deposits */}
        <div className="agent-stat-card" style={{ borderLeft: '4px solid #eab308' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ background: 'rgba(234,179,8,0.15)', borderRadius: '10px', padding: '8px', color: '#eab308' }}><FiClock size={18} /></div>
            <span style={{ fontSize: '10px', fontWeight: '900', color: '#eab308', background: 'rgba(234,179,8,0.1)', padding: '4px 10px', borderRadius: '8px', textTransform: 'uppercase' }}>Pending</span>
          </div>
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--agent-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Pending Deposits</div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#1c1917' }}>{summary.pendingDepositsSum.toLocaleString()} <span style={{ fontSize: '13px', color: 'var(--agent-muted)' }}>ETB</span></div>
          <div style={{ fontSize: '12px', color: 'var(--agent-muted)', marginTop: '4px' }}>{summary.pendingDepositsCount} pending request{summary.pendingDepositsCount !== 1 ? 's' : ''}</div>
        </div>

        {/* Pending Withdrawals */}
        <div className="agent-stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ background: 'rgba(239,68,68,0.15)', borderRadius: '10px', padding: '8px', color: '#ef4444' }}><FiCreditCard size={18} /></div>
            <span style={{ fontSize: '10px', fontWeight: '900', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '4px 10px', borderRadius: '8px', textTransform: 'uppercase' }}>Pending</span>
          </div>
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--agent-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Pending Withdrawals</div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#1c1917' }}>{summary.pendingWithdrawalsSum.toLocaleString()} <span style={{ fontSize: '13px', color: 'var(--agent-muted)' }}>ETB</span></div>
          <div style={{ fontSize: '12px', color: 'var(--agent-muted)', marginTop: '4px' }}>{summary.pendingWithdrawalsCount} pending request{summary.pendingWithdrawalsCount !== 1 ? 's' : ''}</div>
        </div>

        {/* Total Deposited */}
        <div className="agent-stat-card" style={{ borderLeft: '4px solid #22c55e' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ background: 'rgba(34,197,94,0.15)', borderRadius: '10px', padding: '8px', color: '#22c55e' }}><FiArrowDownLeft size={18} /></div>
            <span style={{ fontSize: '10px', fontWeight: '900', color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '4px 10px', borderRadius: '8px', textTransform: 'uppercase' }}>Volume</span>
          </div>
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--agent-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Total Deposited</div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#1c1917' }}>{summary.totalDeposited.toLocaleString()} <span style={{ fontSize: '13px', color: 'var(--agent-muted)' }}>ETB</span></div>
          <div style={{ fontSize: '12px', color: 'var(--agent-muted)', marginTop: '4px' }}>Approved and credited</div>
        </div>

        {/* Total Withdrawn */}
        <div className="agent-stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ background: 'rgba(59,130,246,0.15)', borderRadius: '10px', padding: '8px', color: '#3b82f6' }}><FiArrowUpRight size={18} /></div>
            <span style={{ fontSize: '10px', fontWeight: '900', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '4px 10px', borderRadius: '8px', textTransform: 'uppercase' }}>Volume</span>
          </div>
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--agent-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Total Withdrawn</div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#1c1917' }}>{summary.totalWithdrawn.toLocaleString()} <span style={{ fontSize: '13px', color: 'var(--agent-muted)' }}>ETB</span></div>
          <div style={{ fontSize: '12px', color: 'var(--agent-muted)', marginTop: '4px' }}>Approved and paid out</div>
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ padding: '80px', textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid var(--agent-accent)', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ marginTop: '16px', color: 'var(--agent-muted)', fontWeight: '700' }}>Loading branch financials…</p>
        </div>
      ) : activeTab === 'pending' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>

          {/* ── Pending Deposits ── */}
          <section>
            <h2 style={{ fontSize: '16px', fontWeight: '900', color: '#1c1917', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FiArrowDownLeft style={{ color: '#22c55e' }} /> Deposit Requests
              <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '3px 10px', borderRadius: '8px', fontSize: '12px' }}>{pendingDeposits.length}</span>
            </h2>
            <div className="agent-table-wrap">
              <div className="agent-table-scroll">
                <table className="agent-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Amount</th>
                      <th>Reference</th>
                      <th>Proof</th>
                      <th>Time</th>
                      <th className="right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingDeposits.length === 0 ? (
                      <tr className="agent-table-empty"><td colSpan={6}>No pending deposits 🎉</td></tr>
                    ) : pendingDeposits.map((d: any) => (
                      <tr key={d.id}>
                        <td>
                          <div style={{ fontWeight: '700', color: '#1c1917' }}>{d.user?.firstName || 'Player'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--agent-muted)' }}>ID: {d.user?.telegramId?.toString()}</div>
                        </td>
                        <td style={{ fontWeight: '800', color: '#22c55e' }}>+{parseFloat(d.amount).toLocaleString()} ETB</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--agent-muted)' }}>{d.txnId || 'N/A'}</td>
                        <td>
                          {d.receiptUrl ? (
                            <a href={d.receiptUrl.startsWith('http') ? d.receiptUrl : `${api.defaults.baseURL?.replace('/api', '')}/api/file/${d.receiptUrl}`} target="_blank" rel="noopener noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(212,175,55,0.15)', color: 'var(--agent-accent)', padding: '4px 10px', borderRadius: '8px', textDecoration: 'none', fontSize: '12px', fontWeight: '700' }}>
                              <FiEye size={12} /> View Slip
                            </a>
                          ) : <span style={{ color: 'var(--agent-muted)', fontSize: '12px' }}>No Proof</span>}
                        </td>
                        <td style={{ color: 'var(--agent-muted)', fontSize: '12px' }}>{new Date(d.createdAt).toLocaleString()}</td>
                        <td className="right">
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleAction(d.id, 'deposit', 'approve')}
                              disabled={actionLoading === d.id}
                              title="Approve"
                              style={{ padding: '8px 12px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              {actionLoading === d.id ? '…' : <><FiCheck size={13} /> Approve</>}
                            </button>
                            <button
                              onClick={() => handleAction(d.id, 'deposit', 'reject')}
                              disabled={actionLoading === d.id}
                              title="Reject"
                              style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <FiX size={13} /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ── Pending Withdrawals ── */}
          <section>
            <h2 style={{ fontSize: '16px', fontWeight: '900', color: '#1c1917', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FiArrowUpRight style={{ color: '#3b82f6' }} /> Withdrawal Requests
              <span style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '3px 10px', borderRadius: '8px', fontSize: '12px' }}>{pendingWithdrawals.length}</span>
            </h2>
            <div className="agent-table-wrap">
              <div className="agent-table-scroll">
                <table className="agent-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Amount</th>
                      <th>Account Info</th>
                      <th>Bank</th>
                      <th>Balance</th>
                      <th>Time</th>
                      <th className="right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingWithdrawals.length === 0 ? (
                      <tr className="agent-table-empty"><td colSpan={7}>No pending withdrawals 🎉</td></tr>
                    ) : pendingWithdrawals.map((w: any) => (
                      <tr key={w.id}>
                        <td>
                          <div style={{ fontWeight: '700', color: '#1c1917' }}>{w.user?.firstName || 'Player'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--agent-muted)' }}>ID: {w.user?.telegramId?.toString()}</div>
                        </td>
                        <td style={{ fontWeight: '800', color: '#ef4444' }}>-{parseFloat(w.amount).toLocaleString()} ETB</td>
                        <td>
                          <div style={{ fontWeight: '700', color: '#1c1917' }}>{w.accountName}</div>
                          <div style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--agent-muted)' }}>{w.accountNumber}</div>
                        </td>
                        <td>
                          <span style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '3px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '800' }}>{w.bankName}</span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: '11px', fontWeight: '800', padding: '3px 8px', borderRadius: '6px',
                            background: w.isBalanceLegit ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                            color: w.isBalanceLegit ? '#22c55e' : '#ef4444'
                          }}>
                            {Number(w.user?.wallet?.balance || 0).toFixed(2)} ETB {w.isBalanceLegit ? '✓' : '⚠️'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--agent-muted)', fontSize: '12px' }}>{new Date(w.createdAt).toLocaleString()}</td>
                        <td className="right">
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleAction(w.id, 'withdrawal', 'approve')}
                              disabled={actionLoading === w.id}
                              style={{ padding: '8px 12px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              {actionLoading === w.id ? '…' : <><FiCheck size={13} /> Approve</>}
                            </button>
                            <button
                              onClick={() => handleAction(w.id, 'withdrawal', 'reject')}
                              disabled={actionLoading === w.id}
                              style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <FiX size={13} /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

      ) : (
        /* ── Transaction History ── */
        <div>
          <div className="agent-table-wrap" style={{ marginBottom: '24px' }}>
            <div className="agent-table-scroll">
              <table className="agent-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Balance After</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr className="agent-table-empty"><td colSpan={7}>No transaction history found.</td></tr>
                  ) : history.map((tx: any) => {
                    const isCredit = CREDIT_TYPES.has(tx.type);
                    return (
                      <tr key={tx.id}>
                        <td>
                          <div style={{ fontWeight: '700', color: '#1c1917' }}>{tx.user?.firstName || 'Player'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--agent-muted)' }}>@{tx.user?.telegramUsername || '—'}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', fontSize: '12px' }}>
                            {isCredit
                              ? <FiArrowDownLeft size={14} color="#22c55e" />
                              : <FiArrowUpRight size={14} color="#ef4444" />}
                            <span style={{ color: isCredit ? '#22c55e' : '#ef4444' }}>{tx.type}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--agent-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.description || ''}>
                          {tx.description || 'N/A'}
                        </td>
                        <td style={{ fontWeight: '800', color: isCredit ? '#22c55e' : '#ef4444' }}>
                          {isCredit ? '+' : '-'}{parseFloat(tx.amount).toLocaleString()} ETB
                        </td>
                        <td style={{ fontWeight: '700', color: '#1c1917' }}>{parseFloat(tx.balanceAfter).toLocaleString()} ETB</td>
                        <td>
                          <span style={{
                            fontSize: '11px', fontWeight: '800', padding: '3px 10px', borderRadius: '8px',
                            background: tx.status?.toUpperCase() === 'COMPLETED' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                            color: tx.status?.toUpperCase() === 'COMPLETED' ? '#22c55e' : '#eab308'
                          }}>
                            {tx.status?.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ color: 'var(--agent-muted)', fontSize: '12px' }}>{new Date(tx.createdAt).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination currentPage={historyPage} totalPages={historyTotalPages} onPageChange={setHistoryPage} loading={loading} />
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .agent-stat-card {
          background: var(--agent-card, rgba(255,255,255,0.04));
          border: 1px solid var(--agent-border, rgba(255,255,255,0.07));
          border-radius: 20px;
          padding: 20px;
          transition: transform 0.2s;
        }
        .agent-stat-card:hover { transform: translateY(-2px); }
      `}</style>
    </div>
  );
}
