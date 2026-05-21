"use client";

import React, { useEffect, useState } from 'react';
import { FiUsers, FiSearch } from 'react-icons/fi';
import api from '@/lib/api';

export default function PlayersPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchPlayers() {
      try {
        const response = await api.get('/agent/players');
        setPlayers(response.data.users || []);
        setTotal(response.data.total || 0);
      } catch (err) {
        console.error('Failed to fetch players:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPlayers();
  }, []);

  const filteredPlayers = players.filter(p =>
    p.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.phone || p.phoneNumber || '').includes(searchTerm)
  );

  if (loading) return (
    <div className="agent-space-y-6">
      <div className="agent-skeleton" style={{ height: '2.5rem', width: '25%', borderRadius: '0.5rem' }} />
      <div className="agent-skeleton" style={{ height: '3rem', borderRadius: '0.75rem' }} />
      <div className="agent-skeleton" style={{ height: '24rem', borderRadius: '1rem' }} />
    </div>
  );

  return (
    <div className="agent-space-y-8">

      <div className="agent-page-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="agent-h1">My Players</h1>
          <p className="agent-subtitle">Manage and track players in your branch.</p>
        </div>
        <div className="agent-search-wrap">
          <FiSearch size={16} />
          <input
            type="text"
            placeholder="Search players..."
            className="agent-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Players Table */}
      <div className="agent-table-wrap">
        <div className="agent-table-scroll">
          <table className="agent-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Phone</th>
                <th>Joined</th>
                <th className="right">Total Deposited</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.length > 0 ? filteredPlayers.map((player: any) => (
                <tr key={player.id}>
                  <td>
                    <div className="agent-player-cell">
                      <div className="agent-avatar-sm">
                        {(player.firstName || 'P')[0]}
                      </div>
                      <div>
                        <div className="agent-player-name">{player.firstName} {player.lastName}</div>
                        <div className="agent-player-sub">ID: {player.id?.split('-')[0]}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: '#d1d5db' }}>{player.phone || player.phoneNumber || 'N/A'}</td>
                  <td style={{ color: 'var(--agent-muted)' }}>
                    {new Date(player.createdAt).toLocaleDateString()}
                  </td>
                  <td className="right agent-text-gold" style={{ fontWeight: 900 }}>
                    {Number(player.wallet?.totalDeposited || 0).toLocaleString()} ETB
                  </td>
                </tr>
              )) : (
                <tr className="agent-table-empty">
                  <td colSpan={4}>
                    {searchTerm ? 'No players match your search.' : 'No players joined your branch yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
