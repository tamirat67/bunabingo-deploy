"use client";

import React, { useEffect, useState } from 'react';
import { FiSearch, FiUsers, FiActivity } from 'react-icons/fi';
import { useApi } from '@/lib/api';

export default function AgentPlayersPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const api = useApi();

  useEffect(() => {
    fetchPlayers();
  }, []);

  async function fetchPlayers() {
    try {
      const data = await api.get('/agent/players');
      setPlayers(data.players || []);
    } catch (err) {
      console.error('Failed to fetch players:', err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = players.filter(p => 
    p.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.telegramUsername?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">My Players</h1>
        <p className="text-gray-500 mt-1">Manage and monitor players in your branch.</p>
      </div>

      <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center bg-black/20">
          <div className="relative flex-1 max-w-md">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text"
              placeholder="Search by name or @username..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-12 pr-4 text-sm outline-none focus:border-blue-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="ml-auto text-sm text-gray-500 font-medium">
             Total Players: <span className="text-white">{players.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-black/40 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Player Name</th>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Joined</th>
                <th className="px-6 py-4">Total Won</th>
                <th className="px-6 py-4">Balance</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                [1,2,3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-8"><div className="h-4 bg-white/5 rounded w-full"></div></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-gray-500 italic">No players found.</td>
                </tr>
              ) : filtered.map((player) => (
                <tr key={player.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-9 h-9 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs mr-3">
                        {player.firstName[0]}
                      </div>
                      <span className="font-medium">{player.firstName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {player.telegramUsername ? `@${player.telegramUsername}` : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {new Date(player.registeredAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 font-mono text-sm">
                    {Number(player.wallet?.totalWon || 0).toLocaleString()} ETB
                  </td>
                  <td className="px-6 py-4 font-bold text-sm">
                    {Number(player.wallet?.balance || 0).toLocaleString()} ETB
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-green-500/10 text-green-500 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tighter">
                      Active
                    </span>
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
