"use client";

import React, { useState } from 'react';
import { 
  FiSmartphone, 
  FiActivity, 
  FiUsers, 
  FiTrendingUp, 
  FiCheckCircle, 
  FiXCircle,
  FiArrowUpRight,
  FiArrowDownLeft
} from 'react-icons/fi';
import '@/app/admin.css';

export default function BunaWalletOverview() {
  const [isLoading] = useState(false);

  // Mock data for the UI
  const stats = {
    totalBalance: 1250400.50,
    activeWallets: 342,
    todayTransactions: 89,
    successRate: 98.5
  };

  const recentActivity = [
    { id: '1', type: 'deposit', amount: 5000, user: '+251911234567', time: '10 mins ago', status: 'completed' },
    { id: '2', type: 'withdrawal', amount: 1200, user: '+251922345678', time: '25 mins ago', status: 'pending' },
    { id: '3', type: 'transfer', amount: 300, user: '+251933456789', time: '1 hour ago', status: 'completed' },
    { id: '4', type: 'deposit', amount: 10000, user: '+251944567890', time: '2 hours ago', status: 'failed' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--cmd-gold)' }}></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-[#3d2b1f] uppercase tracking-wide">Buna Wallet Overview</h1>
          <p className="text-sm font-bold text-black/50 mt-1">Live metrics and recent activity for mobile wallets</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card" style={{ background: '#0F1115', color: 'white' }}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[#d4af37]">Total Wallet Balances</p>
              <h3 className="text-2xl font-black mt-1">
                {stats.totalBalance.toLocaleString()} <span className="text-xs text-white/50">ETB</span>
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-white/5 text-[#d4af37]">
              <FiTrendingUp size={20} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-black/40">Active Wallets</p>
              <h3 className="text-2xl font-black text-[#3d2b1f] mt-1">{stats.activeWallets}</h3>
            </div>
            <div className="p-3 rounded-xl bg-black/5 text-[#3d2b1f]">
              <FiUsers size={20} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-black/40">Today's Transactions</p>
              <h3 className="text-2xl font-black text-[#3d2b1f] mt-1">{stats.todayTransactions}</h3>
            </div>
            <div className="p-3 rounded-xl bg-black/5 text-[#3d2b1f]">
              <FiActivity size={20} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-black/40">OTP Success Rate</p>
              <h3 className="text-2xl font-black text-[#3d2b1f] mt-1">{stats.successRate}%</h3>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600">
              <FiSmartphone size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Activity Table */}
        <div className="lg:col-span-2 admin-card p-6 rounded-2xl bg-white border border-black/5 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-black uppercase tracking-wider text-[#3d2b1f]">Recent Wallet Activity</h3>
            <button className="text-[10px] font-bold text-[#d4af37] uppercase tracking-wider hover:underline">View All</button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/5">
                  <th className="pb-3 text-[10px] font-black text-black/40 uppercase tracking-wider">Transaction</th>
                  <th className="pb-3 text-[10px] font-black text-black/40 uppercase tracking-wider">User (Phone)</th>
                  <th className="pb-3 text-[10px] font-black text-black/40 uppercase tracking-wider">Amount</th>
                  <th className="pb-3 text-[10px] font-black text-black/40 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((activity) => (
                  <tr key={activity.id} className="border-b border-black/5 hover:bg-black/[0.02] transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          activity.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-600' :
                          activity.type === 'withdrawal' ? 'bg-rose-500/10 text-rose-600' :
                          'bg-blue-500/10 text-blue-600'
                        }`}>
                          {activity.type === 'deposit' ? <FiArrowDownLeft size={14} /> : 
                           activity.type === 'withdrawal' ? <FiArrowUpRight size={14} /> : 
                           <FiActivity size={14} />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#3d2b1f] capitalize">{activity.type}</p>
                          <p className="text-[10px] text-black/40 font-semibold">{activity.time}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      <p className="text-xs font-bold text-[#3d2b1f]">{activity.user}</p>
                    </td>
                    <td className="py-4">
                      <p className={`text-xs font-black ${
                        activity.type === 'deposit' ? 'text-emerald-600' : 'text-[#3d2b1f]'
                      }`}>
                        {activity.type === 'deposit' ? '+' : '-'}{activity.amount.toLocaleString()} ETB
                      </p>
                    </td>
                    <td className="py-4">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        activity.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' :
                        activity.status === 'pending' ? 'bg-amber-500/10 text-amber-600' :
                        'bg-rose-500/10 text-rose-600'
                      }`}>
                        {activity.status === 'completed' ? <FiCheckCircle size={10} /> :
                         activity.status === 'pending' ? <FiActivity size={10} /> :
                         <FiXCircle size={10} />}
                        {activity.status}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions / System Health */}
        <div className="space-y-6">
          <div className="admin-card p-6 rounded-2xl bg-gradient-to-br from-[#0F1115] to-[#1a1c23] border border-white/10 text-white shadow-lg">
            <h3 className="text-sm font-black uppercase tracking-wider text-[#d4af37] mb-4">System Health</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-xs font-bold text-white/80">OTP SMS Gateway</span>
                </div>
                <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Operational</span>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-xs font-bold text-white/80">Wallet Database</span>
                </div>
                <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Operational</span>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">Telerivet Balance</p>
              <div className="flex items-end gap-2">
                <h4 className="text-2xl font-black">2,450</h4>
                <span className="text-xs font-bold text-white/50 mb-1">SMS remaining</span>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
