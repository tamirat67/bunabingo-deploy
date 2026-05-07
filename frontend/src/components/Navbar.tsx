'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { Gamepad2, Trophy, History, Wallet, User } from 'lucide-react';

const navItems = [
  { label: 'Game',    href: '/',        icon: Gamepad2 },
  { label: 'Scores',  href: '/scores',  icon: Trophy   },
  { label: 'History', href: '/history', icon: History  },
  { label: 'Wallet',  href: '/wallet',  icon: Wallet   },
  { label: 'Profile', href: '/profile', icon: User     },
];

function NavContent() {
  const pathname = usePathname() ?? '';

  return (
    <div className="nav-container">
      {navItems.map(({ label, href, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link key={label} href={href} className={`nav-item ${isActive ? 'active' : ''}`}>
            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            <span>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export default function Navbar() {
  return (
    <nav className="bottom-navbar">
      <Suspense fallback={null}>
        <NavContent />
      </Suspense>
    </nav>
  );
}
