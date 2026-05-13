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
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your agent profile and preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Sidebar Nav */}
        <div className="space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold transition-all shadow-lg shadow-blue-600/20">
            <FiUser /> Profile Info
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all font-bold">
            <FiLock /> Security
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all font-bold">
            <FiBell /> Notifications
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all font-bold">
            <FiShield /> API Keys
          </button>
          <div className="pt-4 border-t border-white/5">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-500/10 transition-all font-bold"
            >
              <FiLogOut /> Log Out
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-[#161616] border border-white/5 rounded-2xl p-8">
            <h3 className="font-bold text-lg mb-6">Profile Information</h3>
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Username</label>
                  <div className="bg-black/40 border border-white/10 px-4 py-3 rounded-xl text-gray-400 select-none">
                    @{user?.username}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Role</label>
                  <div className="bg-black/40 border border-white/10 px-4 py-3 rounded-xl text-blue-500 font-bold uppercase tracking-widest">
                    {user?.role}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">First Name</label>
                <input 
                  type="text" 
                  defaultValue={user?.firstName} 
                  className="w-full bg-white/5 border border-white/10 px-4 py-3 rounded-xl text-white outline-none focus:border-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Telegram ID</label>
                <div className="bg-black/40 border border-white/10 px-4 py-3 rounded-xl text-gray-400 select-none font-mono">
                  {user?.telegramId?.toString()}
                </div>
              </div>

              <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20">
                Save Changes
              </button>
            </div>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6 flex items-start gap-4">
             <div className="p-2 bg-amber-500/20 rounded-lg text-amber-500">
                <FiShield size={20} />
             </div>
             <div>
                <h4 className="font-bold text-amber-500 text-sm">Agent Verification</h4>
                <p className="text-xs text-amber-500/70 mt-1">Your account is fully verified. You have access to all referral and withdrawal processing features.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
