"use client";

import React, { useEffect, useState } from 'react';
import { FiSearch, FiUserX, FiShield, FiEdit2, FiUserCheck, FiX, FiUser, FiPhone, FiDollarSign } from 'react-icons/fi';
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
  const [modalState, setModalState] = useState<{isOpen: boolean, action: string, userId: string}>({ isOpen: false, action: '', userId: '' });

  // Edit modal state
  const [editModal, setEditModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ firstName: '', telegramUsername: '', phone: '', status: 'ACTIVE', walletBalance: '', referredBy: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    fetchUsers(page, debouncedSearch);
  }, [page, debouncedSearch]);

  const fetchUsers = async (pageNumber: number, searchQuery: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/admin/users?page=${pageNumber}&search=${encodeURIComponent(searchQuery)}`);
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

  return (
    <div className="admin-page">
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
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '16px', borderRadius: '12px', marginBottom: '24px', fontWeight: '600', fontSize: '14px' }}>
          ⚠️ {error}
        </div>
      )}

      <div className="stat-card-m" style={{ padding: '20px', marginBottom: '32px', display: 'flex', gap: '16px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
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
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: '100px', textAlign: 'center' }}>
            <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid #d4af37', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }}></div>
            <p style={{ marginTop: '16px', fontWeight: '700', color: '#3d2b1f' }}>Brewing data...</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Telegram ID</th>
                <th>Phone Number</th>
                <th>Balance</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
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
                    <span className={`badge ${user.isAdmin || user.role === 'ADMIN' ? 'badge-gold' : user.role === 'AGENT' ? 'badge-blue' : 'badge-green'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${user.status === 'BANNED' ? 'badge-red' : 'badge-green'}`} style={user.status === 'BANNED' ? { background: '#fef2f2', color: '#ef4444' } : {}}>
                      {user.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {/* Edit Button */}
                      <button
                        onClick={() => openEditModal(user)}
                        className="login-button"
                        style={{ padding: '7px 12px', background: '#fef9c3', color: '#854d0e', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Edit User"
                      >
                        <FiEdit2 size={12} /> EDIT
                      </button>

                      {user.status !== 'BANNED' ? (
                        <button
                          onClick={() => handleAction(user.id, 'ban')}
                          className="login-button"
                          style={{ padding: '8px', background: '#fef2f2', color: '#ef4444' }}
                          title="Ban User"
                        >
                          <FiUserX />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAction(user.id, 'unban')}
                          className="login-button"
                          style={{ padding: '8px', background: '#f0fdf4', color: '#22c55e' }}
                          title="Unban User"
                        >
                          <FiUserCheck />
                        </button>
                      )}

                      {user.role !== 'AGENT' && user.role !== 'ADMIN' ? (
                        <button
                          onClick={() => handleAction(user.id, 'promote')}
                          className="login-button"
                          style={{ padding: '8px', background: '#eff6ff', color: '#3b82f6' }}
                          title="Promote to Agent"
                        >
                          <FiShield />
                        </button>
                      ) : user.role === 'AGENT' ? (
                        <button
                          onClick={() => handleAction(user.id, 'demote')}
                          className="login-button"
                          style={{ padding: '8px', background: '#fff7ed', color: '#f97316' }}
                          title="Demote from Agent"
                        >
                          <FiShield style={{ opacity: 0.5 }} />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '60px', color: '#78716c', fontWeight: '600' }}>
                    No players found matching your search.
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
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '800', color: '#78716c', fontSize: '12px' }}>Phone Number</label>
                  <input
                    type="text"
                    className="login-input"
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="e.g. +251912345678"
                  />
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

              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}><FiDollarSign size={10} /> Wallet Balance (ETB)</label>
                <input type="number" className="login-input" value={editForm.walletBalance} onChange={e => setEditForm(f => ({ ...f, walletBalance: e.target.value }))} placeholder="e.g. 500.00" />
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
    </div>
  );
}
