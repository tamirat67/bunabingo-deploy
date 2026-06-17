"use client";

import React, { useEffect, useState, useCallback } from 'react';
import {
  FiCheck, FiX, FiEye, FiArrowUpRight, FiArrowDownLeft,
  FiClock, FiCreditCard, FiRefreshCw, FiSearch, FiFilter, FiCheckCircle
} from 'react-icons/fi';
import api from '@/lib/api';
import { Pagination } from '@/components/Pagination';
import '@/app/admin.css';

type Tab = 'pending' | 'dep-history' | 'wd-history';

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  if (s === 'approved' || s === 'completed') {
    return <span style={{ background: 'rgba(34,197,94,0.12)', color: '#16a34a', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>✓ {status.toUpperCase()}</span>;
  }
  if (s === 'pending') {
    return <span style={{ background: 'rgba(234,179,8,0.12)', color: '#b45309', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>⏳ PENDING</span>;
  }
  if (s === 'rejected' || s === 'failed') {
    return <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>✗ {status.toUpperCase()}</span>;
  }
  return <span style={{ background: 'rgba(100,116,139,0.1)', color: '#64748b', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>{status.toUpperCase()}</span>;
}

export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('pending');

  // Pending
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);

  // Deposit history
  const [depositHistory, setDepositHistory] = useState<any[]>([]);
  const [depPage, setDepPage] = useState(1);
  const [depTotalPages, setDepTotalPages] = useState(1);
  const [depTotal, setDepTotal] = useState(0);
  const [depLoading, setDepLoading] = useState(false);
  const [depSearch, setDepSearch] = useState('');

  // Withdrawal history
  const [withdrawalHistory, setWithdrawalHistory] = useState<any[]>([]);
  const [wdPage, setWdPage] = useState(1);
  const [wdTotalPages, setWdTotalPages] = useState(1);
  const [wdTotal, setWdTotal] = useState(0);
  const [wdLoading, setWdLoading] = useState(false);
  const [wdSearch, setWdSearch] = useState('');

  // Summary
  const [summary, setSummary] = useState({
    pendingDepositsCount: 0, pendingDepositsSum: 0,
    pendingWithdrawalsCount: 0, pendingWithdrawalsSum: 0,
    totalDeposited: 0, totalWithdrawn: 0,
    bonusCredits: 0, prizeWinnings: 0,
    referralBonuses: 0, ticketsPurchased: 0,
    totalWalletBalance: 0,
  });

  const fetchSummary = useCallback(async () => {
    try {
      const r = await api.get('/admin/transactions/summary');
      setSummary(r.data);
    } catch {}
  }, []);

  const fetchPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const [depRes, wdRes] = await Promise.all([
        api.get('/admin/deposits/pending'),
        api.get('/admin/withdrawals/pending'),
      ]);
      setPendingDeposits(depRes.data || []);
      setPendingWithdrawals(wdRes.data || []);
    } catch (err) {
      console.error('Failed to fetch pending:', err);
    } finally {
      setPendingLoading(false);
    }
  }, []);

  const fetchDepositHistory = useCallback(async (page = depPage) => {
    setDepLoading(true);
    try {
      const r = await api.get(`/admin/deposits/history?page=${page}`);
      setDepositHistory(r.data.deposits || []);
      setDepTotalPages(r.data.pages || 1);
      setDepTotal(r.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch deposit history:', err);
    } finally {
      setDepLoading(false);
    }
  }, [depPage]);

  const fetchWithdrawalHistory = useCallback(async (page = wdPage) => {
    setWdLoading(true);
    try {
      const r = await api.get(`/admin/withdrawals/history?page=${page}`);
      setWithdrawalHistory(r.data.withdrawals || []);
      setWdTotalPages(r.data.pages || 1);
      setWdTotal(r.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch withdrawal history:', err);
    } finally {
      setWdLoading(false);
    }
  }, [wdPage]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  useEffect(() => {
    if (activeTab === 'pending') fetchPending();
    else if (activeTab === 'dep-history') fetchDepositHistory(depPage);
    else if (activeTab === 'wd-history') fetchWithdrawalHistory(wdPage);
  }, [activeTab, depPage, wdPage]);

  const handleApprove = async (id: string, type: 'deposit' | 'withdrawal') => {
    if (!window.confirm(`Approve this ${type}?`)) return;
    try {
      await api.post(`/admin/${type === 'deposit' ? 'deposits' : 'withdrawals'}/${id}/approve`);
      fetchPending();
      fetchSummary();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Approval failed.');
    }
  };

  const handleReject = async (id: string, type: 'deposit' | 'withdrawal') => {
    const reason = window.prompt(`Reason for rejecting this ${type}:`);
    if (reason === null) return;
    try {
      await api.post(`/admin/${type === 'deposit' ? 'deposits' : 'withdrawals'}/${id}/reject`, { reason });
      fetchPending();
      fetchSummary();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Rejection failed.');
    }
  };

  const telebirrUrl = (txnId: string) => {
    if (!txnId || txnId === 'N/A') return null;
    if (txnId.startsWith('http')) return txnId;
    if (/^[A-Z0-9]{8,15}$/i.test(txnId.trim())) {
      return `https://transactioninfo.ethiotelecom.et/receipt/${txnId.trim()}`;
    }
    const m = txnId.match(/(https:\/\/transactioninfo\.ethiotelecom\.et\/receipt\/[A-Z0-9]+)/i);
    return m ? m[1] : null;
  };

  const totalPending = summary.pendingDepositsCount + summary.pendingWithdrawalsCount;

  const filteredDepHistory = depositHistory.filter(d => {
    if (!depSearch) return true;
    const s = depSearch.toLowerCase();
    return (
      d.user?.firstName?.toLowerCase().includes(s) ||
      d.txnId?.toLowerCase().includes(s) ||
      d.status?.toLowerCase().includes(s)
    );
  });

  const filteredWdHistory = withdrawalHistory.filter(w => {
    if (!wdSearch) return true;
    const s = wdSearch.toLowerCase();
    return (
      w.user?.firstName?.toLowerCase().includes(s) ||
      w.accountNumber?.toLowerCase().includes(s) ||
      w.bankName?.toLowerCase().includes(s) ||
      w.status?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="admin-page">
      {/* ── Header ── */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>Financial Hub</h1>
        <p style={{ color: '#78716c', margin: '4px 0 0', fontSize: '14px' }}>Authorize payments and audit full transaction history</p>
        <div style={{ marginTop: '16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiCheckCircle size={18} style={{ color: '#16a34a' }} />
          <span style={{ fontSize: '13px', color: '#166534', fontWeight: '600' }}>
            <strong>✅ Real Money Accounting:</strong> All calculations in this hub represent strictly real cash deposited. Bonus ETB is strictly excluded.
          </span>
        </div>
      </div>

      {/* ── Row 1: Pending + Cash Flow ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', marginBottom: '16px' }}>
        <div className="premium-stat-card" style={{ borderLeft: '4px solid #eab308' }}>
          <div className="card-top-row">
            <div className="card-icon-container" style={{ background: '#fef9c3', color: '#ca8a04' }}><FiClock size={18} /></div>
            <span className="card-pill" style={{ background: 'rgba(234,179,8,0.1)', color: '#ca8a04' }}>Pending</span>
          </div>
          <div className="card-body">
            <div className="card-label">PENDING DEPOSITS</div>
            <div className="card-value">{summary.pendingDepositsSum.toLocaleString()} ETB</div>
            <div className="card-subtext">{summary.pendingDepositsCount} requests waiting</div>
          </div>
        </div>
        <div className="premium-stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="card-top-row">
            <div className="card-icon-container" style={{ background: '#fee2e2', color: '#dc2626' }}><FiCreditCard size={18} /></div>
            <span className="card-pill" style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>Pending</span>
          </div>
          <div className="card-body">
            <div className="card-label">PENDING WITHDRAWALS</div>
            <div className="card-value">{summary.pendingWithdrawalsSum.toLocaleString()} ETB</div>
            <div className="card-subtext">{summary.pendingWithdrawalsCount} requests waiting</div>
          </div>
        </div>
        <div className="premium-stat-card" style={{ borderLeft: '4px solid #22c55e' }}>
          <div className="card-top-row">
            <div className="card-icon-container" style={{ background: '#dcfce7', color: '#16a34a' }}><FiArrowDownLeft size={18} /></div>
            <span className="card-pill" style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a' }}>Cash In</span>
          </div>
          <div className="card-body">
            <div className="card-label">TOTAL DEPOSITED</div>
            <div className="card-value">{summary.totalDeposited.toLocaleString()} ETB</div>
            <div className="card-subtext">Real cash received from players</div>
          </div>
        </div>
        <div className="premium-stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="card-top-row">
            <div className="card-icon-container" style={{ background: '#dbeafe', color: '#2563eb' }}><FiArrowUpRight size={18} /></div>
            <span className="card-pill" style={{ background: 'rgba(59,130,246,0.1)', color: '#2563eb' }}>Cash Out</span>
          </div>
          <div className="card-body">
            <div className="card-label">TOTAL WITHDRAWN</div>
            <div className="card-value">{summary.totalWithdrawn.toLocaleString()} ETB</div>
            <div className="card-subtext">Approved &amp; paid out</div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Where Player Balances Come From ── */}
      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '18px', padding: '20px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span style={{ fontSize: '16px' }}>💳</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: '#3d2b1f' }}>Where Do Player Balances Come From?</h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#78716c' }}>Every source that adds or removes money from player wallets</p>
          </div>
        </div>

        {/* Formula row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '16px' }}>
          {/* + Deposits */}
          <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '12px', borderLeft: '3px solid #22c55e' }}>
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>+ Real Deposits</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#15803d', marginTop: '4px' }}>{summary.totalDeposited.toLocaleString()} ETB</div>
            <div style={{ fontSize: '11px', color: '#4ade80', marginTop: '2px' }}>Cash paid in by players</div>
          </div>

          {/* + Bonus Credits */}
          <div style={{ background: '#fefce8', borderRadius: '12px', padding: '12px', borderLeft: '3px solid #eab308' }}>
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#854d0e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>+ Deposit Bonus (100%)</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#b45309', marginTop: '4px' }}>{summary.bonusCredits.toLocaleString()} ETB</div>
            <div style={{ fontSize: '11px', color: '#ca8a04', marginTop: '2px' }}>Free bonus given on each deposit</div>
          </div>

          {/* + Prize Wins */}
          <div style={{ background: '#faf5ff', borderRadius: '12px', padding: '12px', borderLeft: '3px solid #a855f7' }}>
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#6b21a8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>+ Prize Winnings</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#7e22ce', marginTop: '4px' }}>{summary.prizeWinnings.toLocaleString()} ETB</div>
            <div style={{ fontSize: '11px', color: '#c084fc', marginTop: '2px' }}>Real player bingo wins</div>
          </div>

          {/* + Referral */}
          <div style={{ background: '#eff6ff', borderRadius: '12px', padding: '12px', borderLeft: '3px solid #3b82f6' }}>
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>+ Referral Bonuses</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#1d4ed8', marginTop: '4px' }}>{summary.referralBonuses.toLocaleString()} ETB</div>
            <div style={{ fontSize: '11px', color: '#60a5fa', marginTop: '2px' }}>5 ETB per invited friend</div>
          </div>

          {/* - Tickets */}
          <div style={{ background: '#fef2f2', borderRadius: '12px', padding: '12px', borderLeft: '3px solid #ef4444' }}>
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>- Tickets Purchased</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#dc2626', marginTop: '4px' }}>{summary.ticketsPurchased.toLocaleString()} ETB</div>
            <div style={{ fontSize: '11px', color: '#f87171', marginTop: '2px' }}>Money spent on bingo tickets</div>
          </div>

          {/* - Withdrawals */}
          <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '12px', borderLeft: '3px solid #64748b' }}>
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>- Withdrawals Paid</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#475569', marginTop: '4px' }}>{summary.totalWithdrawn.toLocaleString()} ETB</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Cash sent back to players</div>
          </div>
        </div>

        {/* Result */}
        <div style={{ background: 'linear-gradient(135deg, #3d2b1f, #5c4a3a)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>= CURRENT TOTAL PLAYER WALLET BALANCE</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '3px' }}>
              Deposits + Bonus + Prizes + Referral − Tickets − Withdrawals
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '26px', fontWeight: '900', color: '#d4af37' }}>
              {summary.totalWalletBalance.toLocaleString()} ETB
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div style={{ display: 'flex', gap: '4px', background: '#f5f2eb', padding: '5px', borderRadius: '14px', marginBottom: '24px', width: 'fit-content' }}>
        {([
          { key: 'pending', label: '⏳ Pending Requests', badge: totalPending },
          { key: 'dep-history', label: '↙ Deposit History', badge: null },
          { key: 'wd-history', label: '↗ Withdrawal History', badge: null },
        ] as { key: Tab; label: string; badge: number | null }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '13px', transition: 'all 0.2s',
              background: activeTab === t.key ? '#3d2b1f' : 'transparent',
              color: activeTab === t.key ? '#fff' : '#78716c',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', padding: '1px 7px', borderRadius: '999px', fontSize: '11px', fontWeight: '900' }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════ PENDING TAB ══════════════════════════════════ */}
      {activeTab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => { fetchPending(); fetchSummary(); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px', padding: '9px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#3d2b1f' }}
            >
              <FiRefreshCw size={13} /> Refresh
            </button>
          </div>

          {pendingLoading ? (
            <div style={{ padding: '80px', textAlign: 'center' }}>
              <div className="animate-spin" style={{ width: '36px', height: '36px', border: '3px solid #d4af37', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }} />
              <p style={{ marginTop: '14px', fontWeight: '700', color: '#3d2b1f' }}>Loading requests...</p>
            </div>
          ) : (
            <>
              {/* Deposit Requests */}
              <section>
                <h2 style={{ fontSize: '17px', fontWeight: '900', color: '#3d2b1f', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiArrowDownLeft style={{ color: '#22c55e' }} /> Deposit Requests
                  <span style={{ background: 'rgba(34,197,94,0.12)', color: '#16a34a', fontSize: '11px', fontWeight: '800', padding: '2px 10px', borderRadius: '999px' }}>
                    {pendingDeposits.length} pending
                  </span>
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
                      {pendingDeposits.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#78716c', fontWeight: '600' }}>✅ No pending deposit requests.</td></tr>
                      ) : pendingDeposits.map((d: any) => {
                        const rawRef = d.reference || d.txnId || 'N/A';
                        const tUrl = telebirrUrl(rawRef);
                        const shortRef = rawRef.length > 20 ? rawRef.substring(0, 16) + '...' : rawRef;
                        return (
                          <tr key={d.id}>
                            <td>
                              <div style={{ fontWeight: '700' }}>{d.user?.firstName || 'Player'}</div>
                              <div style={{ fontSize: '11px', color: '#78716c' }}>ID: {d.user?.telegramId}</div>
                            </td>
                            <td style={{ fontWeight: '900', color: '#16a34a', fontSize: '15px' }}>+{parseFloat(d.amount).toLocaleString()} ETB</td>
                            <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#3d2b1f' }} title={rawRef}>{shortRef}</td>
                            <td>
                              {d.receiptUrl ? (
                                <a href={d.receiptUrl.startsWith('http') ? d.receiptUrl : `${api.defaults.baseURL?.replace('/api', '')}/api/file/${d.receiptUrl}`} target="_blank" rel="noopener noreferrer" className="badge badge-gold" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                  <FiEye size={11} /> View Slip
                                </a>
                              ) : tUrl ? (
                                <a href={tUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(34,197,94,0.1)', color: '#16a34a', padding: '3px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                                  <FiEye size={11} /> Telebirr
                                </a>
                              ) : <span style={{ color: '#d1d5db', fontSize: '12px' }}>No proof</span>}
                            </td>
                            <td style={{ color: '#78716c', fontSize: '12px' }}>{new Date(d.createdAt).toLocaleString()}</td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button onClick={() => handleApprove(d.id, 'deposit')} style={{ padding: '7px 12px', background: '#f0fdf4', color: '#22c55e', border: '1px solid #bbf7d0', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <FiCheck size={13} /> Approve
                                </button>
                                <button onClick={() => handleReject(d.id, 'deposit')} style={{ padding: '7px 12px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <FiX size={13} /> Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Withdrawal Requests */}
              <section>
                <h2 style={{ fontSize: '17px', fontWeight: '900', color: '#3d2b1f', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiArrowUpRight style={{ color: '#3b82f6' }} /> Withdrawal Requests
                  <span style={{ background: 'rgba(59,130,246,0.12)', color: '#2563eb', fontSize: '11px', fontWeight: '800', padding: '2px 10px', borderRadius: '999px' }}>
                    {pendingWithdrawals.length} pending
                  </span>
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
                      {pendingWithdrawals.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#78716c', fontWeight: '600' }}>✅ No pending withdrawal requests.</td></tr>
                      ) : pendingWithdrawals.map((w: any) => (
                        <tr key={w.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: '700' }}>{w.user?.firstName || 'Player'}</span>
                              {w.user && (
                                <span style={{ fontSize: '10px', padding: '2px 6px', fontWeight: '800', background: w.isBalanceLegit ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: w.isBalanceLegit ? '#22c55e' : '#ef4444', borderRadius: '4px' }}>
                                  Bal: {Number(w.user.wallet?.balance || 0).toFixed(2)} ETB {w.isBalanceLegit ? '✓' : '⚠️'}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: '#78716c' }}>ID: {w.user?.telegramId}</div>
                          </td>
                          <td style={{ fontWeight: '900', color: '#ef4444', fontSize: '15px' }}>-{parseFloat(w.amount).toLocaleString()} ETB</td>
                          <td>
                            <div style={{ fontWeight: '700', fontSize: '13px' }}>{w.accountName}</div>
                            <div style={{ fontSize: '12px', color: '#3d2b1f', fontFamily: 'monospace' }}>{w.accountNumber}</div>
                          </td>
                          <td><span className="badge badge-blue" style={{ fontSize: '11px' }}>{w.bankName}</span></td>
                          <td style={{ color: '#78716c', fontSize: '12px' }}>{new Date(w.createdAt).toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button onClick={() => handleApprove(w.id, 'withdrawal')} style={{ padding: '7px 12px', background: '#f0fdf4', color: '#22c55e', border: '1px solid #bbf7d0', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <FiCheck size={13} /> Approve
                              </button>
                              <button onClick={() => handleReject(w.id, 'withdrawal')} style={{ padding: '7px 12px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <FiX size={13} /> Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════ DEPOSIT HISTORY TAB ══════════════════════════════════ */}
      {activeTab === 'dep-history' && (
        <div>
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#3d2b1f', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiArrowDownLeft style={{ color: '#22c55e' }} /> All Deposit Records
              </h2>
              <p style={{ fontSize: '13px', color: '#78716c', margin: '4px 0 0' }}>
                {depTotal.toLocaleString()} total records — page {depPage} of {depTotalPages}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px', padding: '9px 14px' }}>
                <FiSearch size={13} style={{ color: '#9ca3af' }} />
                <input
                  type="text"
                  placeholder="Search by name or txnID…"
                  value={depSearch}
                  onChange={e => setDepSearch(e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: '13px', fontWeight: '600', width: '180px', background: 'transparent' }}
                />
              </div>
              <button onClick={() => fetchDepositHistory(depPage)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px', padding: '9px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#3d2b1f' }}>
                <FiRefreshCw size={13} style={{ animation: depLoading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
              </button>
            </div>
          </div>

          <div className="data-table-container">
            {depLoading ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <div className="animate-spin" style={{ width: '32px', height: '32px', border: '3px solid #22c55e', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }} />
                <p style={{ marginTop: '12px', color: '#78716c', fontWeight: '700' }}>Loading deposit history...</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Reference / TxnID</th>
                    <th>Proof</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDepHistory.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '60px', color: '#78716c', fontWeight: '600' }}>No deposit records found.</td></tr>
                  ) : filteredDepHistory.map((d: any, i: number) => {
                    const rawRef = d.txnId || 'N/A';
                    const tUrl = telebirrUrl(rawRef);
                    return (
                      <tr key={d.id}>
                        <td style={{ color: '#9ca3af', fontSize: '12px' }}>#{((depPage - 1) * 50) + i + 1}</td>
                        <td>
                          <div style={{ fontWeight: '700' }}>{d.user?.firstName || 'Player'}</div>
                          <div style={{ fontSize: '11px', color: '#78716c' }}>@{d.user?.telegramUsername || d.user?.username || '—'}</div>
                        </td>
                        <td style={{ fontWeight: '900', color: '#16a34a', fontSize: '14px' }}>+{parseFloat(d.amount).toLocaleString()} ETB</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#3d2b1f', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rawRef}>
                          {rawRef.length > 18 ? rawRef.substring(0, 16) + '…' : rawRef}
                        </td>
                        <td>
                          {d.receiptUrl ? (
                            <a href={d.receiptUrl.startsWith('http') ? d.receiptUrl : `${api.defaults.baseURL?.replace('/api', '')}/api/file/${d.receiptUrl}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(212,175,55,0.1)', color: '#b45309', padding: '3px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                              <FiEye size={11} /> Slip
                            </a>
                          ) : tUrl ? (
                            <a href={tUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(34,197,94,0.1)', color: '#16a34a', padding: '3px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                              <FiEye size={11} /> Telebirr
                            </a>
                          ) : <span style={{ color: '#d1d5db', fontSize: '12px' }}>—</span>}
                        </td>
                        <td><StatusBadge status={d.status} /></td>
                        <td style={{ color: '#78716c', fontSize: '12px' }}>{new Date(d.createdAt).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ marginTop: '20px' }}>
            <Pagination currentPage={depPage} totalPages={depTotalPages} onPageChange={(p) => setDepPage(p)} loading={depLoading} />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════ WITHDRAWAL HISTORY TAB ══════════════════════════════════ */}
      {activeTab === 'wd-history' && (
        <div>
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#3d2b1f', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiArrowUpRight style={{ color: '#3b82f6' }} /> All Withdrawal Records
              </h2>
              <p style={{ fontSize: '13px', color: '#78716c', margin: '4px 0 0' }}>
                {wdTotal.toLocaleString()} total records — page {wdPage} of {wdTotalPages}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px', padding: '9px 14px' }}>
                <FiSearch size={13} style={{ color: '#9ca3af' }} />
                <input
                  type="text"
                  placeholder="Search by name or bank…"
                  value={wdSearch}
                  onChange={e => setWdSearch(e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: '13px', fontWeight: '600', width: '180px', background: 'transparent' }}
                />
              </div>
              <button onClick={() => fetchWithdrawalHistory(wdPage)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px', padding: '9px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#3d2b1f' }}>
                <FiRefreshCw size={13} style={{ animation: wdLoading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
              </button>
            </div>
          </div>

          <div className="data-table-container">
            {wdLoading ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <div className="animate-spin" style={{ width: '32px', height: '32px', border: '3px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }} />
                <p style={{ marginTop: '12px', color: '#78716c', fontWeight: '700' }}>Loading withdrawal history...</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Account Name</th>
                    <th>Account No.</th>
                    <th>Bank</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWdHistory.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '60px', color: '#78716c', fontWeight: '600' }}>No withdrawal records found.</td></tr>
                  ) : filteredWdHistory.map((w: any, i: number) => (
                    <tr key={w.id}>
                      <td style={{ color: '#9ca3af', fontSize: '12px' }}>#{((wdPage - 1) * 50) + i + 1}</td>
                      <td>
                        <div style={{ fontWeight: '700' }}>{w.user?.firstName || 'Player'}</div>
                        <div style={{ fontSize: '11px', color: '#78716c' }}>@{w.user?.telegramUsername || w.user?.username || '—'}</div>
                      </td>
                      <td style={{ fontWeight: '900', color: '#ef4444', fontSize: '14px' }}>-{parseFloat(w.amount).toLocaleString()} ETB</td>
                      <td style={{ fontWeight: '700', fontSize: '13px' }}>{w.accountName}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#3d2b1f' }}>{w.accountNumber}</td>
                      <td><span className="badge badge-blue" style={{ fontSize: '11px' }}>{w.bankName}</span></td>
                      <td><StatusBadge status={w.status} /></td>
                      <td style={{ color: '#78716c', fontSize: '12px' }}>{new Date(w.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ marginTop: '20px' }}>
            <Pagination currentPage={wdPage} totalPages={wdTotalPages} onPageChange={(p) => setWdPage(p)} loading={wdLoading} />
          </div>
        </div>
      )}
    </div>
  );
}
