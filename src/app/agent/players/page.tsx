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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">My Players</h1>
          <p className="text-gray-400 mt-1">Manage and track players in your branch.</p>
        </div>
        
        <div className="relative group">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-gold transition-colors" />
          <input 
            type="text"
            placeholder="Search players..."
            className="bg-coffee border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 w-full md:w-80 text-white transition-all shadow-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Players Table */}
      <div className="bg-coffee border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-bottom border-white/5 bg-white/2">
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Player</th>
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Phone</th>
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Joined</th>
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Total Deposited</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredPlayers.length > 0 ? filteredPlayers.map((player: any) => (
                <tr key={player.id} className="hover:bg-white/2 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center text-gold font-bold">
                        {(player.firstName || 'P')[0]}
                      </div>
                      <div>
                        <div className="font-bold text-white group-hover:text-gold transition-colors">{player.firstName} {player.lastName}</div>
                        <div className="text-xs text-gray-500">ID: {player.id.split('-')[0]}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 font-medium">
                    {player.phoneNumber}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(player.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-sm font-black text-gold">
                      {Number(player._count?.deposits * 100 || 0).toLocaleString()} ETB
                    </div>
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
