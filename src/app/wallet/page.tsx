'use client';
import React, { useEffect, useState } from 'react';
import { getMe, getWallet } from '../../lib/api';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../context/ThemeContext';
import { 
  RefreshCw, 
  User as UserIcon, 
  CheckCircle, 
  Wallet as WalletIcon, 
  Coins, 
  Download,
  Play,
  Trophy,
  History,
  ChevronDown,
  MoreVertical,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function WalletPage() {
  const router = useRouter();
  const { T } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState('balance');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    getMe().then(setUser).catch(() => { });
  }, []);

  if (!mounted) return null;

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: '100px', fontFamily: "'Outfit', sans-serif", color: T.text, transition: 'all 0.3s ease' }}>
      
      {/* ── Header ── */}
      <div style={{ background: T.header, padding: '12px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${T.gold}` }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', background: T.gold, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <WalletIcon size={18} color={T.header} />
            </div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: T.gold, letterSpacing: '0.5px' }}>MY WALLET</div>
         </div>
         <RefreshCw size={20} color={T.gold} onClick={() => window.location.reload()} style={{ cursor: 'pointer' }} />
      </div>

      <div style={{ padding: '20px 15px' }}>
        
        {/* ── Verified User Card ── */}
        <div style={{ background: T.card, padding: '15px', borderRadius: '16px', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', background: 'rgba(0,0,0,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <UserIcon size={20} opacity={0.5} />
              </div>
              <div>
                 <div style={{ fontSize: '14px', fontWeight: '900' }}>{user?.phoneNumber || '0900000000'}</div>
                 <div style={{ fontSize: '11px', opacity: 0.5 }}>Account Holder</div>
              </div>
           </div>
           <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(76,175,80,0.1)', color: '#4CAF50', padding: '4px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '900' }}>
              <CheckCircle size={12} /> VERIFIED
           </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
           <div 
              onClick={() => setTab('balance')}
              style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', background: tab === 'balance' ? T.gold : 'transparent', color: tab === 'balance' ? T.header : T.text, fontWeight: '900', fontSize: '13px', cursor: 'pointer', border: tab === 'balance' ? 'none' : `1px solid ${T.border}` }}
           >
              Main Balance
           </div>
           <div 
              onClick={() => setTab('history')}
              style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', background: tab === 'history' ? T.gold : 'transparent', color: tab === 'history' ? T.header : T.text, fontWeight: '900', fontSize: '13px', cursor: 'pointer', border: tab === 'history' ? 'none' : `1px solid ${T.border}` }}
           >
              Transaction History
           </div>
        </div>

        {tab === 'balance' ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {/* ── Main Balance Card ── */}
            <div style={{ background: T.header, color: 'white', padding: '25px', borderRadius: '24px', border: `2px solid ${T.gold}`, position: 'relative', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
               <div style={{ fontSize: '12px', fontWeight: '900', opacity: 0.6, marginBottom: '5px' }}>AVAILABLE BALANCE</div>
               <div style={{ fontSize: '42px', fontWeight: '900', color: T.gold }}>{Number(user?.wallet?.balance ?? 0).toFixed(2)} <span style={{ fontSize: '18px', opacity: 0.5 }}>ETB</span></div>
               
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '25px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                  <div>
                     <div style={{ fontSize: '10px', opacity: 0.5, marginBottom: '4px' }}>BONUS BALANCE</div>
                     <div style={{ fontSize: '18px', fontWeight: '900' }}>0.00 <span style={{ fontSize: '11px', opacity: 0.3 }}>ETB</span></div>
                  </div>
                  <div>
                     <div style={{ fontSize: '10px', opacity: 0.5, marginBottom: '4px' }}>TOTAL COINS</div>
                     <div style={{ fontSize: '18px', fontWeight: '900', color: T.gold }}>0 <span style={{ fontSize: '11px', opacity: 0.3 }}>XP</span></div>
                  </div>
               </div>

               <button style={{ width: '100%', marginTop: '20px', padding: '12px', borderRadius: '12px', background: T.gold, border: 'none', color: T.header, fontWeight: '900', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Download size={18} /> Convert Coins to ETB
               </button>
            </div>

            <div style={{ marginTop: '25px' }}>
               <div style={{ fontSize: '12px', fontWeight: '900', opacity: 0.4, textTransform: 'uppercase', marginBottom: '12px', paddingLeft: '5px' }}>Recent Activity</div>
               <div style={{ background: T.card, borderRadius: '16px', border: `1px solid ${T.border}`, padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ opacity: 0.2, marginBottom: '10px' }}><History size={40} style={{ margin: '0 auto' }} /></div>
                  <div style={{ fontSize: '13px', opacity: 0.5 }}>No recent transactions found</div>
               </div>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
             <div style={{ background: T.card, borderRadius: '16px', border: `1px solid ${T.border}`, padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ opacity: 0.2, marginBottom: '10px' }}><History size={40} style={{ margin: '0 auto' }} /></div>
                <div style={{ fontSize: '13px', opacity: 0.5 }}>History will appear here after your first game</div>
             </div>
          </motion.div>
        )}

      </div>

      {/* ── Premium Navbar (Fixed at Bottom) ── */}
      <div style={{ position: 'fixed', bottom: 15, left: 15, right: 15, background: T.header, display: 'flex', justifyContent: 'space-around', padding: '10px 5px', borderRadius: '20px', border: `1px solid ${T.gold}`, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', zIndex: 1000 }}>
         {[
           { label: 'Game',    icon: <Play size={20} color={T.gold} />, active: false, path: '/' },
           { label: 'Scores',  icon: <Trophy size={20} color={T.gold} />, active: false, path: '/scores' },
           { label: 'History', icon: <History size={20} color={T.gold} />, active: false, path: '/history' },
           { label: 'Wallet',  icon: <WalletIcon size={20} fill={T.gold} color={T.gold} />, active: true, path: '/wallet' },
           { label: 'Profile', icon: <UserIcon size={20} color={T.gold} />, active: false, path: '/profile' },
         ].map((item) => (
           <div 
              key={item.label} 
              onClick={() => router.push(item.path)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flex: 1, opacity: item.active ? 1 : 0.5, cursor: 'pointer' }}
           >
             {item.icon}
             <span style={{ fontSize: '10px', fontWeight: '900', color: T.gold }}>{item.label}</span>
           </div>
         ))}
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;900&display=swap');
        body { background: ${T.bg} !important; margin: 0; padding: 0; transition: background 0.3s ease; }
      `}</style>
    </div>
  );
}
