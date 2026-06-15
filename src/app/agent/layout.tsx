"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  FiPieChart, FiUsers, FiDollarSign, 
  FiSettings, FiLogOut, FiMenu, FiX, FiAward, FiArrowLeft, FiActivity
} from 'react-icons/fi';
import api from '@/lib/api';
import '../admin.css';
import '../globals.css';
import '../agent.css';

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState<any>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    async function loadUser() {
      // Pre-check token for web users or Telegram Mini App
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const tgInitData = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp?.initData : null;
      
      if (!token && !tgInitData) {
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
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--cmd-gold)' }}></div>
  </div>;

  const navItems = [
    { name: 'Branch Stats', icon: FiPieChart, path: '/agent' },
    { name: 'My Players', icon: FiUsers, path: '/agent/players' },
    { name: 'Transactions', icon: FiActivity, path: '/agent/transactions' },
    { name: 'Commissions', icon: FiDollarSign, path: '/agent/commissions' },
    { name: 'Settings', icon: FiSettings, path: '/agent/settings' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('admin_token'); // Agent uses same token key in this app
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData) {
      (window as any).Telegram.WebApp.close();
    } else {
      router.push('/admin/login');
    }
  };

  return (
    <div className={`admin-layout admin-body ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar */}
      <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-header">
          <div className="sidebar-logo" style={{ background: 'linear-gradient(135deg, #d4af37, #b8962e)' }}>
            <FiAward style={{ color: '#000' }} />
          </div>
          {isSidebarOpen && (
            <span className="sidebar-title" style={{ letterSpacing: '2px', fontWeight: '900' }}>BUNA BINGO</span>
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
                style={{ borderRadius: '14px', margin: '4px 12px' }}
              >
                <item.icon style={{ fontSize: '20px', flexShrink: 0 }} />
                {isSidebarOpen && <span style={{ marginLeft: '12px', fontWeight: '700' }}>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="sidebar-footer">
          <div className="user-pill" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }}>
            <div className="user-avatar" style={{ background: 'var(--cmd-card)', color: 'var(--agent-accent)', fontWeight: '900' }}>
              {(user.firstName || 'U')[0]}
            </div>
            {isSidebarOpen && (
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: '900', color: '#1c1917', margin: 0 }}>{user.firstName}</p>
                <p style={{ fontSize: '10px', color: 'var(--admin-text-muted)', margin: 0, textTransform: 'uppercase', fontWeight: '800' }}>Agent</p>
              </div>
            )}
          </div>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            title="Logout"
            style={{
              marginTop: '10px',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isSidebarOpen ? 'flex-start' : 'center',
              gap: '10px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '12px',
              padding: '12px 14px',
              color: '#f87171',
              fontWeight: '900',
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.18)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
          >
            <FiLogOut size={16} />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {/* Header */}
        <header className="admin-header">
          <button 
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="sidebar-toggle-btn"
            title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
          >
            {isSidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
          
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '32px' }}>
             <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '10px', color: 'var(--admin-text-muted)', margin: 0, textTransform: 'uppercase', fontWeight: '900', letterSpacing: '1px' }}>Balance</p>
                <p style={{ fontSize: '20px', fontWeight: '900', color: 'var(--agent-accent)', margin: 0 }}>{Number(user.wallet?.commissionBalance || 0).toLocaleString()} <span style={{ fontSize: '12px' }}>ETB</span></p>
             </div>
             <div style={{ width: '1px', height: '40px', background: 'var(--cmd-border)' }}></div>
             <Link href="/" className="hover:text-gold transition-colors" style={{ color: '#1c1917', textDecoration: 'none', fontSize: '12px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                <FiArrowLeft size={18} /> BACK TO GAME
             </Link>
          </div>
        </header>

        <div className="admin-content custom-scrollbar">
          {children}
        </div>

        {/* Mobile Overlay */}
        {isSidebarOpen && (
          <div 
            className="mobile-overlay"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  );
}
