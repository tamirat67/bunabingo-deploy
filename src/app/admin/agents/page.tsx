"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiSearch, FiUserPlus, FiTrendingUp, FiTrendingDown, FiUserX, FiX, FiLock, FiPhone, FiUser, FiAlertCircle, FiTrash2, FiPlus, FiEdit2, FiDollarSign, FiBarChart2 } from 'react-icons/fi';
import api from '@/lib/api';
import { Pagination } from '@/components/Pagination';
import BunaModal from '@/components/BunaModal';
import '@/app/admin.css';

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [rechargeLoading, setRechargeLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [newStaff, setNewStaff] = useState({ telegramId: '', username: '', firstName: '', role: 'AGENT', password: '' });

  // Deposit Phones Modal State
  const [showDepositPhonesModal, setShowDepositPhonesModal] = useState(false);
  const [depositPhonesLoading, setDepositPhonesLoading] = useState(false);
  const [depositPhonesSuccess, setDepositPhonesSuccess] = useState('');
  const [depositPhonesError, setDepositPhonesError] = useState('');
  const [agentDepositPhones, setAgentDepositPhones] = useState<{name: string, phone: string, last4: string}[]>([]);

  // Demote Agent Modal State
  const [demoteModal, setDemoteModal] = useState<{isOpen: boolean, userId: string}>({ isOpen: false, userId: '' });

  // Edit Agent Modal State
  const [editModal, setEditModal] = useState(false);
  const [editAgent, setEditAgent] = useState<any>(null);
  const [editForm, setEditForm] = useState({ firstName: '', telegramUsername: '', phone: '', preDepositBalance: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  // Alert Modal State
  const [alertModal, setAlertModal] = useState<{isOpen: boolean, title: string, message: string, type: 'info' | 'error' | 'success' | 'confirm' | 'balance'}>({ isOpen: false, title: '', message: '', type: 'info' });
  const [discountRate, setDiscountRate] = useState(0.20);

  useEffect(() => {
    fetchAgents();
  }, [page]);

  useEffect(() => {
    fetchDiscountRate();
    try {
      const token = localStorage.getItem('admin_token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setIsAdmin(payload.role === 'ADMIN' || payload.isAdmin);
      }
    } catch (e) {}
  }, []);

  async function fetchDiscountRate() {
    try {
      const res = await api.get('/admin/settings');
      const compRate = parseFloat(res.data.COMPANY_COMMISSION_RATE) || 30;
      const agentRate = parseFloat(res.data.AGENT_PROFIT_RATE) || 6;
      if (compRate > 0) {
        setDiscountRate(agentRate / compRate);
      }
    } catch (err) {
      console.error('Failed to fetch settings/discount rate:', err);
    }
  }

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
      setAlertModal({ isOpen: true, title: 'Success', message: `Successfully refilled ${selectedAgent.firstName}'s wallet!`, type: 'success' });
    } catch (err: any) {
      setAlertModal({ isOpen: true, title: 'Error', message: err.response?.data?.error || 'Recharge failed.', type: 'error' });
    } finally {
      setRechargeLoading(false);
    }
  };

  const handleDemote = (userId: string) => {
    setDemoteModal({ isOpen: true, userId });
  };

  const executeDemote = async () => {
    try {
      await api.post(`/admin/users/${demoteModal.userId}/demote`);
      fetchAgents();
    } catch (err) {
      setAlertModal({ isOpen: true, title: 'Error', message: 'Demotion failed.', type: 'error' });
    } finally {
      setDemoteModal({ isOpen: false, userId: '' });
    }
  };

  const openEditModal = (agent: any) => {
    setEditAgent(agent);
    setEditForm({
      firstName: agent.firstName || '',
      telegramUsername: agent.telegramUsername || '',
      phone: agent.phone || agent.phoneNumber || '',
      preDepositBalance: Number(agent.preDepositStatus?.balance ?? agent.agentPreDepositWallet?.balance ?? 0).toFixed(2),
    });
    setEditError('');
    setEditSuccess('');
    setEditModal(true);
  };

  const handleEditSave = async () => {
    if (!editAgent) return;
    setEditLoading(true);
    setEditError('');
    setEditSuccess('');
    try {
      await api.patch(`/admin/agents/${editAgent.id}`, editForm);
      setEditSuccess('✅ Agent updated successfully!');
      fetchAgents();
      setTimeout(() => setEditModal(false), 1500);
    } catch (err: any) {
      setEditError(err?.response?.data?.error || 'Failed to save changes.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleCreateStaff = async () => {
    setCreateError('');
    setCreateSuccess('');
    if (!newStaff.telegramId || !newStaff.username || !newStaff.password) {
      setCreateError('Telegram ID, username and password are required.');
      return;
    }
    setCreateLoading(true);
    try {
      await api.post('/admin/staff/create', newStaff);
      setCreateSuccess(`✅ @${newStaff.username} created successfully as ${newStaff.role}!`);
      setNewStaff({ telegramId: '', username: '', firstName: '', role: 'AGENT', password: '' });
      fetchAgents();
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'Failed to create staff member.');
    } finally {
      setCreateLoading(false);
    }
  };

  const openDepositPhonesModal = (agent: any) => {
    setSelectedAgent(agent);
    setDepositPhonesSuccess('');
    setDepositPhonesError('');
    
    // Safely parse depositPhones in case it's stringified JSON from the database
    let phones = [];
    if (Array.isArray(agent.depositPhones)) {
      phones = [...agent.depositPhones];
    } else if (typeof agent.depositPhones === 'string') {
      try {
        phones = JSON.parse(agent.depositPhones);
      } catch (e) {}
    }
    
    // Auto-populate with at least one empty row if no phones exist
    if (phones.length === 0) {
      phones = [{ name: '', phone: '', last4: '' }];
    }
    
    setAgentDepositPhones(phones);
    setShowDepositPhonesModal(true);
  };

  const handleSaveDepositPhones = async () => {
    if (!selectedAgent) return;
    setDepositPhonesLoading(true);
    setDepositPhonesSuccess('');
    setDepositPhonesError('');
    try {
      await api.patch(`/admin/agents/${selectedAgent.id}/deposit-phones`, {
        depositPhones: agentDepositPhones
      });
      fetchAgents();
      setDepositPhonesSuccess(`Successfully updated deposit phones for ${selectedAgent.firstName}!`);
      setTimeout(() => setShowDepositPhonesModal(false), 2000);
    } catch (err: any) {
      setDepositPhonesError(err.response?.data?.error || 'Failed to update deposit phones.');
    } finally {
      setDepositPhonesLoading(false);
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
          <h1 style={{ fontSize: '36px', fontWeight: '900', margin: 0, color: '#3d2b1f' }}>Agent Network</h1>
          <p style={{ color: 'var(--admin-text-muted)', marginTop: '4px' }}>Manage your branch managers and refill their pre-deposit liquidity.</p>
        </div>
        {isAdmin && (
          <button 
            className="login-button" 
            onClick={() => setShowCreateModal(true)}
            style={{ width: 'auto', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <FiUserPlus /> Create Agent / Admin
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="premium-stat-card">
          <div className="card-label">Total Agents</div>
          <div className="card-value">{totalCount || agents.length}</div>
          <div style={{ fontSize: '12px', color: '#8c857b', marginTop: '4px' }}>Active branch managers</div>
        </div>
        <div className="premium-stat-card">
          <div className="card-label">Pre-Deposit Liquidity</div>
          <div className="card-value" style={{ color: '#d4af37', fontSize: '20px' }}>
            {agents.reduce((acc, a) => acc + Number((a.preDepositStatus?.balance ?? a.agentPreDepositWallet?.balance) || 0), 0).toLocaleString()} ETB
          </div>
          <div style={{ fontSize: '12px', color: '#8c857b', marginTop: '4px' }}>Combined agent reserve</div>
        </div>
        <div className="premium-stat-card">
          <div className="card-label">Branch Players</div>
          <div className="card-value">{agents.reduce((acc, a) => acc + (a.referrals?.length ?? a._count?.referrals ?? 0), 0)}</div>
          <div style={{ fontSize: '12px', color: '#8c857b', marginTop: '4px' }}>Across all branches</div>
        </div>
      </div>

      {/* Critical Pre-Deposit Alert Banner */}
      {agents.filter(a => a.preDepositStatus?.state === 'RED').length > 0 && (
        <div style={{
          background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '16px',
          padding: '16px 20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991b1b', fontWeight: '900', fontSize: '15px' }}>
            <FiAlertCircle size={20} /> CRITICAL: Pre-Deposit Recharge Required!
          </div>
          <p style={{ color: '#7f1d1d', fontSize: '13px', margin: 0, lineHeight: '1.4' }}>
            The following agents have critically low pre-deposit balances and cannot host/start games. Please refill their accounts immediately:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
            {agents.filter(a => a.preDepositStatus?.state === 'RED').map(a => (
              <span key={a.id} className="badge badge-red" style={{ padding: '6px 12px', fontSize: '12px', fontWeight: '800' }}>
                {a.firstName} ({Number(a.preDepositStatus?.balance ?? a.agentPreDepositWallet?.balance ?? 0).toFixed(2)} ETB)
              </span>
            ))}
          </div>
        </div>
      )}

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
              <th>Referral Code / Link</th>
              <th>Branch Players</th>
              <th>Pre-Deposit Balance</th>
              <th>Real Profit</th>
              <th>Bot Exposure</th>
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
                <td>
                  {agent.referralCode ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <code style={{ fontSize: '12px', fontWeight: '900', color: '#3d2b1f', background: 'rgba(212,175,55,0.1)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(212,175,55,0.3)' }}>{agent.referralCode}</code>
                      <span style={{ fontSize: '10px', color: '#8c857b', wordBreak: 'break-all' }}>?start={agent.referralCode}</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: '700' }}>⚠ No code</span>
                  )}
                </td>
                <td>
                   <span className="badge badge-blue">{agent.referrals?.length ?? agent._count?.referrals ?? 0} Players</span>
                </td>
                <td>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                     <span style={{ fontWeight: '800', color: agent.preDepositStatus?.state === 'RED' ? '#ef4444' : agent.preDepositStatus?.state === 'YELLOW' ? '#f59e0b' : '#10b981' }}>
                       {Number(agent.preDepositStatus?.balance ?? agent.agentPreDepositWallet?.balance ?? 0).toLocaleString()} ETB
                     </span>
                     {agent.preDepositStatus?.state === 'RED' ? (
                       <span className="badge badge-red" style={{ fontSize: '10px', padding: '2px 6px', alignSelf: 'flex-start' }}>CRITICAL</span>
                     ) : agent.preDepositStatus?.state === 'YELLOW' ? (
                       <span className="badge badge-gold" style={{ fontSize: '10px', padding: '2px 6px', alignSelf: 'flex-start', background: '#fef3c7', color: '#d97706' }}>LOW BALANCE</span>
                     ) : (
                       <span className="badge badge-green" style={{ fontSize: '10px', padding: '2px 6px', alignSelf: 'flex-start' }}>HEALTHY</span>
                     )}
                   </div>
                </td>
                 <td>
                    {/* Real Net Profit: earnings from real (non-bot) players → positive green */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ color: '#10b981', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
                        <FiTrendingUp size={13} />
                        +{Number(agent.realNetProfit ?? agent.wallet?.referralBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                      </div>
                      <span style={{ fontSize: '10px', color: '#059669', fontWeight: '700', textTransform: 'uppercase' }}>Real Money</span>
                    </div>
                 </td>
                 <td>
                    {/* Bot Exposure: earnings attributed to house bots → shown as NEGATIVE (fake) */}
                    {Number(agent.botNetProfit ?? 0) > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ color: '#ef4444', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
                          <FiTrendingDown size={13} />
                          -{Number(agent.botNetProfit ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                        </div>
                        <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: '700', textTransform: 'uppercase' }}>Fake Balance</span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--admin-text-muted)', fontSize: '13px' }}>—</span>
                    )}
                 </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', flexWrap: 'wrap' }}>
                    <Link href={`/admin/agents/${agent.id}`}>
                      <button
                        style={{ background: '#eff6ff', color: '#3b82f6', padding: '6px 12px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="View Full Report"
                      >
                        <FiBarChart2 size={12} /> REPORT
                      </button>
                    </Link>
                    {isAdmin && (
                      <button
                        onClick={() => openEditModal(agent)}
                        style={{ background: '#fef9c3', color: '#854d0e', padding: '6px 12px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Edit Agent"
                      >
                        <FiEdit2 size={12} /> EDIT
                      </button>
                    )}
                    <button 
                      onClick={() => { setSelectedAgent(agent); setShowRechargeModal(true); }}
                      className="action-button"
                      style={{ background: '#fef3c7', color: '#b45309', padding: '6px 12px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}
                    >
                       REFILL
                    </button>
                    <button 
                      onClick={() => openDepositPhonesModal(agent)}
                      style={{ background: '#f0fdf4', color: '#16a34a', padding: '6px 12px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}
                    >
                       <FiPhone size={12} style={{ marginRight: '4px' }} /> PHONES
                    </button>
                    {isAdmin && (
                      <button 
                        onClick={() => handleDemote(agent.id)}
                        style={{ background: '#fef2f2', border: 'none', color: '#ef4444', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                        title="Demote from Agent"
                      >
                         <FiUserX />
                      </button>
                    )}
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

      <BunaModal 
        isOpen={demoteModal.isOpen}
        onClose={() => setDemoteModal({ isOpen: false, userId: '' })}
        onConfirm={executeDemote}
        title="Remove Agent"
        message="Are you sure you want to remove this agent from the network? This action will demote them to a regular user."
        type="error"
        confirmText="Remove Agent"
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

              {rechargeAmount && parseFloat(rechargeAmount) > 0 && (
                <div style={{ background: '#faf9f7', borderRadius: '12px', padding: '16px', marginBottom: '20px', border: '1px solid #e7e5e4', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#78716c' }}>
                    <span style={{ fontWeight: '600' }}>Digital Balance to add:</span>
                    <strong style={{ color: '#22c55e', fontWeight: '800' }}>{parseFloat(rechargeAmount).toLocaleString()} ETB</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#78716c' }}>
                    <span style={{ fontWeight: '600' }}>Cash to collect from Agent:</span>
                    <strong style={{ color: '#3d2b1f', fontWeight: '800' }}>{(parseFloat(rechargeAmount) * (1 - discountRate)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#78716c' }}>
                    <span style={{ fontWeight: '600' }}>Agent Profit (Margin):</span>
                    <strong style={{ color: '#d4af37', fontWeight: '800' }}>{(parseFloat(rechargeAmount) * discountRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</strong>
                  </div>
                </div>
              )}

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
      {/* ── Create Staff Modal ── */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontWeight: '900', fontSize: '22px', margin: 0 }}>Create Agent / Staff / Admin</h2>
              <button onClick={() => { setShowCreateModal(false); setCreateError(''); setCreateSuccess(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>
                <FiX />
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#78716c', marginBottom: '20px' }}>Create a staff member directly — no Telegram bot interaction needed.</p>

            {createError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#dc2626', fontWeight: '600' }}>{createError}</div>}
            {createSuccess && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>{createSuccess}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}><FiPhone size={10} /> Telegram ID</label>
                  <input type="number" className="login-input" placeholder="e.g. 5310030963" value={newStaff.telegramId} onChange={e => setNewStaff(s => ({ ...s, telegramId: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}><FiUser size={10} /> Username</label>
                  <input type="text" className="login-input" placeholder="e.g. agent_john" value={newStaff.username} onChange={e => setNewStaff(s => ({ ...s, username: e.target.value }))} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}><FiUser size={10} /> Full Name (optional)</label>
                <input type="text" className="login-input" placeholder="e.g. John Doe" value={newStaff.firstName} onChange={e => setNewStaff(s => ({ ...s, firstName: e.target.value }))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Role</label>
                  <select className="login-input" value={newStaff.role} onChange={e => setNewStaff(s => ({ ...s, role: e.target.value }))} style={{ cursor: 'pointer' }}>
                    <option value="AGENT">Agent</option>
                    <option value="STAFF">Staff</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}><FiLock size={10} /> Password</label>
                  <input type="password" className="login-input" placeholder="Min 6 characters" value={newStaff.password} onChange={e => setNewStaff(s => ({ ...s, password: e.target.value }))} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button className="login-button" onClick={handleCreateStaff} disabled={createLoading} style={{ flex: 1, padding: '14px' }}>
                {createLoading ? 'Creating...' : 'Create Staff Member'}
              </button>
              <button onClick={() => { setShowCreateModal(false); setCreateError(''); setCreateSuccess(''); }} style={{ flex: 1, background: '#eee', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Deposit Phones Modal ── */}
      {showDepositPhonesModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontWeight: '900', fontSize: '22px', margin: 0 }}>Deposit Phones</h2>
              <button onClick={() => setShowDepositPhonesModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>
                <FiX />
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#78716c', marginBottom: '20px' }}>
              Manage Telebirr/CBE deposit phone numbers for <b>{selectedAgent?.firstName}</b>. These will be shown to players depositing under this agent.
            </p>

            {depositPhonesError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#dc2626', fontWeight: '600' }}>{depositPhonesError}</div>}
            {depositPhonesSuccess && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>{depositPhonesSuccess}</div>}

            {agentDepositPhones.map((phoneEntry, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 60px 40px', gap: '8px', marginBottom: '12px', alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: '800', color: '#78716c', display: 'block', marginBottom: '4px' }}>Account Name</label>
                  <input type="text" className="login-input" placeholder="e.g. LUEL" value={phoneEntry.name} onChange={e => {
                    const newPhones = [...agentDepositPhones];
                    newPhones[index].name = e.target.value;
                    setAgentDepositPhones(newPhones);
                  }} style={{ padding: '8px', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: '800', color: '#78716c', display: 'block', marginBottom: '4px' }}>Phone Number</label>
                  <input type="text" className="login-input" placeholder="e.g. 251969455111" value={phoneEntry.phone} onChange={e => {
                    const val = e.target.value;
                    const newPhones = [...agentDepositPhones];
                    newPhones[index] = {
                      ...newPhones[index],
                      phone: val,
                      // Automate 'Last 4' extraction reliably
                      last4: val.length >= 4 ? val.slice(-4) : val
                    };
                    setAgentDepositPhones(newPhones);
                  }} style={{ padding: '8px', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: '800', color: '#78716c', display: 'block', marginBottom: '4px' }}>Last 4</label>
                  <input type="text" className="login-input" value={phoneEntry.last4} readOnly style={{ padding: '8px', fontSize: '13px', background: '#f5f5f4', color: '#78716c' }} />
                </div>
                <button onClick={() => {
                  const newPhones = agentDepositPhones.filter((_, i) => i !== index);
                  setAgentDepositPhones(newPhones);
                }} style={{ background: '#fef2f2', border: 'none', color: '#ef4444', padding: '10px', borderRadius: '8px', cursor: 'pointer', height: '36px' }}>
                  <FiTrash2 />
                </button>
              </div>
            ))}

            <button onClick={() => setAgentDepositPhones([...agentDepositPhones, { name: '', phone: '', last4: '' }])} style={{ background: '#f0fdf4', color: '#16a34a', border: '1px dashed #bbf7d0', width: '100%', padding: '10px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px' }}>
              <FiPlus /> Add Phone Number
            </button>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button className="login-button" onClick={handleSaveDepositPhones} disabled={depositPhonesLoading} style={{ flex: 1, padding: '14px' }}>
                {depositPhonesLoading ? 'Saving...' : 'Save Deposit Phones'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Agent Modal ── */}
      {editModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h2 style={{ fontWeight: '900', fontSize: '22px', margin: 0 }}>Edit Agent</h2>
              <button onClick={() => setEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#78716c' }}>
                <FiX />
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#78716c', marginBottom: '20px' }}>
              Editing <b>{editAgent?.firstName}</b>{editAgent?.telegramUsername ? ` (@${editAgent.telegramUsername})` : ''}
            </p>

            {editError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#dc2626', fontWeight: '600' }}>{editError}</div>}
            {editSuccess && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>{editSuccess}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}><FiUser size={10} /> Full Name</label>
                  <input type="text" className="login-input" value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} placeholder="e.g. John" />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}><FiUser size={10} /> Username</label>
                  <input type="text" className="login-input" value={editForm.telegramUsername} onChange={e => setEditForm(f => ({ ...f, telegramUsername: e.target.value }))} placeholder="e.g. agent_john" />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}><FiPhone size={10} /> Phone</label>
                <input type="text" className="login-input" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. 0911234567" />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}><FiDollarSign size={10} /> Pre-Deposit Balance (ETB)</label>
                <input type="number" className="login-input" value={editForm.preDepositBalance} onChange={e => setEditForm(f => ({ ...f, preDepositBalance: e.target.value }))} placeholder="e.g. 5000" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button className="login-button" onClick={handleEditSave} disabled={editLoading} style={{ flex: 1, padding: '14px' }}>
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => setEditModal(false)} style={{ flex: 1, background: '#eee', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <BunaModal 
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
}
