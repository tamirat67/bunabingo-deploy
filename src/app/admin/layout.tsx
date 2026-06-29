"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  FiPieChart, FiUsers, FiUserCheck, FiDollarSign, 
  FiSettings, FiLogOut, FiMenu, FiX, FiAward,
  FiActivity, FiShield, FiCreditCard, FiCalendar, FiChevronDown, FiChevronRight, FiTrendingUp, FiGrid, FiFileText
} from 'react-icons/fi';
import api from '@/lib/api';
import '@/app/admin.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [expanded, setExpanded] = useState({ 
    network: pathname.startsWith('/admin/users') || pathname.startsWith('/admin/agents') || pathname.startsWith('/admin/players'), 
    finance: pathname.startsWith('/admin/transactions') || pathname.startsWith('/admin/revenue') || pathname.startsWith('/admin/company-profit'), 
    system: pathname.startsWith('/admin/audit') || pathname.startsWith('/admin/logs') || pathname.startsWith('/admin/settings') 
  });
  const [user, setUser] = useState<any>(null);
  // Ref to track if we've already successfully loaded the user.
  // useRef never causes stale closures — it's always up-to-date.
  const userLoadedRef = useRef(false);

  const [selectedDate, setSelectedDate] = useState(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const dateParam = searchParams.get('date');
      if (dateParam) return dateParam;
    }
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    const params = new URLSearchParams(window.location.search);
    params.set('date', newDate);
    router.push(`${pathname}?${params.toString()}`);
  };

  const getFormattedDateLabel = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      const date = new Date(Number(year), Number(month) - 1, Number(day));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  useEffect(() => {
    // Mobile optimization: Close sidebar by default on small screens
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    userLoadedRef.current = false;
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData) {
      (window as any).Telegram.WebApp.close();
    } else {
      router.push('/admin/login');
    }
  };

  // ── Auth check runs ONCE on mount, never on pathname changes ──────────────
  // This prevents the stale-closure redirect bug when clicking sidebar links.
  useEffect(() => {
    // If the user is already loaded, do nothing at all — no redirect, no API call.
    if (userLoadedRef.current) return;

    // Login page: set a guest stub so the layout renders children (the login form)
    if (pathname === '/admin/login') {
      userLoadedRef.current = true;
      setUser({ firstName: 'Guest', role: 'GUEST' });
      return;
    }

    async function loadUser() {
      const token = localStorage.getItem('admin_token');
      const tgInitData = (window as any).Telegram?.WebApp?.initData || null;

      if (!token && !tgInitData) {
        router.push('/admin/login');
        return;
      }

      try {
        const response = await api.get('/me');
        const userData = response.data;
        if (userData.role !== 'ADMIN' && userData.role !== 'AGENT' && userData.role !== 'STAFF' && !userData.isAdmin) {
          localStorage.removeItem('admin_token');
          router.push('/admin/login');
          return;
        }
        userLoadedRef.current = true;
        setUser(userData);
      } catch (err: any) {
        // Only clear the session on explicit auth rejection (401 / 403).
        // Network errors, timeouts and 5xx must NOT log the user out.
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem('admin_token');
          userLoadedRef.current = false;
          router.push('/admin/login');
        }
        // For any other error, keep showing the spinner; user stays logged in.
      }
    }
    loadUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // <-- Empty array: runs ONLY once on mount, never on navigation

  // Show spinner until user is loaded
  if (!user) return <div className="login-container">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--cmd-gold)' }}></div>
  </div>;

  const isAdmin = user.role === 'ADMIN' || user.isAdmin;
  const isStaff = user.role === 'STAFF';

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
    <div className={`admin-layout admin-body ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`}>
      <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <FiAward />
          </div>
          <span className="sidebar-title">BUNA ADMIN</span>
        </div>

        <nav className="sidebar-nav">
          {isStaff ? (
            // Staff-only nav
            <>
              {isSidebarOpen ? <div style={{ fontSize: '10px', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '12px', marginBottom: '8px', paddingLeft: '14px' }}>Main</div> : <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '12px 14px 8px 14px' }} />}
              <NavLink href="/admin/staff-dashboard" icon={<FiGrid />} label="My Dashboard" />
              {isSidebarOpen ? <div style={{ fontSize: '10px', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '16px', marginBottom: '8px', paddingLeft: '14px' }}>Network</div> : <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '16px 14px 8px 14px' }} />}
              <NavLink href="/admin/agents" icon={<FiShield />} label="Assigned Agents" />
              {isSidebarOpen ? <div style={{ fontSize: '10px', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '16px', marginBottom: '8px', paddingLeft: '14px' }}>Finance</div> : <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '16px 14px 8px 14px' }} />}
              <NavLink href="/admin/transactions" icon={<FiCreditCard />} label="Transactions" />
            </>
          ) : (
            // Admin / Agent nav
            <>
              {isSidebarOpen ? <div style={{ fontSize: '10px', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px', marginBottom: '8px', paddingLeft: '14px' }}>Main</div> : <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 14px 8px 14px' }} />}
              <NavLink href="/admin" icon={<FiActivity />} label="Overview" />
              
              {isSidebarOpen ? (
                <button 
                  onClick={() => setExpanded(p => ({...p, network: !p.network}))}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '16px', marginBottom: '8px', paddingLeft: '14px', paddingRight: '14px' }}
                >
                  <span>Network</span>
                  {expanded.network ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                </button>
              ) : <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '16px 14px 8px 14px' }} />}
              
              {(expanded.network || !isSidebarOpen) && (
                <>
                  <NavLink href="/admin/users" icon={<FiUsers />} label={isAdmin ? "All Players" : "My Players"} />
                  <NavLink href="/admin/agents" icon={<FiShield />} label="All Agents" />
                </>
              )}
              
              {isSidebarOpen ? (
                <button 
                  onClick={() => setExpanded(p => ({...p, finance: !p.finance}))}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '16px', marginBottom: '8px', paddingLeft: '14px', paddingRight: '14px' }}
                >
                  <span>Finance & Analytics</span>
                  {expanded.finance ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                </button>
              ) : <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '16px 14px 8px 14px' }} />}
              
              {(expanded.finance || !isSidebarOpen) && (
                <>
                  <NavLink href="/admin/transactions" icon={<FiCreditCard />} label="Transactions" />
                  <NavLink href="/admin/revenue" icon={<FiTrendingUp />} label="Platform Revenue" />
                  {isAdmin && <NavLink href="/admin/company-profit" icon={<FiDollarSign />} label="Agent Profit & Debt" />}
                  {isAdmin && <NavLink href="/admin/aviator-finance" icon={<FiActivity />} label="Aviator Finance" />}
                </>
              )}
              
              {isAdmin && (
                <>
                  {isSidebarOpen ? (
                    <button 
                      onClick={() => setExpanded(p => ({...p, system: !p.system}))}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '16px', marginBottom: '8px', paddingLeft: '14px', paddingRight: '14px' }}
                    >
                      <span>System Administration</span>
                      {expanded.system ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                    </button>
                  ) : <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '16px 14px 8px 14px' }} />}
                  
                  {(expanded.system || !isSidebarOpen) && (
                    <>
                      <NavLink href="/admin/audit" icon={<FiPieChart />} label="Financial Audit" />
                      <NavLink href="/admin/logs" icon={<FiFileText />} label="System Logs" />
                      <NavLink href="/admin/settings" icon={<FiSettings />} label="Settings" />
                    </>
                  )}
                </>
              )}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-pill" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }}>
            <div className="user-avatar" style={{ background: 'var(--cmd-tan)', color: 'var(--cmd-coffee)', fontWeight: '800' }}>
              {(user.firstName || 'U')[0]}
            </div>
            {isSidebarOpen && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '800', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'white' }}>{user.firstName}</div>
                <div style={{ fontSize: '10px', opacity: 0.6, textTransform: 'uppercase', color: 'var(--cmd-tan)' }}>{user.role}</div>
              </div>
            )}
          </div>
          
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
              transition: 'all 0.2s',
            }}
          >
            <FiLogOut size={16} />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="sidebar-toggle-btn"
              title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
            >
              {isSidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
            </button>
            
            {pathname === '/admin' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  onClick={() => router.push('/admin')}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    border: '1px solid rgba(0,0,0,0.08)',
                    background: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#3d2b1f',
                  }}
                  title="Close overview"
                >
                  <FiX size={16} />
                </button>
                <span style={{ fontSize: '14px', fontWeight: '900', letterSpacing: '1px', color: '#3d2b1f' }}>
                  OVERVIEW
                </span>
              </div>
            ) : (
              <h2 style={{ fontSize: '14px', fontWeight: '800', color: '#3d2b1f', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                {pathname.split('/').pop()?.replace('-', ' ')}
              </h2>
            )}
          </div>

          {pathname === '/admin' && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(0,0,0,0.08)',
                background: '#ffffff',
                cursor: 'pointer',
                fontWeight: '700',
                color: '#3d2b1f',
                fontSize: '13px'
              }}>
                <FiCalendar size={16} />
                <span>{getFormattedDateLabel(selectedDate)}</span>
                <FiChevronDown size={14} />
              </button>
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer'
                }}
              />
            </div>
          )}

          <div style={{ display: 'none', alignItems: 'center', gap: '20px' }}>
            <div style={{ textAlign: 'right' }}>
               <div style={{ fontSize: '10px', fontWeight: '800', color: '#d4af37' }}>PLATFORM BALANCE</div>
               <div style={{ fontSize: '16px', fontWeight: '900', color: '#3d2b1f' }}>{Number(user.wallet?.balance || 0).toLocaleString()} <span style={{ fontSize: '10px' }}>ETB</span></div>
            </div>
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
