"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  FiPieChart, FiUsers, FiUserCheck, FiDollarSign, 
  FiSettings, FiLogOut, FiMenu, FiX, FiAward,
  FiActivity, FiShield, FiCreditCard
} from 'react-icons/fi';
import api from '@/lib/api';
import '@/app/admin.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState<any>(null);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    router.push('/admin/login');
  };

  useEffect(() => {
    async function loadUser() {
      // Don't check auth if we are already on the login page
      if (pathname === '/admin/login') {
        setUser({ firstName: 'Guest', role: 'GUEST' }); // Temporary guest state
        return;
      }

      // Pre-check token for web users
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      if (!token) {
        router.push('/admin/login');
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
  ];

  return (
    <div className="admin-layout admin-body">
      <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <FiAward />
          </div>
          <span className="sidebar-title">BUNA ADMIN</span>
          <div className="sidebar-toggle" style={{ marginLeft: 'auto' }} onClick={() => setSidebarOpen(false)}>
            <FiX />
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink href="/admin" icon={<FiActivity />} label="Dashboard" />
          <NavLink href="/admin/users" icon={<FiUsers />} label="All Users" />
          <NavLink href="/admin/agents" icon={<FiShield />} label="All Agents" />
          <NavLink href="/admin/transactions" icon={<FiCreditCard />} label="Transactions" />
          <NavLink href="/admin/settings" icon={<FiSettings />} label="Settings" />
        </nav>

        <div className="sidebar-footer">
          <div className="user-pill">
            <div className="user-avatar">{(user.firstName || 'U')[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '800', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.firstName}</div>
              <div style={{ fontSize: '10px', opacity: 0.6 }}>{user.role}</div>
            </div>
            <FiLogOut style={{ cursor: 'pointer', color: '#ef4444' }} onClick={handleLogout} />
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div className="sidebar-toggle" onClick={() => setSidebarOpen(true)}>
            <FiMenu />
          </div>
          
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '14px', fontWeight: '800', color: '#3d2b1f', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {pathname === '/admin' ? 'Overview' : pathname.split('/').pop()?.replace('-', ' ')}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ textAlign: 'right', display: 'none' }}>
               <div style={{ fontSize: '10px', fontWeight: '800', color: '#d4af37' }}>PLATFORM BALANCE</div>
               <div style={{ fontSize: '16px', fontWeight: '900', color: '#3d2b1f' }}>{Number(user.wallet?.balance || 0).toLocaleString()} <span style={{ fontSize: '10px' }}>ETB</span></div>
            </div>
          </div>
        </header>

        <div className="admin-content custom-scrollbar">
          {children}
        </div>
      </main>

      <style>{`
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

function NavLink({ href, icon, label }: { href: string, icon: React.ReactNode, label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;
  
  return (
    <Link href={href} className={`nav-link ${isActive ? 'active' : ''}`}>
      {icon}
      <span>{label}</span>
    </Link>
  );
}
