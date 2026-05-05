'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Game', href: '/', icon: '🎮' },
    { label: 'Scores', href: '/history', icon: '🏆' },
    { label: 'History', href: '/history', icon: '⏳' },
    { label: 'Wallet', href: '/wallet', icon: '👛' },
    { label: 'Profile', href: '/profile', icon: '👤' },
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
          height: 70px; background: #2d1b4d; border-top: 1px solid rgba(255,255,255,0.1);
          display: flex; justify-content: space-around; align-items: center;
          padding-bottom: env(safe-area-inset-bottom); z-index: 100;
          box-shadow: 0 -10px 30px rgba(0,0,0,0.3);
        }
        .nav-item {
          display: flex; flex-direction: column; align-items: center;
          gap: 4px; color: rgba(255,255,255,0.4); text-decoration: none;
          flex: 1; transition: all 0.2s;
        }
        .nav-item.active { color: #facc15; transform: translateY(-2px); }
        .nav-icon { font-size: 24px; transition: transform 0.2s; }
        .nav-item.active .nav-icon { transform: scale(1.1); }
        .nav-label { font-size: 10px; font-weight: 800; text-transform: capitalize; }
      `}</style>
    </nav>
  );
}
