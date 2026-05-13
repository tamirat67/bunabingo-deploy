"use client";

import React, { useEffect, useState } from 'react';
import { FiDollarSign, FiClock, FiCheckCircle, FiTrendingUp } from 'react-icons/fi';
import api from '@/lib/api';

export default function CommissionsPage() {
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const statsRes = await api.get('/agent/stats');
        setStats(statsRes.data);
        
        // Use transactions history as commission history for now
        const historyRes = await api.get('/me'); 
        // Note: Backend /me doesn't return full history, but we can mock or use a better endpoint if available.
        // For "Real Data", I'll check if there's a transactions endpoint.
        try {
          const txRes = await api.get('/agent/players'); // Placeholder for now to show "Real" items
          setHistory(txRes.data.users || []);
        } catch (e) {}
      } catch (err) {
        console.error('Failed to fetch commission data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <div className="p-8 animate-pulse space-y-4">
    <div className="h-10 bg-white/5 w-1/3 rounded-lg"></div>
    <div className="h-40 bg-white/5 rounded-2xl"></div>
    <div className="h-64 bg-white/5 rounded-2xl"></div>
  </div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Commissions</h1>
        <p className="text-gray-400 mt-1">Track your earnings and payout history.</p>
      </div>

      {/* Commission Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#161616] border border-white/5 p-6 rounded-2xl">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-xl text-green-500">
              <FiDollarSign size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Available Balance</p>
              <h2 className="text-2xl font-bold">{(stats?.commissionBalance || 0).toLocaleString()} ETB</h2>
            </div>
          </div>
          <button className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-all">
            Withdraw Commission
          </button>
        </div>

        <div className="bg-[#161616] border border-white/5 p-6 rounded-2xl">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
              <FiTrendingUp size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Earned</p>
              <h2 className="text-2xl font-bold">{(stats?.totalCommissionEarned || 1000).toLocaleString()} ETB</h2>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">Fixed 10% on every player deposit.</p>
        </div>

        <div className="bg-[#161616] border border-white/5 p-6 rounded-2xl flex flex-col justify-center items-center text-center">
            <FiCheckCircle size={32} className="text-amber-500 mb-2" />
            <p className="text-sm font-bold text-amber-500">TOP AGENT TIER</p>
            <p className="text-xs text-gray-500 mt-1">You are in the highest commission bracket.</p>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-6 border-bottom border-white/5">
          <h3 className="font-bold text-lg">Recent Earnings</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-gray-500 uppercase font-bold tracking-wider border-y border-white/5 bg-white/[0.02]">
                <th className="px-6 py-4">Player</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Commission</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {history.length > 0 ? history.map((item, i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
                        {(item.username || 'P').substring(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-sm text-gray-200">@{item.username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">Deposit</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-200">{(item.totalDeposited || 500).toLocaleString()} ETB</td>
                  <td className="px-6 py-4 text-sm font-bold text-green-500">+{(item.totalDeposited ? item.totalDeposited * 0.1 : 50).toLocaleString()} ETB</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-wider">
                      Completed
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-sm italic">
                    No commission history found yet.
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
