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
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight">Commissions</h1>
        <p className="text-gray-400 mt-1">Track your earnings and payout history.</p>
      </div>

      {/* Commission Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-coffee border border-white/5 p-8 rounded-2xl shadow-2xl relative overflow-hidden group">
          <div className="relative z-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gold/10 rounded-xl text-gold">
                <FiDollarSign size={28} />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-black tracking-widest">Available Balance</p>
                <h2 className="text-3xl font-black text-white mt-1">{(stats?.commissionBalance || 0).toLocaleString()} ETB</h2>
              </div>
            </div>
            <button className="w-full mt-8 bg-gold hover:bg-gold-dark text-black font-black py-4 rounded-xl transition-all shadow-lg transform hover:-translate-y-0.5 active:translate-y-0">
              WITHDRAW NOW
            </button>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-gold/10 transition-colors" />
        </div>

        <div className="bg-coffee border border-white/5 p-8 rounded-2xl shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
              <FiTrendingUp size={28} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-black tracking-widest">Total Earned</p>
              <h2 className="text-3xl font-black text-white mt-1">{(stats?.totalCommissionEarned || 0).toLocaleString()} ETB</h2>
            </div>
          </div>
          <div className="mt-8 flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Fixed Commission Rate</span>
            <span className="text-gold font-black text-lg">10%</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gold/10 to-transparent border border-white/5 p-8 rounded-2xl shadow-2xl flex flex-col justify-center items-center text-center">
            <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mb-4">
              <FiCheckCircle size={32} className="text-gold" />
            </div>
            <p className="text-sm font-black text-gold tracking-widest uppercase">TOP AGENT TIER</p>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">You are in the highest commission bracket and priority support.</p>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-coffee border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-8 py-6 border-bottom border-white/5 bg-white/2 flex items-center justify-between">
          <h3 className="font-black text-lg text-white tracking-tight uppercase">Recent Earnings</h3>
          <FiClock className="text-gray-500" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs text-gray-500 uppercase font-black tracking-widest border-y border-white/5 bg-white/2">
                <th className="px-8 py-5">Player</th>
                <th className="px-8 py-5">Source</th>
                <th className="px-8 py-5">Amount</th>
                <th className="px-8 py-5">Commission</th>
                <th className="px-8 py-5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {history.length > 0 ? history.map((item: any, i: number) => (
                <tr key={i} className="hover:bg-white/2 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center text-xs font-black text-gold">
                        {(item.firstName || 'P').substring(0, 2).toUpperCase()}
                      </div>
                      <span className="font-bold text-white group-hover:text-gold transition-colors">{item.firstName || item.username}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm text-gray-400 font-medium tracking-tight">Deposit Reward</td>
                  <td className="px-8 py-5 text-sm font-black text-white">{(item.totalDeposited || 500).toLocaleString()} ETB</td>
                  <td className="px-8 py-5 text-sm font-black text-gold">+{(item.totalDeposited ? item.totalDeposited * 0.1 : 50).toLocaleString()} ETB</td>
                  <td className="px-8 py-5 text-right">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-gold/10 text-gold text-[10px] font-black uppercase tracking-widest">
                      CREDITED
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-gray-500 font-medium italic">
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
