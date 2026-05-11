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
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Theme Definitions ────────────────────────────────────────────────────────
const THEMES = {
  GOLDEN: {
    name: 'Light Golden',
    bg:      '#F5E6BE',   // Cream
    header:  '#3D2B1F',   // Espresso
    gold:    '#D4AF37',   // Gold
    text:    '#3D2B1F',   // Dark Brown
    card:    '#FFFFFF',   // White cards
    cardTxt: '#3D2B1F',
    border:  'rgba(61,43,31,0.1)'
  },
  GRAY: {
    name: 'Gray Dark',
    bg:      '#2B2B2B',   // Dark Gray
    header:  '#1A1A1A',   // Pitch Black
    gold:    '#E0E0E0',   // Silver
    text:    '#F5F5F5',   // White-ish
    card:    '#333333',   // Lighter Gray
    cardTxt: '#FFFFFF',
    border:  'rgba(255,255,255,0.05)'
  },
  LIGHT: {
    name: 'System Light',
    bg:      '#FFFFFF',   // Pure White
    header:  '#F8F9FA',   // Light Gray
    gold:    '#007AFF',   // Blue (System)
    text:    '#000000',   // Black
    card:    '#F2F2F7',   // System Gray
    cardTxt: '#000000',
    border:  'rgba(0,0,0,0.05)'
  },
  DARK: {
    name: 'Dark Mode',
    bg:      '#121212',   // Amoled Black
    header:  '#1E1E1E',   // Dark Gray
    gold:    '#D4AF37',   // Gold
    text:    '#FFFFFF',   // White
    card:    '#1E1E1E',   // Dark card
    cardTxt: '#FFFFFF',
    border:  'rgba(255,255,255,0.1)'
  }
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeThemeKey, setActiveThemeKey] = useState<keyof typeof THEMES>('GOLDEN');
  const [showThemePicker, setShowThemePicker] = useState(false);

  useEffect(() => {
    setMounted(true);
    const tg = initTelegram();
    
    // Load local settings
    const savedSound = localStorage.getItem('game_sound');
    if (savedSound !== null) setSoundEnabled(savedSound === 'true');
    
    const savedTheme = localStorage.getItem('app_theme');
    if (savedTheme && THEMES[savedTheme as keyof typeof THEMES]) {
      setActiveThemeKey(savedTheme as keyof typeof THEMES);
    }

    refreshData();
  }, []);

  const refreshData = async () => {
    try {
      const data = await getProfile();
      setProfile(data);
    } catch (e) {}
  };

  const toggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    localStorage.setItem('game_sound', String(newState));
  };

  const selectTheme = (key: keyof typeof THEMES) => {
    setActiveThemeKey(key);
    localStorage.setItem('app_theme', key);
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

  const T = THEMES[activeThemeKey];

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
           <div style={{ fontSize: '24px', fontWeight: '900' }}>{profile?.username || 'Buna Player'}</div>
           <div style={{ fontSize: '13px', opacity: 0.6, marginTop: '4px' }}>Member since 2024</div>
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

        {/* ── Logout/Support ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
           <button style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'transparent', border: `1px solid ${T.border}`, color: T.text, fontWeight: '900', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Coffee size={18} /> Support Channel
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
