"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  FiPieChart, FiUsers, FiDollarSign, 
  FiSettings, FiLogOut, FiMenu, FiX, FiAward, FiArrowLeft
} from 'react-icons/fi';
import api from '@/lib/api';
import '@/app/admin.css';

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState<any>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    async function loadUser() {
      // Pre-check token for web users
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      if (!token) {
        router.push('/admin/login');
        return;
      }

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

  if (!user) return <div className="login-container">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </div>;

  const navItems = [
    { name: 'Branch Stats', icon: FiPieChart, path: '/agent' },
    { name: 'My Players', icon: FiUsers, path: '/agent/players' },
    { name: 'Commissions', icon: FiDollarSign, path: '/agent/commissions' },
    { name: 'Settings', icon: FiSettings, path: '/agent/settings' },
  ];

  return (
    <div className="admin-layout admin-body">
      {/* Sidebar */}
      <aside className="admin-sidebar" style={{ width: isSidebarOpen ? '260px' : '80px' }}>
        {/* Logo */}
        <div className="sidebar-header">
          <div className="sidebar-logo" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
            <FiAward />
          </div>
          {isSidebarOpen && (
            <span className="sidebar-title">AGENT PORTAL</span>
          )}
        </div>

        {/* Nav Links */}
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.name}
                href={item.path}
                className={`nav-link agent-link ${isActive ? 'active' : ''}`}
              >
                <item.icon style={{ fontSize: '20px', flexShrink: 0 }} />
                {isSidebarOpen && <span style={{ marginLeft: '12px' }}>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="sidebar-footer">
          <div className="user-pill">
            <div className="user-avatar" style={{ color: 'var(--agent-accent)' }}>
              {(user.firstName || 'U')[0]}
            </div>
            {isSidebarOpen && (
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <p style={{ fontSize: '14px', fontWeight: '700', margin: 0 }}>{user.firstName}</p>
                <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: 0 }}>Agent Mode</p>
              </div>
            )}
            {isSidebarOpen && (
              <button 
                onClick={() => router.push('/')}
                style={{ background: 'none', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer' }}
              >
                <FiLogOut />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {/* Header */}
        <header className="admin-header">
          <button 
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            style={{ background: 'none', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer', padding: '8px' }}
          >
            {isSidebarOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
          
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '24px' }}>
             <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '11px', color: 'var(--admin-text-muted)', margin: 0, textTransform: 'uppercase', fontWeight: '800' }}>Commission</p>
                <p style={{ fontSize: '18px', fontWeight: '900', color: 'var(--agent-accent)', margin: 0 }}>{Number(user.wallet?.commissionBalance || 0).toLocaleString()} ETB</p>
             </div>
             <div style={{ width: '1px', height: '32px', background: 'var(--admin-border)' }}></div>
             <Link href="/" style={{ color: 'var(--admin-text-muted)', textDecoration: 'none', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiArrowLeft /> Back to Game
             </Link>
          </div>
        </header>

        <div className="admin-content custom-scrollbar">
          {children}
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  );
}
