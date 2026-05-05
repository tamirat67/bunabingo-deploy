'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dices, Trophy, History, Wallet, UserCircle } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Game', href: '/', icon: <Dices size={28} strokeWidth={2.5} /> },
    { label: 'Scores', href: '/history', icon: <Trophy size={28} strokeWidth={2.5} /> },
    { label: 'History', href: '/mytickets', icon: <History size={28} strokeWidth={2.5} /> },
    { label: 'Wallet', href: '/wallet', icon: <Wallet size={28} strokeWidth={2.5} /> },
    { label: 'Profile', href: '/profile', icon: <UserCircle size={28} strokeWidth={2.5} /> },
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
          height: 70px; background: #6F4E37; border-top: 1px solid rgba(255, 255, 255, 0.05);
          display: flex; justify-content: center; align-items: center;
          padding-bottom: env(safe-area-inset-bottom); z-index: 1000;
          box-shadow: 0 -10px 40px rgba(0,0,0,0.35);
        }
        .nav-inner {
          display: flex; width: 100%; max-width: 500px; justify-content: space-around; align-items: center;
        }
        .nav-item {
          display: flex; flex-direction: column; align-items: center;
          color: rgba(0, 0, 0, 0.5); text-decoration: none;
          flex: 1; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          position: relative;
        }
        .icon-box {
          position: relative; display: flex; align-items: center; justify-content: center;
          width: 50px; height: 50px;
        }
        .nav-item.active { color: #facc15; transform: translateY(-8px); }
        .nav-item.active .icon-box {
           filter: drop-shadow(0 0 15px rgba(250, 204, 21, 0.5));
        }
        
        .active-indicator {
          position: absolute; bottom: -8px; width: 6px; height: 6px;
          background: #facc15; border-radius: 50%;
          animation: popIn 0.3s forwards;
        }
        
        @keyframes popIn {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .nav-item:active { transform: scale(0.9); }
      `}</style>
    </nav>
  );
}
