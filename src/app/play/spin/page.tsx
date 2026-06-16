'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Coffee, ShieldCheck, Home } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { getLanguage } from '../../../lib/telegram';
import t from '../../../lib/i18n';

export default function SpinPage() {
  const router = useRouter();
  const { T } = useTheme();

  return (
    <div style={{ 
      background: `linear-gradient(135deg, ${T.header || '#1C0A35'}, #3D2B1F, #0D0518)`, 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '24px',
      color: '#ffffff',
      fontFamily: "'Segoe UI', Roboto, sans-serif"
    }}>
      {/* ── Top branding ── */}
      <div style={{ 
        position: 'absolute', 
        top: '20px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        color: T.gold || '#D4AF37',
        fontWeight: '900',
        fontSize: '18px',
        letterSpacing: '1px'
      }}>
        <ShieldCheck size={22} /> {getLanguage() === 'am' ? 'ቡና ጌም ዞን' : 'BUNA GAME ZONE'}
      </div>

      {/* ── Main card container ── */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{
          background: T.card || 'rgba(61, 43, 31, 0.85)',
          border: `3px solid ${T.gold || '#D4AF37'}`,
          boxShadow: `0 15px 35px rgba(0, 0, 0, 0.5), 0 0 25px ${(T.gold || '#D4AF37')}22`,
          borderRadius: '32px',
          padding: '40px 30px',
          textAlign: 'center',
          maxWidth: '420px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backdropFilter: 'blur(10px)'
        }}
      >
        {/* Glowing Spinning Coffee Cup / Logo */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 15, ease: 'linear' }}
          style={{
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${(T.gold || '#D4AF37')}22 0%, ${(T.gold || '#D4AF37')}44 100%)`,
            border: `2px dashed ${T.gold || '#D4AF37'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '25px',
            boxShadow: `inset 0 0 15px ${(T.gold || '#D4AF37')}33`
          }}
        >
          <Coffee size={42} color={T.gold || '#D4AF37'} />
        </motion.div>

        {/* English Title */}
        <h1 style={{
          fontSize: '28px',
          fontWeight: '900',
          color: T.gold || '#D4AF37',
          margin: '0 0 5px 0',
          letterSpacing: '0.5px',
          textShadow: '0 2px 4px rgba(0,0,0,0.5)'
        }}>
          COMING SOON!
        </h1>

        {/* Amharic Title */}
        <h2 style={{
          fontSize: '22px',
          fontWeight: '900',
          color: '#ffffff',
          margin: '0 0 20px 0',
          letterSpacing: '0.5px',
          opacity: 0.95
        }}>
          {t('spinComingSoonSubtitle') as string}🚧
        </h2>

        {/* Explanatory Message */}
        <p style={{
          fontSize: '13px',
          lineHeight: '1.6',
          color: '#E0DCD3',
          margin: '0 0 12px 0',
          fontWeight: '500'
        }}>
          Buna Spin Games are currently undergoing major high-performance upgrades. We are preparing grand prize wheels, instant multipliers, and real-time syncing to deliver the ultimate gaming experience!
        </p>

        <p style={{
          fontSize: '12px',
          lineHeight: '1.6',
          color: T.gold || '#D4AF37',
          margin: '0 0 30px 0',
          fontWeight: '600',
          borderTop: `1px solid ${(T.gold || '#D4AF37')}33`,
          paddingTop: '15px'
        }}>
          {t('spinComingSoonMsgAlt') as string}
        </p>

        {/* Back to Lobby Button */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push('/')}
          style={{
            width: '100%',
            background: `radial-gradient(circle at 35% 35%, ${T.gold || '#D4AF37'} 0%, ${T.goldDk || '#8B6B1D'} 100%)`,
            color: T.header || '#1C0A35',
            border: 'none',
            padding: '16px 20px',
            borderRadius: '16px',
            fontWeight: '900',
            fontSize: '15px',
            cursor: 'pointer',
            boxShadow: `0 8px 24px rgba(0,0,0,0.35), inset 0 2px 4px rgba(255,255,255,0.4)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          <Home size={18} strokeWidth={2.5} /> {t('backToLobby') as string}
        </motion.button>
      </motion.div>
    </div>
  );
}
