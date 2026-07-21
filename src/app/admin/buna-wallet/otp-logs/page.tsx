"use client";

import React, { useState } from 'react';
import { 
  FiMessageSquare, 
  FiCheckCircle, 
  FiXCircle,
  FiClock,
  FiSearch,
  FiFilter
} from 'react-icons/fi';
import '@/app/admin.css';

export default function BunaWalletOtpLogs() {
  const [searchTerm, setSearchTerm] = useState('');

  // Mock data for OTP Logs
  const logs = [
    { id: '1', phone: '+251911234567', code: '482910', status: 'verified', time: '2 mins ago', attempts: 1 },
    { id: '2', phone: '+251922345678', code: '193847', status: 'sent', time: '5 mins ago', attempts: 0 },
    { id: '3', phone: '+251933456789', code: '502938', status: 'failed', time: '12 mins ago', attempts: 3 },
    { id: '4', phone: '+251944567890', code: '847291', status: 'verified', time: '1 hour ago', attempts: 1 },
    { id: '5', phone: '+251955678901', code: '293847', status: 'expired', time: '2 hours ago', attempts: 0 },
    { id: '6', phone: '+251966789012', code: '682910', status: 'verified', time: '3 hours ago', attempts: 2 },
  ];

  const filteredLogs = logs.filter(log => log.phone.includes(searchTerm));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#3d2b1f] uppercase tracking-wide">OTP SMS Logs</h1>
          <p className="text-sm font-bold text-black/50 mt-1">Monitor Telerivet SMS delivery and verification status</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" size={16} />
            <input 
              type="text" 
              placeholder="Search phone number..." 
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
      <div className="admin-card p-6 rounded-2xl bg-white border border-black/5 shadow-sm">
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/5">
                <th className="pb-3 text-[10px] font-black text-black/40 uppercase tracking-wider">Time</th>
                <th className="pb-3 text-[10px] font-black text-black/40 uppercase tracking-wider">Phone Number</th>
                <th className="pb-3 text-[10px] font-black text-black/40 uppercase tracking-wider">OTP Code</th>
                <th className="pb-3 text-[10px] font-black text-black/40 uppercase tracking-wider">Attempts</th>
                <th className="pb-3 text-[10px] font-black text-black/40 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} className="border-b border-black/5 hover:bg-black/[0.02] transition-colors">
                  <td className="py-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-black/50">
                      <FiClock size={12} />
                      {log.time}
                    </div>
                  </td>
                  <td className="py-4">
                    <p className="text-sm font-black text-[#3d2b1f]">{log.phone}</p>
                  </td>
                  <td className="py-4">
                    <div className="inline-block px-2 py-1 rounded bg-black/5 font-mono text-xs font-bold text-[#3d2b1f] tracking-widest">
                      {log.code}
                    </div>
                  </td>
                  <td className="py-4">
                    <p className="text-xs font-bold text-[#3d2b1f]">{log.attempts} / 5</p>
                  </td>
                  <td className="py-4">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      log.status === 'verified' ? 'bg-emerald-500/10 text-emerald-600' :
                      log.status === 'sent' ? 'bg-blue-500/10 text-blue-600' :
                      log.status === 'expired' ? 'bg-amber-500/10 text-amber-600' :
                      'bg-rose-500/10 text-rose-600'
                    }`}>
                      {log.status === 'verified' ? <FiCheckCircle size={10} /> :
                       log.status === 'sent' ? <FiMessageSquare size={10} /> :
                       <FiXCircle size={10} />}
                      {log.status}
                    </div>
                  </td>
                </tr>
              ))}
              
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <p className="text-sm font-bold text-black/40">No OTP logs found matching your search.</p>
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
