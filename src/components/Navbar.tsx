'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, History, Wallet, User } from 'lucide-react';

const navItems = [
  { label: 'Home',    href: '/',        icon: Home },
  { label: 'Games',   href: '/scores',  icon: Trophy   },
  { label: 'History', href: '/history', icon: History  },
  { label: 'Wallet',  href: '/wallet',  icon: Wallet   },
  { label: 'Profile', href: '/profile', icon: User     },
];

function NavContent() {
  const pathname = usePathname() ?? '';
  if (pathname === '/game') return null;

  return (
    <div className="nav-container">
      {navItems.map(({ label, href, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link key={label} href={href} className={`nav-item ${isActive ? 'active' : ''}`}>
            <div className="nav-item-inner">
              <Icon size={24} strokeWidth={isActive ? 2 : 1.5} />
              <span>{label}</span>
            </div>
            {isActive && <div className="nav-indicator-line" />}
          </Link>
        );
      })}
    </div>
  );
}

export default function Navbar() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <nav className="bottom-navbar">
      <Suspense fallback={null}>
        <NavContent />
      </Suspense>
    </nav>
  );
}
