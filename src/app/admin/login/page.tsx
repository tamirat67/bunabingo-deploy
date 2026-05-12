"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiLock, FiUser, FiAward, FiAlertCircle } from 'react-icons/fi';
import api from '@/lib/api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { username, password });
      const { token, user } = response.data;

      // Save token
      localStorage.setItem('admin_token', token);
      
      // Redirect based on role
      if (user.role === 'ADMIN' || user.isAdmin) {
        router.push('/admin');
      } else {
        router.push('/agent');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-gray-100">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-xl shadow-amber-500/20 mb-6">
            <FiAward className="text-white text-4xl" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter">BUNA BINGO</h1>
          <p className="text-gray-500 mt-2 font-medium">Management Portal Access</p>
        </div>

        {/* Login Form */}
        <div className="bg-[#161616] border border-white/5 rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start text-red-500 text-sm">
                <FiAlertCircle className="mt-0.5 mr-3 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Telegram ID / Username</label>
              <div className="relative group">
                <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-amber-500 transition-colors" />
                <input 
                  type="text"
                  required
                  placeholder="Enter your ID or @username"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-amber-500 transition-all text-sm"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Secure Password</label>
              <div className="relative group">
                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-amber-500 transition-colors" />
                <input 
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-amber-500 transition-all text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className={`
                w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-black py-4 rounded-2xl transition-all shadow-xl shadow-amber-500/10 active:scale-[0.98]
                flex items-center justify-center
              `}
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
              ) : (
                'ENTER DASHBOARD'
              )}
            </button>
          </form>
        </div>

        <div className="text-center mt-8">
           <p className="text-sm text-gray-600">
             Forgot your password? <br/> Contact the Super Admin via the bot.
           </p>
        </div>
      </div>
    </div>
  );
}
