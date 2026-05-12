"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  FiPieChart, FiUsers, FiDollarSign, 
  FiSettings, FiLogOut, FiMenu, FiX, FiAward, FiArrowLeft
} from 'react-icons/fi';
import api from '@/lib/api';

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState<any>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await api.get('/me');
        const userData = response.data;
        // Both Agents and Admins can see this, but it's the "Agent view"
        if (userData.role !== 'AGENT' && userData.role !== 'ADMIN' && !userData.isAdmin) {
          router.push('/admin/login');
          return;
        }
        setUser(userData);
      } catch (err) {
        router.push('/admin/login');
      }
    }
    loadUser();
  }, [pathname]);

  if (!user) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
  </div>;

  const navItems = [
    { name: 'Branch Stats', icon: FiPieChart, path: '/agent' },
    { name: 'My Players', icon: FiUsers, path: '/agent/players' },
    { name: 'Commissions', icon: FiDollarSign, path: '/agent/commissions' },
    { name: 'Settings', icon: FiSettings, path: '/agent/settings' },
  ];

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-gray-100 flex">
      {/* Sidebar */}
      <aside className={`
        ${isSidebarOpen ? 'w-64' : 'w-20'} 
        fixed lg:static inset-y-0 left-0 z-50
        transition-all duration-300 ease-in-out
        bg-[#161616] border-r border-white/5 flex flex-col
      `}>
        {/* Logo */}
        <div className="h-20 flex items-center px-6 border-b border-white/5 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex-shrink-0 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <FiAward className="text-white text-xl" />
          </div>
          {isSidebarOpen && (
            <span className="ml-3 font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 uppercase">
              Agent Portal
            </span>
          )}
        </div>

        {/* Nav Links */}
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.name}
                href={item.path}
                className={`
                  flex items-center px-4 py-3 rounded-xl transition-all duration-200 group
                  ${isActive 
                    ? 'bg-blue-500/10 text-blue-500 shadow-sm' 
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'}
                `}
              >
                <item.icon className={`text-xl flex-shrink-0 ${isActive ? 'text-blue-500' : 'group-hover:text-white'}`} />
                {isSidebarOpen && <span className="ml-4 font-medium">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-white/5 bg-black/20">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border border-white/10 flex items-center justify-center text-blue-500 font-bold uppercase">
              {user.firstName[0]}
            </div>
            {isSidebarOpen && (
              <div className="ml-3 overflow-hidden">
                <p className="text-sm font-semibold truncate">{user.firstName}</p>
                <p className="text-xs text-gray-500 truncate">Agent Mode</p>
              </div>
            )}
            {isSidebarOpen && (
              <button 
                onClick={() => router.push('/')}
                className="ml-auto p-2 text-gray-500 hover:text-red-400 transition-colors"
              >
                <FiLogOut />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-[#161616]/50 backdrop-blur-md border-b border-white/5 flex items-center px-8 sticky top-0 z-30">
          <button 
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
          >
            {isSidebarOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
          
          <div className="ml-auto flex items-center space-y-0 space-x-4">
             <div className="text-right hidden sm:block">
                <p className="text-xs text-gray-500">Commission Earned</p>
                <p className="text-sm font-bold text-blue-500">{user.wallet.commissionBalance} ETB</p>
             </div>
             <div className="h-8 w-px bg-white/5 mx-2"></div>
             <Link href="/" className="flex items-center text-xs text-gray-400 hover:text-white transition-colors">
                <FiArrowLeft className="mr-1" /> Back to Game
             </Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {children}
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #444;
        }
      `}</style>
    </div>
  );
}
