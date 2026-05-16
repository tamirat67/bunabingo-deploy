"use client";

import React, { useEffect, useState } from 'react';
import { FiSearch, FiExternalLink, FiUserPlus, FiTrendingUp, FiUserX } from 'react-icons/fi';
import api from '@/lib/api';
import { Pagination } from '@/components/Pagination';
import '@/app/admin.css';

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [rechargeLoading, setRechargeLoading] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, [page]);

  async function fetchAgents() {
    try {
      setLoading(true);
      const response = await api.get(`/admin/agents?page=${page}`);
      setAgents(response.data.agents || []);
      setTotalPages(response.data.pages || 1);
      setTotalCount(response.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleRecharge = async () => {
    if (!selectedAgent || !rechargeAmount) return;
    try {
      setRechargeLoading(true);
      await api.post(`/admin/agents/${selectedAgent.id}/recharge`, { amount: rechargeAmount });
      setShowRechargeModal(false);
      setRechargeAmount('');
      fetchAgents();
      alert(`Successfully refilled ${selectedAgent.firstName}'s wallet!`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Recharge failed.');
    } finally {
      setRechargeLoading(false);
    }
  };

  const handleDemote = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this agent from the network?')) return;
    try {
      await api.post(`/admin/users/${userId}/demote`);
      fetchAgents();
    } catch (err) {
      alert('Demotion failed.');
    }
  };

  const filteredAgents = agents.filter(agent => 
    agent.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.telegramUsername?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-page">
      <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '36px', fontWeight: '900', margin: 0 }}>Agents Network</h1>
          <p style={{ color: 'var(--admin-text-muted)', marginTop: '4px' }}>Manage your branch managers and refill their pre-deposit liquidity.</p>
        </div>
        <button 
          className="login-button" 
          onClick={() => window.location.href = '/admin/users'}
          style={{ width: 'auto', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <FiUserPlus /> Promote New Agent
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-card-m">
          <p className="stat-label">Total Agents</p>
          <h2 className="stat-value">{totalCount || agents.length}</h2>
        </div>
        <div className="stat-card-m">
          <p className="stat-label">Total Pre-Deposit Liquidity</p>
          <h2 className="stat-value" style={{ color: '#d4af37' }}>
            {agents.reduce((acc, a) => acc + Number(a.agentPreDepositWallet?.balance || 0), 0).toLocaleString()} <span style={{ fontSize: '14px', opacity: 0.5 }}>ETB</span>
          </h2>
        </div>
        <div className="stat-card-m">
          <p className="stat-label">Branch Players</p>
          <h2 className="stat-value">{agents.reduce((acc, a) => acc + (a.referrals?.length || 0), 0)}</h2>
        </div>
      </div>

      <div className="data-table-container">
        <div style={{ padding: '24px', borderBottom: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center' }}>
          <div className="login-input-wrapper" style={{ flex: 1, maxWidth: '400px' }}>
            <FiSearch className="login-input-icon" />
            <input 
              type="text" 
              placeholder="Search by name or @username..." 
              className="login-input" 
              style={{ padding: '12px 12px 12px 48px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Agent Name</th>
              <th>Username</th>
              <th>Branch Players</th>
              <th>Pre-Deposit Balance</th>
              <th>Total Volume</th>
              <th>Net Profit</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
               <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center' }}>
                    <div className="animate-spin" style={{ width: '32px', height: '32px', border: '3px solid #d4af37', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }}></div>
                  </td>
               </tr>
            ) : filteredAgents.length === 0 ? (
               <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>No agents matching your search.</td>
               </tr>
            ) : filteredAgents.map((agent) => (
              <tr key={agent.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>{agent.firstName?.[0] || 'A'}</div>
                    <span style={{ fontWeight: '700' }}>{agent.firstName}</span>
                  </div>
                </td>
                <td style={{ color: 'var(--admin-text-muted)', fontSize: '13px' }}>
                   {agent.telegramUsername ? `@${agent.telegramUsername}` : '—'}
                </td>
                <td>
                   <span className="badge badge-blue">{agent.referrals?.length || 0} Players</span>
                </td>
                <td style={{ fontWeight: '800', color: Number(agent.agentPreDepositWallet?.balance || 0) < 1000 ? '#ef4444' : '#4ade80' }}>
                   {Number(agent.agentPreDepositWallet?.balance || 0).toLocaleString()} ETB
                </td>
                <td style={{ fontWeight: '600' }}>
                   {Number(agent.wallet?.totalDeposited || 0).toLocaleString()} ETB
                </td>
                <td>
                   <div style={{ color: '#4ade80', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FiTrendingUp /> {Number(agent.wallet?.referralBalance || 0).toLocaleString()} ETB
                   </div>
                </td>
                <td style={{ textAlign: 'right' }}>
                   <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                     <button 
                       onClick={() => { setSelectedAgent(agent); setShowRechargeModal(true); }}
                       className="action-button"
                       style={{ background: '#fef3c7', color: '#b45309', padding: '6px 12px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}
                     >
                        REFILL
                     </button>
                     <button 
                       onClick={() => handleDemote(agent.id)}
                       style={{ background: '#fef2f2', border: 'none', color: '#ef4444', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                       title="Demote from Agent"
                     >
                        <FiUserX />
                     </button>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination 
        currentPage={page} 
        totalPages={totalPages} 
        onPageChange={setPage} 
        loading={loading}
      />

      {/* ── Recharge Modal ── */}
      {showRechargeModal && (
        <div className="modal-overlay">
           <div className="modal-content">
              <h2 style={{ fontWeight: '900', fontSize: '24px', marginBottom: '10px' }}>Refill Agent Wallet</h2>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '20px' }}>
                 Recharging <b>{selectedAgent?.firstName}</b>'s pre-deposit balance.
              </p>
              
              <div className="login-input-wrapper" style={{ border: '2px solid #eee', marginBottom: '20px' }}>
                 <input 
                    type="number" 
                    placeholder="Enter amount in ETB..." 
                    className="login-input" 
                    style={{ color: 'black' }}
                    value={rechargeAmount}
                    onChange={(e) => setRechargeAmount(e.target.value)}
                 />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                 <button 
                    className="login-button" 
                    onClick={handleRecharge}
                    disabled={rechargeLoading}
                    style={{ flex: 1, padding: '15px' }}
                 >
                    {rechargeLoading ? 'Refilling...' : 'Confirm Refill'}
                 </button>
                 <button 
                    onClick={() => setShowRechargeModal(false)}
                    style={{ flex: 1, background: '#eee', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer' }}
                 >
                    Cancel
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
