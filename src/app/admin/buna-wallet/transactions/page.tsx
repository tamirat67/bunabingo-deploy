"use client";

import React, { useState } from 'react';
import { 
  FiDollarSign, 
  FiCheck,
  FiX,
  FiClock,
  FiSearch,
  FiFilter,
  FiArrowDownLeft,
  FiArrowUpRight
} from 'react-icons/fi';
import '@/app/admin.css';

export default function BunaWalletTransactions() {
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [searchTerm, setSearchTerm] = useState('');

  // Mock data for Transactions
  const transactions = [
    { id: 'TRX-1092', type: 'deposit', amount: 5000, user: '+251911234567', time: '10 mins ago', status: 'pending', method: 'CBE Birr' },
    { id: 'TRX-1093', type: 'withdrawal', amount: 1200, user: '+251922345678', time: '25 mins ago', status: 'pending', method: 'Telebirr' },
    { id: 'TRX-1090', type: 'deposit', amount: 300, user: '+251933456789', time: '1 hour ago', status: 'completed', method: 'Telebirr' },
    { id: 'TRX-1089', type: 'withdrawal', amount: 10000, user: '+251944567890', time: '2 hours ago', status: 'rejected', method: 'Awash Bank' },
    { id: 'TRX-1094', type: 'deposit', amount: 2500, user: '+251955678901', time: '5 mins ago', status: 'pending', method: 'CBE Birr' },
  ];

  const filteredTransactions = transactions.filter(trx => {
    const matchesSearch = trx.user.includes(searchTerm) || trx.id.includes(searchTerm);
    const matchesTab = activeTab === 'pending' ? trx.status === 'pending' : (trx.status === 'completed' || trx.status === 'rejected');
    return matchesSearch && matchesTab;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#3d2b1f] uppercase tracking-wide">Transfers & Refills</h1>
          <p className="text-sm font-bold text-black/50 mt-1">Manage user deposits and withdrawal requests</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" size={16} />
            <input 
              type="text" 
              placeholder="Search user or TRX ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-black/10 bg-white text-sm font-bold focus:outline-none focus:border-[#d4af37]"
            />
          </div>
          <button className="p-2.5 rounded-xl border border-black/10 bg-white text-black/60 hover:text-[#d4af37] transition-colors">
            <FiFilter size={18} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="admin-card rounded-2xl bg-white border border-black/5 shadow-sm overflow-hidden">
        
        {/* Tabs */}
        <div className="flex border-b border-black/5">
          <button 
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-4 text-xs font-black uppercase tracking-wider transition-colors ${
              activeTab === 'pending' 
                ? 'text-[#d4af37] border-b-2 border-[#d4af37] bg-black/[0.01]' 
                : 'text-black/40 hover:text-black/60'
            }`}
          >
            Pending Requests
          </button>
          <button 
            onClick={() => setActiveTab('completed')}
            className={`flex-1 py-4 text-xs font-black uppercase tracking-wider transition-colors ${
              activeTab === 'completed' 
                ? 'text-[#d4af37] border-b-2 border-[#d4af37] bg-black/[0.01]' 
                : 'text-black/40 hover:text-black/60'
            }`}
          >
            Completed & Rejected
          </button>
        </div>

        <div className="p-6 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/5">
                <th className="pb-3 text-[10px] font-black text-black/40 uppercase tracking-wider">Transaction ID</th>
                <th className="pb-3 text-[10px] font-black text-black/40 uppercase tracking-wider">User</th>
                <th className="pb-3 text-[10px] font-black text-black/40 uppercase tracking-wider">Type / Method</th>
                <th className="pb-3 text-[10px] font-black text-black/40 uppercase tracking-wider">Amount</th>
                <th className="pb-3 text-[10px] font-black text-black/40 uppercase tracking-wider">Time</th>
                <th className="pb-3 text-[10px] font-black text-black/40 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((trx) => (
                <tr key={trx.id} className="border-b border-black/5 hover:bg-black/[0.02] transition-colors">
                  <td className="py-4">
                    <span className="font-mono text-xs font-black text-[#3d2b1f] bg-black/5 px-2 py-1 rounded">
                      {trx.id}
                    </span>
                  </td>
                  <td className="py-4">
                    <p className="text-sm font-black text-[#3d2b1f]">{trx.user}</p>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${
                        trx.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                      }`}>
                        {trx.type === 'deposit' ? <FiArrowDownLeft size={12} /> : <FiArrowUpRight size={12} />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#3d2b1f] capitalize">{trx.type}</p>
                        <p className="text-[10px] text-black/40 font-semibold">{trx.method}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4">
                    <p className={`text-sm font-black ${
                        trx.type === 'deposit' ? 'text-emerald-600' : 'text-[#3d2b1f]'
                      }`}>
                      {trx.type === 'deposit' ? '+' : '-'}{trx.amount.toLocaleString()} ETB
                    </p>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-black/50">
                      <FiClock size={12} />
                      {trx.time}
                    </div>
                  </td>
                  <td className="py-4 text-right">
                    {trx.status === 'pending' ? (
                      <div className="flex justify-end gap-2">
                        <button className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm">
                          <FiCheck size={12} /> Approve
                        </button>
                        <button className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors border border-rose-200">
                          <FiX size={12} /> Reject
                        </button>
                      </div>
                    ) : (
                      <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg ${
                        trx.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'
                      }`}>
                        {trx.status}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <p className="text-sm font-bold text-black/40">No transactions found.</p>
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
