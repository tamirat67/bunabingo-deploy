"use client";

import React, { useEffect, useState } from 'react';
import { FiSearch, FiUserX, FiShield, FiEdit2, FiUserCheck, FiX, FiUser, FiPhone, FiDollarSign, FiCheckSquare, FiSquare } from 'react-icons/fi';
import api from '@/lib/api';
import { Pagination } from '@/components/Pagination';
import BunaModal from '@/components/BunaModal';
import '@/app/admin.css';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, active: 0, banned: 0 });
  const [agentFilter, setAgentFilter] = useState('');
  const [modalState, setModalState] = useState<{isOpen: boolean, action: string, userId: string}>({ isOpen: false, action: '', userId: '' });
  const [agentsList, setAgentsList] = useState<any[]>([]);

  // Edit modal state
  const [editModal, setEditModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ firstName: '', telegramUsername: '', phone: '', status: 'ACTIVE', walletBalance: '', referredBy: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  // Staff management state
  const [staffModal, setStaffModal] = useState(false);
  const [staffTarget, setStaffTarget] = useState<any>(null);
  const [staffAgentsList, setStaffAgentsList] = useState<any[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffMsg, setStaffMsg] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    setPage(1);
    fetchUsers(1, debouncedSearch, agentFilter);
  }, [debouncedSearch, agentFilter]);

  useEffect(() => {
    fetchUsers(page, debouncedSearch, agentFilter);
  }, [page]);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await api.get('/admin/agents?limit=100');
      if (response.data?.agents) {
        setAgentsList(response.data.agents);
        setStaffAgentsList(response.data.agents);
      }
    } catch (err) {
      console.error('Failed to fetch agents', err);
    }
  };

  const fetchUsers = async (pageNumber: number, searchQuery: string, agentId = '') => {
    try {
      setLoading(true);
      setError(null);
      let url = `/admin/users?page=${pageNumber}&search=${encodeURIComponent(searchQuery)}`;
      if (agentId) url += `&referredBy=${agentId}`;
      const response = await api.get(url);
      const data = response.data;
      setUsers(data.users || []);
      setTotalPages(data.pages || 1);
      const total = data.total || data.users?.length || 0;
      const banned = data.users?.filter((u: any) => u.status === 'BANNED').length || 0;
      setStats({ total, active: total - banned, banned });
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to fetch users.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (userId: string, action: string) => {
    setModalState({ isOpen: true, action, userId });
  };

  const executeAction = async () => {
    try {
      await api.post(`/admin/users/${modalState.userId}/${modalState.action}`);
      fetchUsers(page, debouncedSearch);
    } catch (err) {
      alert('Action failed. Check permissions.');
    } finally {
      setModalState({ isOpen: false, action: '', userId: '' });
    }
  };

  const openEditModal = (user: any) => {
    setEditUser(user);
    setEditForm({
      firstName: user.firstName || '',
      telegramUsername: user.telegramUsername || '',
      phone: user.phone || user.phoneNumber || '',
      status: user.status || 'ACTIVE',
      walletBalance: parseFloat(user.wallet?.balance || 0).toFixed(2),
      referredBy: user.referredBy || '',
    });
    setEditError('');
    setEditSuccess('');
    setEditModal(true);
  };

  const handleEditSave = async () => {
    if (!editUser) return;
    setEditLoading(true);
    setEditError('');
    setEditSuccess('');
    try {
      await api.patch(`/admin/users/${editUser.id}`, editForm);
      setEditSuccess('✅ User updated successfully!');
      fetchUsers(page, debouncedSearch);
      setTimeout(() => setEditModal(false), 1500);
    } catch (err: any) {
      setEditError(err?.response?.data?.error || 'Failed to save changes.');
    } finally {
      setEditLoading(false);
    }
  };

  // ── Staff management handlers ──────────────────────────────
  const openStaffModal = async (user: any) => {
    setStaffTarget(user);
    setStaffMsg('');
    setStaffModal(true);
    // Load currently assigned agents
    if (user.role === 'STAFF') {
      try {
        const res = await api.get(`/admin/staff/${user.id}/assigned-agents`);
        setSelectedAgentIds(res.data.agentIds || []);
      } catch (_) {
        setSelectedAgentIds([]);
      }
    } else {
      setSelectedAgentIds([]);
    }
  };

  const handlePromoteToStaff = async () => {
    if (!staffTarget) return;
    setStaffLoading(true);
    setStaffMsg('');
    try {
      await api.post(`/admin/users/${staffTarget.id}/promote-staff`);
      setStaffMsg('✅ User promoted to STAFF! Now assign their agents below.');
      fetchUsers(page, debouncedSearch);
    } catch (err: any) {
      setStaffMsg('❌ ' + (err?.response?.data?.error || 'Promotion failed'));
    } finally {
      setStaffLoading(false);
    }
  };

  const handleDemoteStaff = async () => {
    if (!staffTarget) return;
    if (!confirm('Demote this staff member back to PLAYER? Their agent assignments will be cleared.')) return;
    setStaffLoading(true);
    try {
      await api.post(`/admin/users/${staffTarget.id}/demote-staff`);
      setStaffMsg('✅ Staff demoted to PLAYER.');
      fetchUsers(page, debouncedSearch);
      setStaffModal(false);
    } catch (err: any) {
      setStaffMsg('❌ ' + (err?.response?.data?.error || 'Failed'));
    } finally {
      setStaffLoading(false);
    }
  };

  const toggleAgentAssignment = (agentId: string) => {
    setSelectedAgentIds(prev =>
      prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    );
  };

  const handleSaveAssignments = async () => {
    if (!staffTarget) return;
    setStaffLoading(true);
    setStaffMsg('');
    try {
      await api.post(`/admin/staff/${staffTarget.id}/assign-agents`, { agentIds: selectedAgentIds });
      setStaffMsg(`✅ Assigned ${selectedAgentIds.length} agent(s) to ${staffTarget.firstName || 'staff'}.`);
      fetchUsers(page, debouncedSearch);
    } catch (err: any) {
      setStaffMsg('❌ ' + (err?.response?.data?.error || 'Failed to save assignments'));
    } finally {
      setStaffLoading(false);
    }
  };

  const roleBadgeStyle = (role: string): React.CSSProperties => {
    if (role === 'ADMIN') return { background: '#fef9c3', color: '#854d0e' };
    if (role === 'AGENT') return { background: '#eff6ff', color: '#1d4ed8' };
    if (role === 'STAFF') return { background: '#f3e8ff', color: '#7c3aed' };
    return { background: '#f0fdf4', color: '#16a34a' };
  };

  return (
    <div className="admin-page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>User Network</h1>
          <p style={{ color: '#78716c', margin: '4px 0 0', fontSize: '14px' }}>Monitor and manage all platform players</p>
        </div>
        <div className="stat-pill" style={{ display: 'flex', gap: '12px' }}>
          <div style={{ background: '#fff', padding: '8px 16px', borderRadius: '12px', border: '1px solid #f5f5f4', fontSize: '12px', fontWeight: '800' }}>
            <span style={{ color: '#d4af37' }}>●</span> {stats.total} TOTAL
          </div>
          <div style={{ background: '#fff', padding: '8px 16px', borderRadius: '12px', border: '1px solid #f5f5f4', fontSize: '12px', fontWeight: '800' }}>
            <span style={{ color: '#22c55e' }}>●</span> {stats.active} ACTIVE
          </div>
          {stats.banned > 0 && (
            <div style={{ background: '#fff', padding: '8px 16px', borderRadius: '12px', border: '1px solid #f5f5f4', fontSize: '12px', fontWeight: '800' }}>
              <span style={{ color: '#ef4444' }}>●</span> {stats.banned} BANNED
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '16px', borderRadius: '12px', marginBottom: '24px', fontWeight: '600', fontSize: '14px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Filters */}
      <div className="stat-card-m" style={{ padding: '20px', marginBottom: '32px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <FiSearch style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#a8a29e' }} />
          <input
            type="text"
            placeholder="Search by ID, Username or Name..."
            className="login-input"
            style={{ paddingLeft: '48px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ position: 'relative', minWidth: '200px' }}>
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="login-input"
            style={{ paddingLeft: '16px', appearance: 'none', cursor: 'pointer', fontWeight: '700', color: agentFilter ? '#3d2b1f' : '#a8a29e' }}
          >
            <option value="">🔍 All Agents</option>
            <option value="unassigned">⚠ Unassigned (No Agent)</option>
            {agentsList.map((agent: any) => (
              <option key={agent.id} value={agent.id}>
                {agent.firstName} {agent.referralCode ? `(${agent.referralCode})` : ''} — {agent.referrals?.length ?? 0} players
              </option>
            ))}
          </select>
        </div>
        {agentFilter && (
          <button
            onClick={() => setAgentFilter('')}
            style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' }}
          >
            ✕ Clear Filter
          </button>
        )}
      </div>

      {/* Table */}
      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: '100px', textAlign: 'center' }}>
            <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid #d4af37', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }} />
            <p style={{ marginTop: '16px', fontWeight: '700', color: '#3d2b1f' }}>Brewing data...</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Telegram ID</th>
                <th>Phone</th>
                <th>Balance</th>
                <th>Referrer</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}
                  style={{ transition: 'background 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.02)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="user-avatar" style={{ width: '40px', height: '40px', fontSize: '16px' }}>
                        {user.firstName?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <div style={{ fontWeight: '800', color: '#3d2b1f' }}>{user.firstName}</div>
                        <div style={{ fontSize: '12px', color: '#78716c' }}>@{user.telegramUsername || 'no_username'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontWeight: '700' }}>{user.telegramId?.toString()}</td>
                  <td>{user.phone || user.phoneNumber || 'N/A'}</td>
                  <td>
                    <div style={{ fontWeight: '800', color: '#3d2b1f' }}>
                      {parseFloat(user.wallet?.balance || 0).toLocaleString()} <span style={{ fontSize: '10px', color: '#d4af37' }}>ETB</span>
                    </div>
                  </td>
                  <td>
                    {user.referrer ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: '800', color: user.referrer.role === 'PLAYER' ? '#6b7280' : '#1d4ed8', fontSize: '12px' }}>
                          @{user.referrer.telegramUsername || user.referrer.firstName || 'Unknown'}
                          {user.referrer.role === 'PLAYER' && <span style={{ marginLeft: '4px', fontSize: '9px', background: '#f3f4f6', color: '#6b7280', padding: '2px 4px', borderRadius: '4px' }}>PLAYER</span>}
                        </span>
                        {user.referrer.referralCode && (
                          <span style={{ fontSize: '10px', color: '#7c3aed', fontFamily: 'monospace', fontWeight: '700', background: '#f3f0ff', padding: '1px 5px', borderRadius: '4px', alignSelf: 'flex-start' }}>
                            {user.referrer.referralCode}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#a8a29e', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
                      fontSize: '11px', fontWeight: '800', ...roleBadgeStyle(user.role)
                    }}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${user.status === 'BANNED' ? 'badge-red' : 'badge-green'}`}
                      style={user.status === 'BANNED' ? { background: '#fef2f2', color: '#ef4444' } : {}}>
                      {user.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {/* Edit */}
                      <button onClick={() => openEditModal(user)}
                        className="login-button"
                        style={{ padding: '7px 12px', background: '#fef9c3', color: '#854d0e', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Edit User">
                        <FiEdit2 size={12} /> EDIT
                      </button>

                      {/* Ban / Unban */}
                      {user.status !== 'BANNED' ? (
                        <button onClick={() => handleAction(user.id, 'ban')}
                          className="login-button"
                          style={{ padding: '8px', background: '#fef2f2', color: '#ef4444' }}
                          title="Ban User">
                          <FiUserX />
                        </button>
                      ) : (
                        <button onClick={() => handleAction(user.id, 'unban')}
                          className="login-button"
                          style={{ padding: '8px', background: '#f0fdf4', color: '#22c55e' }}
                          title="Unban User">
                          <FiUserCheck />
                        </button>
                      )}

                      {/* Promote to Agent */}
                      {user.role !== 'AGENT' && user.role !== 'ADMIN' && user.role !== 'STAFF' && (
                        <button onClick={() => handleAction(user.id, 'promote')}
                          className="login-button"
                          style={{ padding: '8px', background: '#eff6ff', color: '#3b82f6' }}
                          title="Promote to Agent">
                          <FiShield />
                        </button>
                      )}
                      {user.role === 'AGENT' && (
                        <button onClick={() => handleAction(user.id, 'demote')}
                          className="login-button"
                          style={{ padding: '8px', background: '#fff7ed', color: '#f97316' }}
                          title="Demote from Agent">
                          <FiShield style={{ opacity: 0.5 }} />
                        </button>
                      )}

                      {/* Staff Management Button */}
                      {user.role !== 'ADMIN' && user.role !== 'AGENT' && (
                        <button onClick={() => openStaffModal(user)}
                          className="login-button"
                          style={{
                            padding: '7px 10px', fontSize: '11px', fontWeight: '800',
                            display: 'flex', alignItems: 'center', gap: '4px',
                            background: user.role === 'STAFF' ? '#f3e8ff' : '#f9f9f9',
                            color: user.role === 'STAFF' ? '#7c3aed' : '#6b7280',
                            border: user.role === 'STAFF' ? '1px solid #e9d5ff' : '1px solid #e5e7eb'
                          }}
                          title={user.role === 'STAFF' ? 'Manage Staff Agents' : 'Promote to Staff'}>
                          👤 {user.role === 'STAFF' ? 'STAFF ▾' : 'STAFF'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '60px', color: '#78716c', fontWeight: '600' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>👥</div>
                    <div>No players found matching your search.</div>
                    {debouncedSearch && <div style={{ fontSize: '12px', marginTop: '4px', color: '#a8a29e' }}>Try a different search term</div>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} loading={loading} />

      {/* Action Confirm Modal */}
      <BunaModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, action: '', userId: '' })}
        onConfirm={executeAction}
        title="Confirm Action"
        message={`Are you sure you want to ${modalState.action} this user?`}
        type="confirm"
        confirmText="Yes, Proceed"
      />

      {/* ── Edit User Modal ── */}
      {editModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h2 style={{ fontWeight: '900', fontSize: '22px', margin: 0 }}>Edit User</h2>
              <button onClick={() => setEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#78716c' }}>
                <FiX />
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#78716c', marginBottom: '20px' }}>
              Editing <b>{editUser?.firstName}</b> — Telegram ID: <code>{editUser?.telegramId}</code>
            </p>

            {editError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#dc2626', fontWeight: '600' }}>{editError}</div>}
            {editSuccess && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>{editSuccess}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}><FiUser size={10} /> Full Name</label>
                  <input type="text" className="login-input" value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} placeholder="e.g. John Doe" />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}><FiUser size={10} /> Username</label>
                  <input type="text" className="login-input" value={editForm.telegramUsername} onChange={e => setEditForm(f => ({ ...f, telegramUsername: e.target.value }))} placeholder="e.g. john_doe" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '800', color: '#78716c', fontSize: '12px' }}>Phone Number</label>
                  <input type="text" className="login-input" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} placeholder="e.g. +251912345678" />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Status</label>
                  <select className="login-input" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} style={{ cursor: 'pointer' }}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="BANNED">BANNED</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}><FiDollarSign size={10} /> Wallet Balance (ETB)</label>
                  <input type="number" className="login-input" value={editForm.walletBalance} onChange={e => setEditForm(f => ({ ...f, walletBalance: e.target.value }))} placeholder="e.g. 500.00" />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}><FiShield size={10} /> Assign to Agent</label>
                  <select className="login-input" value={editForm.referredBy} onChange={e => setEditForm(f => ({ ...f, referredBy: e.target.value }))} style={{ cursor: 'pointer' }}>
                    <option value="">-- No Agent --</option>
                    {agentsList.map(agent => (
                      <option key={agent.id} value={agent.id}>
                        {agent.firstName || agent.telegramUsername || 'Agent'} ({agent.telegramUsername ? `@${agent.telegramUsername}` : agent.id.slice(0, 8)})
                      </option>
                    ))}
                  </select>
                </div>
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

      {/* ── Staff Management Modal ── */}
      {staffModal && staffTarget && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px', width: '92%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <h2 style={{ fontWeight: '900', fontSize: '20px', margin: 0 }}>
                  {staffTarget.role === 'STAFF' ? '👤 Manage Staff Member' : '👤 Promote to Staff'}
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#78716c' }}>
                  {staffTarget.firstName || staffTarget.telegramUsername} — current role: <b>{staffTarget.role}</b>
                </p>
              </div>
              <button onClick={() => setStaffModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#78716c' }}>
                <FiX size={20} />
              </button>
            </div>

            {staffMsg && (
              <div style={{
                padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', fontSize: '13px', fontWeight: '600',
                background: staffMsg.startsWith('✅') ? '#f0fdf4' : '#fef2f2',
                color: staffMsg.startsWith('✅') ? '#16a34a' : '#dc2626',
                border: staffMsg.startsWith('✅') ? '1px solid #bbf7d0' : '1px solid #fecaca'
              }}>
                {staffMsg}
              </div>
            )}

            {staffTarget.role !== 'STAFF' ? (
              /* Not yet STAFF — show promote button */
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>👤</div>
                <p style={{ color: '#78716c', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>
                  Promoting <b>{staffTarget.firstName}</b> will give them <b>read-only</b> access to their assigned agents' dashboards and reports.
                </p>
                <button
                  onClick={handlePromoteToStaff}
                  disabled={staffLoading}
                  style={{
                    width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                    color: 'white', fontWeight: '900', fontSize: '15px', cursor: 'pointer'
                  }}>
                  {staffLoading ? 'Promoting...' : '✓ Promote to Staff'}
                </button>
              </div>
            ) : (
              /* Already STAFF — show agent assignment */
              <>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
                  Select which agents this staff member can monitor. They will see data <b>only</b> for selected agents.
                </p>

                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '340px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {staffAgentsList.length === 0 ? (
                    <p style={{ color: '#a8a29e', textAlign: 'center', padding: '24px' }}>No agents found on the platform.</p>
                  ) : staffAgentsList.map((agent: any) => {
                    const isSelected = selectedAgentIds.includes(agent.id);
                    return (
                      <div
                        key={agent.id}
                        onClick={() => toggleAgentAssignment(agent.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '12px 14px', borderRadius: '12px', cursor: 'pointer',
                          border: isSelected ? '1.5px solid #7c3aed' : '1.5px solid rgba(0,0,0,0.06)',
                          background: isSelected ? 'rgba(124,58,237,0.05)' : '#fafafa',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ color: isSelected ? '#7c3aed' : '#d1d5db', flexShrink: 0 }}>
                          {isSelected ? <FiCheckSquare size={18} /> : <FiSquare size={18} />}
                        </div>
                        <div style={{
                          width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
                          background: isSelected ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : '#e5e7eb',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '900', fontSize: '13px', color: isSelected ? 'white' : '#6b7280'
                        }}>
                          {(agent.firstName || agent.telegramUsername || 'A')[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '800', color: '#3d2b1f', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {agent.firstName || '—'} <span style={{ color: '#9ca3af', fontWeight: '600' }}>@{agent.telegramUsername || 'N/A'}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                            {agent.referrals?.length ?? 0} players • Balance: {Number(agent.wallet?.balance || 0).toLocaleString()} ETB
                          </div>
                        </div>
                        {isSelected && (
                          <span style={{ fontSize: '10px', fontWeight: '800', color: '#7c3aed', background: '#ede9fe', padding: '2px 8px', borderRadius: '20px', flexShrink: 0 }}>
                            ASSIGNED
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '14px' }}>
                  <button
                    onClick={handleSaveAssignments}
                    disabled={staffLoading}
                    style={{
                      flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                      background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                      color: 'white', fontWeight: '900', fontSize: '14px', cursor: 'pointer'
                    }}>
                    {staffLoading ? 'Saving...' : `💾 Save Assignments (${selectedAgentIds.length} agents)`}
                  </button>
                  <button
                    onClick={handleDemoteStaff}
                    disabled={staffLoading}
                    style={{
                      padding: '12px 16px', borderRadius: '12px', border: '1px solid #fecaca',
                      background: '#fef2f2', color: '#dc2626', fontWeight: '800', fontSize: '13px', cursor: 'pointer'
                    }}>
                    Demote
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
