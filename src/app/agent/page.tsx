"use client";

import React, { useEffect, useState } from 'react';
import { 
  FiUsers, FiTrendingUp, FiDollarSign, FiActivity,
  FiArrowUpRight, FiArrowDownRight, FiUserCheck, FiTarget
} from 'react-icons/fi';
import api from '@/lib/api';

export default function AgentDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const userResponse = await api.get('/me');
        const userData = userResponse.data;
        setUser(userData);
        
        // Specifically fetch Agent stats
        const statsResponse = await api.get('/agent/stats');
        setStats(statsResponse.data);
      } catch (err) {
        console.error('Failed to fetch agent stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading || !stats || !user) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-white/5 rounded-2xl"></div>
        ))}
      </div>
    );
  }

  const statCards = [
    { label: 'My Players', value: stats.playerCount, icon: FiUsers, trend: '+5%', up: true, color: 'blue' },
    { label: 'Deposit Volume', value: `${(stats.totalDeposits || 0).toLocaleString()} ETB`, icon: FiTrendingUp, trend: '+18%', up: true, color: 'gold' },
    { label: 'Commission Balance', value: `${(stats.commissionBalance || 0).toLocaleString()} ETB`, icon: FiDollarSign, trend: 'Live', up: true, color: 'gold' },
    { label: 'Total Earned', value: `${(stats.totalCommissionEarned || 0).toLocaleString()} ETB`, icon: FiUserCheck, trend: 'All-time', up: true, color: 'gold' },
  ];

  return (
    <div className="space-y-10">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Branch Overview</h1>
          <p className="text-gray-400 mt-1">Monitor your performance and track your player activity.</p>
        </div>
        <div className="bg-gold/10 border border-gold/20 px-4 py-2 rounded-xl flex items-center">
           <FiTarget className="text-gold mr-2" />
           <span className="text-sm font-bold text-gold uppercase tracking-wider">Top Agent Tier</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, i) => (
          <div key={i} className="bg-coffee border border-white/5 p-6 rounded-2xl relative overflow-hidden group hover:border-gold/30 transition-all shadow-2xl">
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br opacity-5 group-hover:opacity-10 transition-opacity
              ${card.color === 'blue' ? 'from-blue-500 to-transparent' : 'from-gold to-transparent'}
            `} />
            
            <div className="flex items-center justify-between">
              <div className={`p-3 rounded-xl bg-white/5 ${card.color === 'blue' ? 'text-blue-500' : 'text-gold'}`}>
                <card.icon size={24} />
              </div>
              <div className={`flex items-center text-xs font-medium ${card.up ? 'text-green-500' : 'text-red-500'}`}>
                {card.up ? <FiArrowUpRight className="mr-1" /> : <FiArrowDownRight className="mr-1" />}
                {card.trend}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm text-gray-400 font-medium uppercase tracking-wider">{card.label}</p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-white">{card.value}</h2>
            </div>
          </div>
        ))}
      </div>

      {/* Info Boxes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <div className="bg-gradient-to-br from-gold/10 to-transparent border border-white/5 rounded-2xl p-8 shadow-xl">
            <h3 className="text-lg font-bold text-white">Your Referral Link</h3>
            <p className="text-sm text-gray-400 mt-1">New users who join using this link will be added to your branch.</p>
            <div className="mt-6 flex items-center bg-black/40 border border-white/10 rounded-xl p-3">
               <code className="text-gold text-sm flex-1 truncate font-mono">t.me/BunaBingoBot?start={user.id}</code>
               <button className="ml-3 bg-gold hover:bg-gold-dark text-black text-xs font-black px-6 py-2.5 rounded-lg transition-all shadow-lg">
                  COPY LINK
               </button>
            </div>
         </div>

         <div className="bg-coffee border border-white/5 rounded-2xl p-8 flex flex-col justify-between shadow-xl">
            <div>
               <h3 className="text-lg font-bold text-white">Commission Rate</h3>
               <p className="text-sm text-gray-400 mt-1">You earn a percentage of every deposit made by your players.</p>
               <div className="mt-4 flex items-center">
                  <span className="text-4xl font-black text-gold">10%</span>
                  <div className="ml-4">
                    <p className="text-white font-bold leading-none text-sm uppercase tracking-widest">Fixed Rate</p>
                    <p className="text-gray-500 text-xs mt-1">Standard Agent Commission</p>
                  </div>
               </div>
            </div>
         </div>
      </div>

    </div>
  );
}
