'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { Home, Trophy, History, Wallet, UserCircle } from 'lucide-react';

const navItems = [
  { label: 'Play',    href: '/',        icon: Home       },
  { label: 'Scores',  href: '/scores',  icon: Trophy     },
  { label: 'History', href: '/history', icon: History    },
  { label: 'Wallet',  href: '/wallet',  icon: Wallet     },
  { label: 'Profile', href: '/profile', icon: UserCircle },
];

// Inner component that safely uses usePathname() inside Suspense
function NavContent() {
  const pathname = usePathname() ?? '';

  return (
    <div className="nav-card">
      {navItems.map(({ label, href, icon: Icon }) => {
        const isActive =
          label === 'Play'
            ? pathname === '/' || pathname.startsWith('/game') || pathname.startsWith('/tickets')
            : pathname === href;
        return (
          <Link key={label} href={href} className={`nav-tab ${isActive ? 'active' : ''}`}>
            <div className={`icon-wrap ${isActive ? 'icon-active' : ''}`}>
              <Icon size={24} strokeWidth={isActive ? 2.2 : 1.8} />
            </div>
            {isActive && <span className="active-bar" />}
          </Link>
        );
      })}
    </div>
  );
}

export default function Navbar() {
  return (
    <nav className="bottom-nav">
      <Suspense fallback={
        <div className="nav-card">
          {navItems.map(({ label, icon: Icon }) => (
            <div key={label} className="nav-tab">
              <div className="icon-wrap"><Icon size={24} strokeWidth={1.8} /></div>
            </div>
          ))}
        </div>
      }>
        <NavContent />
      </Suspense>
    </nav>
  );
}
