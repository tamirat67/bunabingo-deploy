'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Game', href: '/tickets', icon: '🎮' },
    { label: 'Scores', href: '/history', icon: '🏆' },
    { label: 'History', href: '/history', icon: '🕒' },
    { label: 'Wallet', href: '/', icon: '👛' },
    { label: 'Profile', href: '/withdraw', icon: '👤' },
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
          height: 65px; background: #1a1a2e; border-top: 1px solid rgba(255,255,255,0.1);
          display: flex; justify-content: space-around; align-items: center;
          padding-bottom: env(safe-area-inset-bottom); z-index: 100;
        }
        .nav-item {
          display: flex; flex-direction: column; align-items: center;
          gap: 4px; color: rgba(255,255,255,0.5); text-decoration: none;
          flex: 1; transition: all 0.2s;
        }
        .nav-item.active { color: #facc15; }
        .nav-icon { font-size: 22px; }
        .nav-label { font-size: 10px; font-weight: 700; text-transform: uppercase; }
      `}</style>
    </nav>
  );
}
