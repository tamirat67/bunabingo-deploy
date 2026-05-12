"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  FiPieChart, FiUsers, FiUserCheck, FiDollarSign, 
  FiSettings, FiLogOut, FiMenu, FiX, FiAward 
} from 'react-icons/fi';
import api from '@/lib/api';
import '@/app/admin.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState<any>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    async function loadUser() {
      // Don't check auth if we are already on the login page
      if (pathname === '/admin/login') {
        setUser({ firstName: 'Guest', role: 'GUEST' }); // Temporary guest state
        return;
      }

      try {
        const response = await api.get('/me');
        const userData = response.data;
        if (userData.role !== 'ADMIN' && userData.role !== 'AGENT' && !userData.isAdmin) {
          router.push('/admin/login'); // Redirect unauthorized users
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
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
  </div>;

  const isAdmin = user.role === 'ADMIN' || user.isAdmin;

  // ─── LOGIN PAGE VIEW ──────────────────────────────────────
  // If we are on the login page, don't show sidebars or headers
  if (pathname === '/admin/login') {
    return <div className="admin-body">{children}</div>;
  }

  const navItems = [
    { name: 'Dashboard', icon: FiPieChart, path: '/admin' },
    ...(isAdmin ? [
      { name: 'All Agents', icon: FiUserCheck, path: '/admin/agents' },
      { name: 'All Users', icon: FiUsers, path: '/admin/users' },
    ] : [
      { name: 'My Players', icon: FiUsers, path: '/admin/players' },
    ]),
    { name: 'Transactions', icon: FiDollarSign, path: '/admin/transactions' },
    { name: 'Settings', icon: FiSettings, path: '/admin/settings' },
  ];

  return (
    <div className="admin-layout admin-body">
      {/* Sidebar */}
      <aside className="admin-sidebar" style={{ width: isSidebarOpen ? '260px' : '80px' }}>
        {/* Logo */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <FiAward />
          </div>
          {isSidebarOpen && (
            <span className="sidebar-title">
              {isAdmin ? 'ADMIN' : 'AGENT'} PORTAL
            </span>
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
                className={`nav-link ${isActive ? 'active' : ''}`}
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
            <div className="user-avatar">
              {user.firstName[0]}
            </div>
            {isSidebarOpen && (
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <p style={{ fontSize: '14px', fontWeight: '700', margin: 0 }}>{user.firstName}</p>
                <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: 0 }}>{user.role}</p>
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
                <p style={{ fontSize: '11px', color: 'var(--admin-text-muted)', margin: 0, textTransform: 'uppercase', fontWeight: '800' }}>Balance</p>
                <p style={{ fontSize: '18px', fontWeight: '900', color: 'var(--admin-accent)', margin: 0 }}>{Number(user.wallet?.balance || 0).toLocaleString()} ETB</p>
             </div>
          </div>
        </header>

        <div className="admin-content custom-scrollbar">
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
      `}</style>
    </div>
  );
}
