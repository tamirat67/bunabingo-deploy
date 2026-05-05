'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dices, Trophy, History, Wallet, UserCircle } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Game', href: '/', icon: <Dices size={26} strokeWidth={2} /> },
    { label: 'Scores', href: '/scores', icon: <Trophy size={26} strokeWidth={2} /> },
    { label: 'History', href: '/history', icon: <History size={26} strokeWidth={2} /> },
    { label: 'Wallet', href: '/wallet', icon: <Wallet size={26} strokeWidth={2} /> },
    { label: 'Profile', href: '/profile', icon: <UserCircle size={26} strokeWidth={2} /> },
  ];

  return (
    <nav className="bottom-nav">
      <div className="nav-inner">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.label} href={item.href} className={`nav-item ${isActive ? 'active' : ''}`}>
              <div className="icon-box">
                {item.icon}
                {isActive && <div className="active-indicator"></div>}
              </div>
            </Link>
          );
        })}
      </div>

      <style jsx>{`
        .bottom-nav {
          position: fixed; bottom: 0; left: 0; right: 0;
          height: 75px; background: var(--bg-nav); border-top: 1px solid var(--border-light);
          display: flex; justify-content: center; align-items: center;
          padding-bottom: env(safe-area-inset-bottom); z-index: 9999;
          box-shadow: 0 -10px 40px rgba(0,0,0,0.4);
          transition: background-color 0.3s;
        }
        .nav-inner {
          display: flex; width: 100%; max-width: 500px; justify-content: space-around; align-items: center;
        }
        .nav-item {
          display: flex; flex-direction: column; align-items: center;
          color: var(--text-main) !important; text-decoration: none;
          flex: 1; transition: all 0.3s ease;
          position: relative; opacity: 0.5;
        }
        .nav-item.active { 
          opacity: 1; 
          transform: translateY(-5px);
        }
        
        .icon-box {
          position: relative; display: flex; align-items: center; justify-content: center;
          width: 50px; height: 50px;
        }
        
        .active-indicator {
          position: absolute; bottom: -10px; width: 8px; height: 8px;
          background: var(--gold-accent); border-radius: 50%;
          box-shadow: 0 0 12px var(--gold-accent);
          animation: popIn 0.3s forwards;
        }
        
        @keyframes popIn {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }

        .nav-item:active { transform: scale(0.85); }
      `}</style>
    </nav>
  );
}
