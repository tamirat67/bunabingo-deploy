'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Gamepad2, Trophy, History, Wallet, User } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Game', href: '/', icon: <Gamepad2 size={24} /> },
    { label: 'Scores', href: '/history', icon: <Trophy size={24} /> },
    { label: 'History', href: '/history', icon: <History size={24} /> },
    { label: 'Wallet', href: '/wallet', icon: <Wallet size={24} /> },
    { label: 'Profile', href: '/profile', icon: <User size={24} /> },
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link key={item.label} href={item.href} className={`nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        );
      })}

      <style jsx>{`
        .bottom-nav {
          position: fixed; bottom: 0; left: 0; right: 0;
          height: 75px; background: #6b21a8; border-top: 1px solid rgba(255, 255, 255, 0.1);
          display: flex; justify-content: space-around; align-items: center;
          padding-bottom: env(safe-area-inset-bottom); z-index: 100;
          box-shadow: 0 -10px 40px rgba(0,0,0,0.4);
        }
        .nav-item {
          display: flex; flex-direction: column; align-items: center;
          gap: 6px; color: rgba(255, 255, 255, 0.4); text-decoration: none;
          flex: 1; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .nav-item.active { color: #facc15; transform: translateY(-4px); }
        .nav-icon { transition: transform 0.3s; }
        .nav-item.active .nav-icon { transform: scale(1.15); filter: drop-shadow(0 0 12px rgba(250, 204, 21, 0.6)); }
        .nav-label { font-size: 11px; font-weight: 800; text-transform: capitalize; letter-spacing: 0.3px; }
      `}</style>
    </nav>
  );
}
