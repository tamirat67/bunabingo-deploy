'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, History, Wallet, User } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const navItems = [
  { label: 'Home',    href: '/',        icon: Home },
  { label: 'Games',   href: '/scores',  icon: Trophy   },
  { label: 'History', href: '/history', icon: History  },
  { label: 'Wallet',  href: '/wallet',  icon: Wallet   },
  { label: 'Profile', href: '/profile', icon: User     },
];

function NavContent() {
  const pathname = usePathname() ?? '';
  const { T } = useTheme();

  return (
    <div className="nav-container">
      {navItems.map(({ label, href, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link key={label} href={href} className={`nav-item ${isActive ? 'active' : ''}`} style={{ color: isActive ? T.gold : T.text }}>
            <div className="nav-item-inner" style={{ backgroundColor: isActive ? `${T.gold}22` : 'transparent' }}>
              <Icon size={24} strokeWidth={isActive ? 2 : 1.5} />
              <span>{label}</span>
            </div>
            {isActive && <div className="nav-indicator-line" style={{ backgroundColor: T.gold }} />}
          </Link>
        );
      })}
    </div>
  );
}

export default function Navbar() {
  const { T } = useTheme();
  const pathname = usePathname();

  // Hide navbar on management and full-screen game pages
  if (
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/agent') ||
    pathname?.startsWith('/keno') ||
    pathname?.startsWith('/play')
  ) {
    return null;
  }

  return (
    <nav className="bottom-navbar" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
      <Suspense fallback={null}>
        <NavContent />
      </Suspense>
    </nav>
  );
}
