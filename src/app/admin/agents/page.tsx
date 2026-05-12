"use client";

import React, { useEffect, useState } from 'react';
import { FiSearch, FiPlus, FiMoreHorizontal, FiExternalLink, FiUserPlus, FiTrendingUp } from 'react-icons/fi';
import api from '@/lib/api';

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAgents();
  }, []);

  async function fetchAgents() {
    try {
      const response = await api.get('/admin/agents');
      setAgents(response.data.agents || []);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePromote(userId: string) {
    if (!confirm('Promote this user to Agent?')) return;
    try {
      await api.post(`/admin/users/${userId}/promote`, {});
      fetchAgents();
      alert('User promoted successfully!');
    } catch (err) {
      alert('Failed to promote user');
    }
  }

  const filteredAgents = agents.filter(agent => 
    agent.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.telegramUsername?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Agents Network</h1>
          <p className="text-gray-500 mt-1">Manage your branch managers and track their performance.</p>
        </div>
        <button className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-6 py-3 rounded-xl flex items-center transition-all shadow-lg shadow-amber-500/10">
          <FiUserPlus className="mr-2" /> Promote New Agent
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#161616] border border-white/5 p-6 rounded-2xl">
          <p className="text-sm text-gray-500 uppercase tracking-widest font-semibold">Total Agents</p>
          <p className="text-3xl font-bold mt-2">{agents.length}</p>
        </div>
        <div className="bg-[#161616] border border-white/5 p-6 rounded-2xl">
          <p className="text-sm text-gray-500 uppercase tracking-widest font-semibold">Total Branch Players</p>
          <p className="text-3xl font-bold mt-2">
            {agents.reduce((acc, a) => acc + (a._count?.players || 0), 0)}
          </p>
        </div>
        <div className="bg-[#161616] border border-white/5 p-6 rounded-2xl">
          <p className="text-sm text-gray-500 uppercase tracking-widest font-semibold">Avg. Growth</p>
          <p className="text-3xl font-bold mt-2 text-green-500">+14.2%</p>
        </div>
      </div>

      {/* Agents Table */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center bg-black/20">
          <div className="relative flex-1 max-w-md">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text"
              placeholder="Search by name or @username..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-12 pr-4 text-sm outline-none focus:border-amber-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-black/40 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Agent Name</th>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Total Players</th>
                <th className="px-6 py-4">Total Volume</th>
                <th className="px-6 py-4">Commission</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                [1,2,3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-8"><div className="h-4 bg-white/5 rounded w-full"></div></td>
                  </tr>
                ))
              ) : filteredAgents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-gray-500 italic">No agents found matching your search.</td>
                </tr>
              ) : filteredAgents.map((agent) => (
                <tr key={agent.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xs mr-3">
                        {agent.firstName[0]}
                      </div>
                      <span className="font-medium">{agent.firstName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {agent.telegramUsername ? `@${agent.telegramUsername}` : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-blue-500/10 text-blue-500 px-3 py-1 rounded-lg text-xs font-bold">
                      {agent._count?.players || 0} Players
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm">
                    {Number(agent.wallet?.totalDeposited || 0).toLocaleString()} ETB
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-green-500 font-bold text-sm">
                       <FiTrendingUp className="mr-1" />
                       {Number(agent.wallet?.commissionBalance || 0).toLocaleString()} ETB
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                       <button className="p-2 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-white">
                          <FiExternalLink />
                       </button>
                       <button className="p-2 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-white">
                          <FiMoreHorizontal />
                       </button>
                    </div>
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
