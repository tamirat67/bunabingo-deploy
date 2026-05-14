'use client';
import React, { useEffect, useState } from 'react';
import { getProfile } from '../../lib/api';
import { initTelegram } from '../../lib/telegram';
import { useRouter } from 'next/navigation';
import { 
  User, 
  Settings, 
  Volume2, 
  VolumeX, 
  Palette, 
  Users, 
  ChevronRight, 
  Wallet, 
  Gift, 
  Trophy, 
  Play, 
  History, 
  Coffee,
  ChevronDown,
  MoreVertical,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useTheme, THEMES } from '../../context/ThemeContext';

export default function ProfilePage() {
  const router = useRouter();
  const { activeThemeKey, setTheme, T } = useTheme();
  const [profile, setProfile] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    const tg = initTelegram();
    
    // Load local settings
    const savedSound = localStorage.getItem('game_sound');
    if (savedSound !== null) setSoundEnabled(savedSound === 'true');

    refreshData();
  }, []);

  const refreshData = async () => {
    try {
      setLoading(true);
      const data = await getProfile();
      setProfile(data);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!profile?.id) return;
    const link = `https://t.me/buna_bingobot?start=${profile.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    localStorage.setItem('game_sound', String(newState));
  };

  const selectTheme = (key: any) => {
    setTheme(key);
    setShowThemePicker(false);
  };

  const handleInvite = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      const inviteUrl = `https://t.me/buna_bingobot?start=${profile?.id || ''}`;
      const text = `🎰 Join me on Buna Bingo! ☕️ We both get 5 ETB bonus!`;
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(text)}`);
    }
  };

  if (!mounted) return null;

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: '100px', fontFamily: "'Outfit', sans-serif", color: T.text, transition: 'all 0.3s ease' }}>
      
      {/* ── Header ── */}
      <div style={{ background: T.header, padding: '12px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${T.gold}` }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', background: T.gold, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <User size={20} color={T.header} />
            </div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: T.gold, letterSpacing: '0.5px' }}>MY PROFILE</div>
         </div>
         <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ChevronDown size={24} color={T.gold} />
            <MoreVertical size={24} color={T.gold} />
         </div>
      </div>

      <div style={{ padding: '20px 15px' }}>
        
        {/* ── Profile Info ── */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
           <div style={{ width: '80px', height: '80px', background: T.header, borderRadius: '50%', margin: '0 auto 15px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `3px solid ${T.gold}`, boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
              <User size={40} color={T.gold} />
           </div>
           <div style={{ fontSize: '24px', fontWeight: '900' }}>{profile?.username || profile?.firstName || 'Buna Player'}</div>
           <div style={{ fontSize: '12px', color: T.gold, fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>
              {profile?.role === 'AGENT' ? '🌟 Official Agent' : 'Member since 2024'}
           </div>
        </div>

        {/* ── Stats Grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '30px' }}>
           <div style={{ background: T.card, padding: '15px', borderRadius: '16px', border: `1px solid ${T.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4CAF50', marginBottom: '8px' }}>
                 <Wallet size={18} />
                 <span style={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}>Main Wallet</span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: '900', color: T.cardTxt }}>{Number(profile?.balance || 0).toFixed(2)} <span style={{ fontSize: '12px', opacity: 0.5 }}>ETB</span></div>
           </div>
           <div style={{ background: T.card, padding: '15px', borderRadius: '16px', border: `1px solid ${T.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: T.gold, marginBottom: '8px' }}>
                 <Gift size={18} />
                 <span style={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}>Bonus</span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: '900', color: T.cardTxt }}>{Number(profile?.bonusBalance || 0).toFixed(0)} <span style={{ fontSize: '12px', opacity: 0.5 }}>XP</span></div>
           </div>
        </div>

        {/* ── Settings Section ── */}
        <div style={{ marginBottom: '25px' }}>
           <div style={{ fontSize: '12px', fontWeight: '900', opacity: 0.4, textTransform: 'uppercase', marginBottom: '10px', paddingLeft: '5px' }}>Settings & Preferences</div>
           
           <div style={{ background: T.card, borderRadius: '16px', overflow: 'hidden', border: `1px solid ${T.border}` }}>
              
              {/* Game Sound */}
              <div onClick={toggleSound} style={{ padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}`, cursor: 'pointer' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', background: 'rgba(76,175,80,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       {soundEnabled ? <Volume2 size={20} color="#4CAF50" /> : <VolumeX size={20} color="#FF5252" />}
                    </div>
                    <div style={{ fontWeight: '900' }}>Game Sound</div>
                 </div>
                 <div style={{ width: '44px', height: '24px', background: soundEnabled ? '#4CAF50' : '#E0E0E0', borderRadius: '12px', position: 'relative', transition: 'all 0.3s' }}>
                    <div style={{ width: '18px', height: '18px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: soundEnabled ? '23px' : '3px', transition: 'all 0.3s' }} />
                 </div>
              </div>

              {/* Theme Picker */}
              <div onClick={() => setShowThemePicker(!showThemePicker)} style={{ padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}`, cursor: 'pointer' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', background: 'rgba(212,175,55,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <Palette size={20} color={T.gold} />
                    </div>
                    <div>
                       <div style={{ fontWeight: '900' }}>App Theme</div>
                       <div style={{ fontSize: '11px', opacity: 0.5 }}>{T.name}</div>
                    </div>
                 </div>
                 <ChevronRight size={20} opacity={0.3} />
              </div>

              <AnimatePresence>
                 {showThemePicker && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden', background: 'rgba(0,0,0,0.02)' }}>
                       {Object.entries(THEMES).map(([key, theme]) => (
                          <div 
                             key={key} 
                             onClick={() => selectTheme(key as any)}
                             style={{ padding: '12px 15px 12px 63px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderBottom: `1px solid ${T.border}` }}
                          >
                             <span style={{ fontSize: '14px', fontWeight: activeThemeKey === key ? '900' : '400' }}>{theme.name}</span>
                             {activeThemeKey === key && <Check size={16} color={T.gold} />}
                          </div>
                       ))}
                    </motion.div>
                 )}
              </AnimatePresence>

              {/* Invite Friends */}
              <div onClick={handleInvite} style={{ padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', background: 'rgba(33,150,243,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <Users size={20} color="#2196F3" />
                    </div>
                    <div style={{ fontWeight: '900' }}>Invite Friends</div>
                 </div>
                 <div style={{ background: T.gold, color: T.header, fontSize: '10px', padding: '4px 10px', borderRadius: '20px', fontWeight: '900' }}>EARN 5 ETB</div>
              </div>
           </div>
        </div>

        {/* ── Referral Link Box (Smart & Premium) ── */}
        <div style={{ marginBottom: '30px' }}>
           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', padding: '0 5px' }}>
              <div style={{ fontSize: '12px', fontWeight: '900', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '1px' }}>Your Referral Link</div>
              <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: '900' }}>{profile?.referralsCount || 0} REFERRED</div>
           </div>
           
           <div style={{ 
              background: '#f0f7ff', 
              border: '2px solid #bfdbfe', 
              borderRadius: '20px', 
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
           }}>
              <div style={{ flex: 1, paddingLeft: '12px', overflow: 'hidden' }}>
                 <div style={{ fontSize: '10px', opacity: 0.4, fontWeight: '900', marginBottom: '2px' }}>SHARE & EARN 5 ETB</div>
                 <code style={{ display: 'block', fontSize: '12px', color: '#1d4ed8', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    t.me/buna_bingobot?start={profile?.id?.split('-')[0]}
                 </code>
              </div>
              <button 
                 onClick={handleCopyLink}
                 style={{ 
                    background: copied ? '#10b981' : '#1d4ed8', 
                    color: 'white', 
                    border: 'none', 
                    height: '44px',
                    padding: '0 20px', 
                    borderRadius: '16px', 
                    fontSize: '12px', 
                    fontWeight: '900',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                    boxShadow: copied ? '0 4px 10px rgba(16,185,129,0.3)' : '0 4px 10px rgba(29,78,216,0.3)'
                 }}
              >
                 {copied ? <Check size={16} /> : <Copy size={16} />}
                 {copied ? 'DONE' : 'COPY'}
              </button>
           </div>
        </div>

        {/* ── Action Buttons ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
           
           {/* Agent Dashboard Link - ONLY FOR AGENTS */}
           {(profile?.role === 'AGENT' || profile?.isAdmin) && (
              <button 
                 onClick={() => router.push('/agent')}
                 style={{ 
                    width: '100%', 
                    padding: '16px', 
                    borderRadius: '16px', 
                    background: 'linear-gradient(135deg, #d4af37, #b8962e)', 
                    border: 'none', 
                    color: 'black', 
                    fontWeight: '900', 
                    fontSize: '14px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '10px',
                    boxShadow: '0 8px 20px rgba(212,175,55,0.25)',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                 }}
              >
                 <ShieldCheck size={20} /> Agent Portal
              </button>
           )}

           <button 
              onClick={() => window.open('https://t.me/bunabingosupport', '_blank')}
              style={{ 
                 width: '100%', 
                 padding: '16px', 
                 borderRadius: '16px', 
                 background: T.card, 
                 border: `1px solid ${T.border}`, 
                 color: T.text, 
                 fontWeight: '900', 
                 fontSize: '14px', 
                 display: 'flex', 
                 alignItems: 'center', 
                 justifyContent: 'center', 
                 gap: '10px',
                 boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
              }}
           >
              <Coffee size={20} /> Support Channel
           </button>

           <div style={{ textAlign: 'center', fontSize: '10px', opacity: 0.3, marginTop: '20px' }}>
              BUNA BINGO v2.4.0 • ROYAL EDITION
           </div>
        </div>

      </div>

      {/* ── Premium Navbar (Fixed at Bottom) ── */}
      <div style={{ position: 'fixed', bottom: 15, left: 15, right: 15, background: T.header, display: 'flex', justifyContent: 'space-around', padding: '10px 5px', borderRadius: '20px', border: `1px solid ${T.gold}`, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', zIndex: 1000 }}>
         {[
           { label: 'Game',    icon: <Play size={20} color={T.gold} />, active: false, path: '/' },
           { label: 'Scores',  icon: <Trophy size={20} color={T.gold} />, active: false, path: '/scores' },
           { label: 'History', icon: <History size={20} color={T.gold} />, active: false, path: '/history' },
           { label: 'Wallet',  icon: <Wallet size={20} color={T.gold} />, active: false, path: '/wallet' },
           { label: 'Profile', icon: <User size={20} fill={T.gold} color={T.gold} />, active: true, path: '/profile' },
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
