"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FiArrowLeft, FiUser, FiPhone, FiCalendar, FiDollarSign, FiTrendingUp, FiActivity, FiUsers, FiClock, FiCheckCircle } from 'react-icons/fi';
import api from '@/lib/api';
import { Pagination } from '@/components/Pagination';
import '@/app/admin.css';

export default function AgentReportPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    fetchReport();
  }, [agentId]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/admin/agents/${agentId}/report`);
      setReport(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load agent report');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid #d4af37', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }}></div>
          <p style={{ marginTop: '16px', fontWeight: '700', color: '#3d2b1f' }}>Loading comprehensive report...</p>
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

  if (!report) return null;

  const { agent, preDepositStatus, stats, players, botCount, recentTransactions, recentDeposits, rechargeHistory } = report;

  return (
    <div className="admin-page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#78716c', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}>
            <FiArrowLeft /> Back to Agents
          </button>
          <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#3d2b1f', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="user-avatar" style={{ width: '48px', height: '48px', fontSize: '20px' }}>
              {agent.firstName?.[0] || 'A'}
            </div>
            {agent.firstName}
          </h1>
          <p style={{ color: '#78716c', margin: '8px 0 0', fontSize: '15px' }}>
            {agent.telegramUsername ? `@${agent.telegramUsername}` : 'No username'} • ID: {agent.telegramId}
          </p>
        </div>

        {/* Pre-Deposit Card */}
        <div style={{ 
          background: preDepositStatus.state === 'RED' ? '#fef2f2' : preDepositStatus.state === 'YELLOW' ? '#fefce8' : '#f0fdf4',
          border: `1px solid ${preDepositStatus.state === 'RED' ? '#fecaca' : preDepositStatus.state === 'YELLOW' ? '#fef08a' : '#bbf7d0'}`,
          padding: '20px',
          borderRadius: '16px',
          minWidth: '240px',
          textAlign: 'right'
        }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase' }}>Pre-Deposit Liquidity</p>
          <div style={{ fontSize: '28px', fontWeight: '900', color: preDepositStatus.state === 'RED' ? '#ef4444' : preDepositStatus.state === 'YELLOW' ? '#eab308' : '#16a34a' }}>
            {Number(preDepositStatus.balance).toLocaleString()} <span style={{ fontSize: '14px' }}>ETB</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <span className={`badge ${preDepositStatus.state === 'RED' ? 'badge-red' : preDepositStatus.state === 'YELLOW' ? 'badge-gold' : 'badge-green'}`}>
              {preDepositStatus.state === 'RED' ? 'CRITICAL - REFILL NEEDED' : preDepositStatus.state === 'YELLOW' ? 'WARNING - RUNNING LOW' : 'HEALTHY'}
            </span>
          </div>
        </div>
      </div>

      {/* Main KPIs */}
      <div className="stat-grid" style={{ marginBottom: '32px' }}>
        <div className="stat-card-m" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#78716c', fontWeight: '800', fontSize: '12px', marginBottom: '12px' }}>
            <FiUsers /> TOTAL BRANCH PLAYERS
          </div>
          <h2 style={{ margin: 0, fontSize: '32px', fontWeight: '900', color: '#3d2b1f' }}>
            {stats.totalPlayers}
          </h2>
        </div>

        <div className="stat-card-m" style={{ borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#78716c', fontWeight: '800', fontSize: '12px', marginBottom: '12px' }}>
            <FiDollarSign /> TOTAL BRANCH DEPOSITS
          </div>
          <h2 style={{ margin: 0, fontSize: '32px', fontWeight: '900', color: '#3d2b1f' }}>
            {stats.totalDeposited.toLocaleString()} <span style={{ fontSize: '16px', color: '#a8a29e' }}>ETB</span>
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#78716c', fontWeight: '600' }}>
            From {stats.totalDepositsCount} approved transactions
          </p>
        </div>

        <div className="stat-card-m" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#78716c', fontWeight: '800', fontSize: '12px', marginBottom: '12px' }}>
            <FiActivity /> TOTAL TICKET SALES
          </div>
          <h2 style={{ margin: 0, fontSize: '32px', fontWeight: '900', color: '#3d2b1f' }}>
            {stats.totalTicketSales.toLocaleString()} <span style={{ fontSize: '16px', color: '#a8a29e' }}>ETB</span>
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#78716c', fontWeight: '600' }}>
            {stats.totalTicketsCount} tickets sold • {stats.gamesPlayed} games played
          </p>
        </div>

        <div className="stat-card-m" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d97706', fontWeight: '900', fontSize: '12px', marginBottom: '12px' }}>
            <FiTrendingUp /> AGENT NET PROFIT
          </div>
          <h2 style={{ margin: 0, fontSize: '32px', fontWeight: '900', color: '#b45309' }}>
            {stats.netProfit.toLocaleString()} <span style={{ fontSize: '16px', opacity: 0.7 }}>ETB</span>
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#b45309', fontWeight: '700' }}>
            Based on {(stats.profitRate * 100).toFixed(1)}% commission rate
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {/* Recent Deposits */}
        <div className="stat-card-m" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #f5f5f4', background: '#fafaf9' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiCheckCircle color="#10b981" /> Recent Branch Deposits
            </h3>
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '0 20px' }}>
            {recentDeposits.length === 0 ? (
              <p style={{ padding: '20px 0', textAlign: 'center', color: '#a8a29e', fontWeight: '600' }}>No recent deposits</p>
            ) : (
              recentDeposits.map((dep: any) => (
                <div key={dep.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #f5f5f4' }}>
                  <div>
                    <div style={{ fontWeight: '800', color: '#3d2b1f' }}>{dep.user?.firstName || 'Unknown'}</div>
                    <div style={{ fontSize: '12px', color: '#78716c' }}>{new Date(dep.createdAt).toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '900', color: '#10b981' }}>+{Number(dep.amount).toLocaleString()} ETB</div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: dep.status === 'APPROVED' ? '#10b981' : '#f59e0b' }}>{dep.status}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="stat-card-m" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #f5f5f4', background: '#fafaf9' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiActivity color="#8b5cf6" /> Recent Branch Activity
            </h3>
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '0 20px' }}>
            {recentTransactions.length === 0 ? (
              <p style={{ padding: '20px 0', textAlign: 'center', color: '#a8a29e', fontWeight: '600' }}>No recent activity</p>
            ) : (
              recentTransactions.map((tx: any) => (
                <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #f5f5f4' }}>
                  <div>
                    <div style={{ fontWeight: '800', color: '#3d2b1f', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {tx.type === 'TICKET_PURCHASE' ? <span style={{ color: '#8b5cf6' }}>🎫 Ticket</span> : 
                       tx.type === 'GAME_WIN' ? <span style={{ color: '#d4af37' }}>🏆 Win</span> : 
                       <span>{tx.type}</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: '#78716c' }}>{tx.user?.firstName} • {new Date(tx.createdAt).toLocaleTimeString()}</div>
                  </div>
                  <div style={{ fontWeight: '900', color: tx.amount > 0 ? '#10b981' : '#3d2b1f' }}>
                    {tx.amount > 0 ? '+' : ''}{Number(tx.amount).toLocaleString()} ETB
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Players List */}
      <div className="data-table-container" style={{ marginTop: '32px' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--admin-border)' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900' }}>Branch Players Directory</h2>
          <p style={{ margin: '4px 0 0', color: '#78716c', fontSize: '14px' }}>
            {players.length} real players registered under {agent.firstName}'s link
            {botCount > 0 && <span style={{ marginLeft: '10px', background: '#fff7ed', color: '#ea580c', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '999px', border: '1px solid #fed7aa' }}>+{botCount} bots (excluded)</span>}
          </p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Phone</th>
              <th>Wallet Balance</th>
              <th>Joined Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {players.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#a8a29e', fontWeight: '600' }}>
                  No players in this branch yet.
                </td>
              </tr>
            ) : (
              players.map((player: any) => (
                <tr key={player.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
                        {player.firstName?.[0] || 'U'}
                      </div>
                      <div>
                        <div style={{ fontWeight: '800' }}>{player.firstName}</div>
                        <div style={{ fontSize: '12px', color: '#78716c' }}>@{player.telegramUsername || 'no_username'}</div>
                      </div>
                    </div>
                  </td>
                  <td>{player.phone || 'N/A'}</td>
                  <td style={{ fontWeight: '800' }}>{Number(player.wallet?.balance || 0).toLocaleString()} ETB</td>
                  <td style={{ color: '#78716c', fontSize: '13px' }}>{new Date(player.createdAt).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge ${player.status === 'BANNED' ? 'badge-red' : 'badge-green'}`}>
                      {player.status || 'ACTIVE'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Recharge History */}
      <div className="stat-card-m" style={{ marginTop: '32px', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #f5f5f4', background: '#fafaf9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            💳 Pre-Deposit Recharge History
          </h3>
          <span style={{ fontSize: '12px', color: '#78716c', fontWeight: '600' }}>Last 20 recharges by admin</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Amount</th>
                <th>Note</th>
                <th style={{ textAlign: 'right' }}>Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {!rechargeHistory || rechargeHistory.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: '#a8a29e', fontWeight: '600' }}>
                    No recharge records found for this agent.
                  </td>
                </tr>
              ) : rechargeHistory.map((rh: any, i: number) => (
                <tr key={rh.id}>
                  <td style={{ color: '#78716c', fontSize: '13px' }}>#{i + 1}</td>
                  <td>
                    <span style={{ fontWeight: '900', color: '#16a34a', fontSize: '16px' }}>+{Number(rh.amount).toLocaleString()} ETB</span>
                  </td>
                  <td style={{ color: '#5c554b', fontSize: '13px' }}>{rh.description || '—'}</td>
                  <td style={{ textAlign: 'right', color: '#78716c', fontSize: '13px' }}>
                    {new Date(rh.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
