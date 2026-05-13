"use client";

import React, { useEffect, useState } from 'react';
import { FiSettings, FiUser, FiLock, FiBell, FiShield, FiLogOut } from 'react-icons/fi';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await api.get('/me');
        setUser(response.data);
      } catch (err) {
        console.error('Failed to fetch user:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    router.push('/admin/login');
  };

  if (loading) return <div className="p-8 animate-pulse space-y-4">
    <div className="h-10 bg-white/5 w-1/4 rounded-lg"></div>
    <div className="h-64 bg-white/5 rounded-2xl"></div>
    <div className="h-32 bg-white/5 rounded-2xl"></div>
  </div>;

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight uppercase">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your agent profile and account security.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left: Profile Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-coffee border border-white/5 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
            <div className="relative z-10">
              <div className="w-24 h-24 bg-gold/10 rounded-full mx-auto flex items-center justify-center text-3xl font-black text-gold border-2 border-gold/20 mb-6">
                {(user.firstName || 'U')[0]}
              </div>
              <h2 className="text-xl font-bold text-white">{user.firstName} {user.lastName}</h2>
              <p className="text-gold text-xs font-black tracking-widest mt-1 uppercase">Official Agent</p>
              
              <div className="mt-8 pt-8 border-t border-white/5 flex flex-col gap-3">
                 <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 font-bold">Role</span>
                    <span className="text-white font-black">{user.role}</span>
                 </div>
                 <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 font-bold">Status</span>
                    <span className="text-green-500 font-black">ACTIVE</span>
                 </div>
              </div>
            </div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gold" />
          </div>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-black py-4 rounded-2xl transition-all border border-red-500/20"
          >
            <FiLogOut /> LOGOUT SESSION
          </button>
        </div>

        {/* Right: Detailed Settings */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-coffee border border-white/5 rounded-3xl p-8 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-8 flex items-center gap-3">
              <FiUser className="text-gold" /> PERSONAL INFORMATION
            </h3>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">First Name</label>
                  <div className="bg-black/40 border border-white/10 p-4 rounded-xl text-white font-bold">{user.firstName}</div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Last Name</label>
                  <div className="bg-black/40 border border-white/10 p-4 rounded-xl text-white font-bold">{user.lastName}</div>
                </div>
              </div>
              
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Phone Number</label>
                <div className="bg-black/40 border border-white/10 p-4 rounded-xl text-white font-bold flex items-center justify-between">
                  {user.phoneNumber}
                  <span className="text-[10px] bg-green-500/20 text-green-500 px-2 py-0.5 rounded font-black">VERIFIED</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gold/5 border border-gold/10 rounded-2xl p-6 flex items-start gap-4">
             <div className="p-2 bg-gold/20 rounded-lg text-gold">
                <FiShield size={20} />
             </div>
             <div>
                <h4 className="font-bold text-gold text-sm uppercase tracking-widest">Agent Verification</h4>
                <p className="text-xs text-gray-400 mt-1">Your account is fully verified. You have access to all referral and withdrawal processing features.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
