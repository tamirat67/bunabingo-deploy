"use client";

import React, { useEffect, useState } from 'react';
import { 
  FiUsers, FiTrendingUp, FiDollarSign, FiActivity,
  FiArrowUpRight, FiArrowDownRight, FiUserCheck
} from 'react-icons/fi';
import api from '@/lib/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const userResponse = await api.get('/me');
        const userData = userResponse.data;
        setUser(userData);
        
        const isAdmin = userData.role === 'ADMIN' || userData.isAdmin;
        const endpoint = isAdmin ? '/admin/analytics' : '/agent/stats';
        const statsResponse = await api.get(endpoint);
        setStats(statsResponse.data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-white/5 rounded-2xl"></div>
        ))}
      </div>
    );
  }

  const isAdmin = user.role === 'ADMIN' || user.isAdmin;

  const statCards = isAdmin ? [
    { label: 'Total Users', value: stats.totalUsers, icon: FiUsers, trend: '+12%', up: true, color: 'blue' },
    { label: 'Active Games', value: stats.activeGames, icon: FiActivity, trend: 'Normal', up: true, color: 'green' },
    { label: 'Total Deposits', value: `${(stats.totalDeposited || 0).toLocaleString()} ETB`, icon: FiTrendingUp, trend: '+24%', up: true, color: 'amber' },
    { label: 'Pending Withdrawals', value: stats.pendingWithdrawals, icon: FiDollarSign, trend: '-2%', up: false, color: 'red' },
  ] : [
    { label: 'My Players', value: stats.playerCount, icon: FiUsers, trend: '+5%', up: true, color: 'blue' },
    { label: 'Total Volume', value: `${(stats.totalDeposits || 0).toLocaleString()} ETB`, icon: FiTrendingUp, trend: '+18%', up: true, color: 'amber' },
    { label: 'Commission Balance', value: `${(stats.commissionBalance || 0).toLocaleString()} ETB`, icon: FiDollarSign, trend: 'Live', up: true, color: 'green' },
    { label: 'Total Earned', value: `${(stats.totalCommissionEarned || 0).toLocaleString()} ETB`, icon: FiUserCheck, trend: 'All-time', up: true, color: 'purple' },
  ];

  return (
    <div className="space-y-10">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user.firstName} 👋</h1>
        <p className="text-gray-500 mt-1">Here is what is happening in your {isAdmin ? 'platform' : 'branch'} today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, i) => (
          <div key={i} className="bg-[#161616] border border-white/5 p-6 rounded-2xl relative overflow-hidden group hover:border-amber-500/30 transition-all">
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br opacity-5 group-hover:opacity-10 transition-opacity
              ${card.color === 'blue' ? 'from-blue-500 to-transparent' : 
                card.color === 'green' ? 'from-green-500 to-transparent' : 
                card.color === 'amber' ? 'from-amber-500 to-transparent' : 
                card.color === 'red' ? 'from-red-500 to-transparent' : 'from-purple-500 to-transparent'}
            `} />
            
            <div className="flex items-center justify-between">
              <div className={`p-3 rounded-xl bg-white/5 text-${card.color}-500`}>
                <card.icon size={24} />
              </div>
              <div className={`flex items-center text-xs font-medium ${card.up ? 'text-green-500' : 'text-red-500'}`}>
                {card.up ? <FiArrowUpRight className="mr-1" /> : <FiArrowDownRight className="mr-1" />}
                {card.trend}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">{card.label}</p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight">{card.value}</h2>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Section (Admin Only) */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 bg-[#161616] border border-white/5 rounded-2xl p-8">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-lg font-bold">Revenue Distribution</h3>
                 <select className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm outline-none focus:border-amber-500">
                    <option>Last 30 Days</option>
                    <option>Last 7 Days</option>
                 </select>
              </div>
              
              <div className="space-y-4">
                 <p className="text-sm text-gray-400">Top Performing Agents</p>
                 {/* Placeholder for Revenue Chart or Detailed List */}
                 <div className="text-center py-20 border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
                    <FiTrendingUp className="mx-auto text-gray-700 mb-3" size={48} />
                    <p className="text-gray-500 italic">Agent performance analytics will appear here as volume increases.</p>
                 </div>
              </div>
           </div>

           <div className="bg-gradient-to-br from-amber-600/20 to-transparent border border-amber-500/20 rounded-2xl p-8 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold">Total Platform Profit</h3>
                <p className="text-sm text-amber-500/70 mt-1">Net profit after payouts and commissions</p>
                <div className="mt-8">
                   <span className="text-4xl font-black tracking-tighter">
                      {(Number(stats.totalDeposited || 0) - Number(stats.totalWithdrawn || 0)).toLocaleString()} 
                   </span>
                   <span className="text-amber-500 ml-2 font-bold uppercase text-sm tracking-widest">ETB</span>
                </div>
              </div>
              
              <div className="mt-8 pt-8 border-t border-amber-500/10">
                 <button className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-3 rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98]">
                    Generate Full Report
                 </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}
