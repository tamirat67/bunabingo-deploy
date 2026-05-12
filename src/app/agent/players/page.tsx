"use client";

import React, { useEffect, useState } from 'react';
import { FiSearch, FiUsers, FiTrendingUp } from 'react-icons/fi';
import api from '@/lib/api';
import '@/app/admin.css';

export default function AgentPlayersPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchPlayers() {
      try {
        const response = await api.get('/agent/players');
        setPlayers(response.data.players || []);
      } catch (err) {
        console.error('Failed to fetch players:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPlayers();
  }, []);

  const filteredPlayers = players.filter(player => 
    player.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.phone?.includes(searchTerm)
  );

  return (
    <div className="admin-page">
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: '900', margin: 0 }}>My Players</h1>
        <p style={{ color: 'var(--admin-text-muted)', marginTop: '4px' }}>List of players registered through your referral link.</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card-m">
          <p className="stat-label">Total Players</p>
          <h2 className="stat-value">{players.length}</h2>
        </div>
        <div className="stat-card-m">
          <p className="stat-label">Branch Volume</p>
          <h2 className="stat-value" style={{ color: 'var(--agent-accent)' }}>
            {players.reduce((acc, p) => acc + (p.wallet?.totalDeposited || 0), 0).toLocaleString()} ETB
          </h2>
        </div>
      </div>

      <div className="data-table-container">
        <div style={{ padding: '24px', borderBottom: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center' }}>
          <div className="login-input-wrapper" style={{ flex: 1, maxWidth: '400px' }}>
            <FiSearch className="login-input-icon" />
            <input 
              type="text" 
              placeholder="Search players by name or phone..." 
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
              <th>Player Name</th>
              <th>Phone Number</th>
              <th>Joined Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
               <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>Loading players...</td></tr>
            ) : filteredPlayers.length === 0 ? (
               <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-text-muted)' }}>No players found in your branch.</td></tr>
            ) : filteredPlayers.map((player: any) => (
              <tr key={player.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '12px', color: 'var(--agent-accent)' }}>{player.firstName[0]}</div>
                    <span style={{ fontWeight: '700' }}>{player.firstName}</span>
                  </div>
                </td>
                <td style={{ color: 'var(--admin-text-muted)' }}>{player.phone || 'Not verified'}</td>
                <td>{new Date(player.createdAt).toLocaleDateString()}</td>
                <td>
                  <span className="badge badge-green">Active</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
