"use client";

import React, { useEffect, useState } from 'react';
import { FiSearch, FiUserX, FiShield, FiTrendingUp, FiMoreHorizontal, FiUserCheck } from 'react-icons/fi';
import api from '@/lib/api';
import { Pagination } from '@/components/Pagination';
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

  // Debounce search query changes to prevent flooding the server
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
      console.error('Failed to fetch users:', err);
      setError(err?.response?.data?.error || err.message || 'Failed to fetch users. Please make sure you are logged in as an authorized admin.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (userId: string, action: string) => {
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    try {
      await api.post(`/admin/users/${userId}/${action}`);
      fetchUsers(page, debouncedSearch);
    } catch (err) {
      alert('Action failed. Check permissions.');
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
        <div style={{ 
          background: '#fef2f2', 
          border: '1px solid #fca5a5', 
          color: '#b91c1c', 
          padding: '16px', 
          borderRadius: '12px', 
          marginBottom: '24px', 
          fontWeight: '600',
          fontSize: '14px'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Search & Filters */}
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

      {/* Users Table */}
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
                    <div style={{ display: 'flex', gap: '8px' }}>
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
                  <td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: '#78716c', fontWeight: '600' }}>
                    No players found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <Pagination 
        currentPage={page} 
        totalPages={totalPages} 
        onPageChange={setPage} 
        loading={loading}
      />
    </div>
  );
}
