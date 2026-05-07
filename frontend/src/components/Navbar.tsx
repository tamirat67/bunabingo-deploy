'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, History, Wallet, UserCircle } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Play',    href: '/',        icon: Home,       active: pathname === '/' || pathname.startsWith('/game') || pathname.startsWith('/tickets') },
    { label: 'Scores',  href: '/scores',  icon: Trophy,     active: pathname === '/scores' },
    { label: 'History', href: '/history', icon: History,    active: pathname === '/history' },
    { label: 'Wallet',  href: '/wallet',  icon: Wallet,     active: pathname === '/wallet' },
    { label: 'Profile', href: '/profile', icon: UserCircle, active: pathname === '/profile' },
  ];

  return (
    <nav className="bottom-nav">
      <div className="nav-card">
        {navItems.map(({ label, href, icon: Icon, active }) => {
          const isActive = active;
          return (
            <Link key={label} href={href} className={`nav-tab ${isActive ? 'active' : ''}`}>
              <div className={`icon-wrap ${isActive ? 'icon-active' : ''}`}>
                <Icon
                  size={24}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
              </div>

              {isActive && <span className="active-bar" />}
            </Link>
          );
        })}
      </div>

      <style jsx>{`
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 9999;
          /* Warm cream background matching the design */
          background: #F5ECD7;
          padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
          display: flex;
          justify-content: center;
        }

        /* Floating white card */
        .nav-card {
          width: 100%;
          max-width: 480px;
          background: #FFFFFF;
          border-radius: 24px;
          display: flex;
          justify-content: space-around;
          align-items: center;
          padding: 8px 4px;
          box-shadow: 0 4px 24px rgba(139, 90, 20, 0.12);
        }

        /* Each tab */
        .nav-tab {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          flex: 1;
          text-decoration: none;
          position: relative;
          padding: 6px 2px 8px;
          transition: transform 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .nav-tab:active {
          transform: scale(0.92);
        }

        /* Icon wrapper — golden square when active */
        .icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #5C3D1E;
          transition: background 0.2s ease, color 0.2s ease;
        }

        .icon-active {
          background: #FFF0D0;
          color: #C98A1A;
        }



        /* Golden underline indicator */
        .active-bar {
          position: absolute;
          bottom: 2px;
          width: 20px;
          height: 3px;
          background: #C98A1A;
          border-radius: 99px;
          animation: growIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        @keyframes growIn {
          from { transform: scaleX(0); opacity: 0; }
          to   { transform: scaleX(1); opacity: 1; }
        }
      `}</style>
    </nav>
  );
}
