"use client";

import React, { useEffect, useState } from 'react';
import { FiCheck, FiX, FiEye, FiDownload, FiArrowUpRight, FiArrowDownLeft, FiClock, FiCreditCard } from 'react-icons/fi';
import api from '@/lib/api';
import '@/app/admin.css';

export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'pending') {
        const [depRes, wdRes] = await Promise.all([
          api.get('/admin/deposits/pending'),
          api.get('/admin/withdrawals/pending')
        ]);
        setPendingDeposits(depRes.data || []);
        setPendingWithdrawals(wdRes.data || []);
      } else {
        const res = await api.get('/admin/analytics'); // Using analytics or a direct history endpoint if available
        // Note: I'll try to find a better endpoint for transaction history if needed
        // For now, let's assume we can fetch the last 100 transactions
        const txRes = await api.get('/transactions'); 
        setHistory(txRes.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string, type: 'deposit' | 'withdrawal') => {
    if (!confirm(`Approve this ${type}?`)) return;
    try {
      const endpoint = type === 'deposit' ? `/admin/deposits/${id}/approve` : `/admin/withdrawals/${id}/approve`;
      await api.post(endpoint);
      fetchData();
    } catch (err) {
      alert('Approval failed.');
    }
  };

  const handleReject = async (id: string, type: 'deposit' | 'withdrawal') => {
    const reason = prompt(`Reason for rejecting this ${type}:`);
    if (reason === null) return;
    try {
      const endpoint = type === 'deposit' ? `/admin/deposits/${id}/reject` : `/admin/withdrawals/${id}/reject`;
      await api.post(endpoint, { reason });
      fetchData();
    } catch (err) {
      alert('Rejection failed.');
    }
  };

  return (
    <div className="admin-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>Financial Hub</h1>
          <p style={{ color: '#78716c', margin: '4px 0 0', fontSize: '14px' }}>Authorize and track platform transactions</p>
        </div>
        
        <div style={{ display: 'flex', background: 'white', padding: '6px', borderRadius: '16px', border: '1px solid #e7e5e4', gap: '4px' }}>
          <button 
            className={`login-button ${activeTab === 'pending' ? 'active' : ''}`}
            style={{ padding: '10px 20px', borderRadius: '12px', background: activeTab === 'pending' ? '#3d2b1f' : 'transparent', color: activeTab === 'pending' ? 'white' : '#3d2b1f' }}
            onClick={() => setActiveTab('pending')}
          >
            Pending {pendingDeposits.length + pendingWithdrawals.length > 0 && <span style={{ background: '#ef4444', color: 'white', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', marginLeft: '6px' }}>{pendingDeposits.length + pendingWithdrawals.length}</span>}
          </button>
          <button 
            className={`login-button ${activeTab === 'history' ? 'active' : ''}`}
            style={{ padding: '10px 20px', borderRadius: '12px', background: activeTab === 'history' ? '#3d2b1f' : 'transparent', color: activeTab === 'history' ? 'white' : '#3d2b1f' }}
            onClick={() => setActiveTab('history')}
          >
            Ledger History
          </button>
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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDeposits.map(d => (
                    <tr key={d.id}>
                      <td>
                        <div style={{ fontWeight: '700' }}>{d.user?.firstName}</div>
                        <div style={{ fontSize: '12px', color: '#78716c' }}>ID: {d.user?.telegramId?.toString()}</div>
                      </td>
                      <td style={{ fontWeight: '800', color: '#22c55e' }}>+{parseFloat(d.amount).toLocaleString()} ETB</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: '600' }}>{d.reference || 'N/A'}</td>
                      <td>
                        {d.screenshotUrl ? (
                          <a href={d.screenshotUrl} target="_blank" rel="noopener noreferrer" className="badge badge-gold" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <FiEye size={12} /> View Slip
                          </a>
                        ) : 'No Proof'}
                      </td>
                      <td style={{ color: '#78716c', fontSize: '13px' }}>{new Date(d.createdAt).toLocaleString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleApprove(d.id, 'deposit')} className="login-button" style={{ padding: '8px', background: '#f0fdf4', color: '#22c55e' }}><FiCheck /></button>
                          <button onClick={() => handleReject(d.id, 'deposit')} className="login-button" style={{ padding: '8px', background: '#fef2f2', color: '#ef4444' }}><FiX /></button>
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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingWithdrawals.map(w => (
                    <tr key={w.id}>
                      <td>
                        <div style={{ fontWeight: '700' }}>{w.user?.firstName}</div>
                        <div style={{ fontSize: '12px', color: '#78716c' }}>ID: {w.user?.telegramId?.toString()}</div>
                      </td>
                      <td style={{ fontWeight: '800', color: '#ef4444' }}>-{parseFloat(w.amount).toLocaleString()} ETB</td>
                      <td>
                        <div style={{ fontWeight: '700' }}>{w.accountName}</div>
                        <div style={{ fontSize: '13px', color: '#3d2b1f', fontFamily: 'monospace' }}>{w.accountNumber}</div>
                      </td>
                      <td className="badge badge-blue" style={{ display: 'inline-block', marginTop: '14px' }}>{w.bankName}</td>
                      <td style={{ color: '#78716c', fontSize: '13px' }}>{new Date(w.createdAt).toLocaleString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleApprove(w.id, 'withdrawal')} className="login-button" style={{ padding: '8px', background: '#f0fdf4', color: '#22c55e' }}><FiCheck /></button>
                          <button onClick={() => handleReject(w.id, 'withdrawal')} className="login-button" style={{ padding: '8px', background: '#fef2f2', color: '#ef4444' }}><FiX /></button>
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
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Balance After</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {history.map(tx => (
                <tr key={tx.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#78716c' }}>{tx.id.slice(0,8)}...</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
                      {tx.type === 'DEPOSIT' ? <FiArrowDownLeft color="#22c55e" /> : <FiArrowUpRight color="#ef4444" />}
                      {tx.type}
                    </div>
                  </td>
                  <td style={{ fontWeight: '800', color: tx.type === 'DEPOSIT' || tx.type === 'PRIZE_WIN' ? '#22c55e' : '#ef4444' }}>
                    {tx.type === 'DEPOSIT' || tx.type === 'PRIZE_WIN' ? '+' : '-'}{parseFloat(tx.amount).toLocaleString()} ETB
                  </td>
                  <td style={{ fontWeight: '700' }}>{parseFloat(tx.balanceAfter).toLocaleString()} ETB</td>
                  <td>
                    <span className={`badge ${tx.status === 'COMPLETED' ? 'badge-green' : 'badge-gold'}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td style={{ color: '#78716c', fontSize: '13px' }}>{new Date(tx.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: '#78716c' }}>No transaction history found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
