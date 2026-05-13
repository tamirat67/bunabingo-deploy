"use client";

import React, { useEffect, useState } from 'react';
import { FiUsers, FiSearch, FiExternalLink, FiDollarSign } from 'react-icons/fi';
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
    p.firstName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8 animate-pulse space-y-4">
    <div className="h-10 bg-white/5 w-1/4 rounded-lg"></div>
    <div className="h-12 bg-white/5 rounded-xl"></div>
    <div className="h-96 bg-white/5 rounded-2xl"></div>
  </div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">My Players</h1>
          <p className="text-gray-400 mt-1">Manage and monitor players in your branch.</p>
        </div>
        <div className="bg-blue-600 px-4 py-2 rounded-xl text-white text-sm font-bold flex items-center shadow-lg shadow-blue-600/20">
          <FiUsers className="mr-2" />
          {total} TOTAL PLAYERS
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center bg-[#161616] border border-white/5 rounded-xl px-4 py-1 focus-within:border-blue-500/50 transition-all">
        <FiSearch className="text-gray-500 mr-3" />
        <input 
          type="text" 
          placeholder="Search by username or name..." 
          className="bg-transparent border-none outline-none text-white text-sm py-3 flex-1"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Players List */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-gray-500 uppercase font-bold tracking-wider border-y border-white/5 bg-white/[0.02]">
                <th className="px-6 py-4">Player</th>
                <th className="px-6 py-4">Joined Date</th>
                <th className="px-6 py-4">Total Deposited</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredPlayers.length > 0 ? filteredPlayers.map((player, i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-bold">
                        {(player.firstName || player.username || 'P')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-gray-200">
                          {player.firstName || 'Anonymous'}
                        </div>
                        <div className="text-xs text-gray-500">@{player.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {new Date(player.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm font-bold text-gray-200">
                      <FiDollarSign size={14} className="text-green-500" />
                      {(player.totalDeposited || 0).toLocaleString()} ETB
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-wider">
                      Active
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100">
                      <FiExternalLink size={18} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-sm italic">
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
