'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { scopedLocalStorage } from '../lib/storage';

export const THEMES = {
  PREMIUM_DARK: {
    name: 'Premium Dark',
    bg:      '#0F172A',
    header:  '#1E293B',
    gold:    '#F59E0B',
    goldDk:  '#D97706',
    brown:   '#94A3B8',
    brownLobby: '#E2E8F0',
    text:    '#F8FAFC',
    textL:   '#F8FAFC',
    card:    '#1E293B',
    cardLobby: '#334155',
    cardTxt: '#F8FAFC',
    statBg:  '#0F172A',
    border:  'rgba(255,255,255,0.1)'
  },
  GRAY: {
    name: 'Gray Dark',
    bg:      '#2B2B2B',   
    header:  '#1A1A1A',   
    gold:    '#E0E0E0',   
    goldDk:  '#BDBDBD',
    brown:   '#9E9E9E',
    brownLobby: '#BDBDBD',
    text:    '#F5F5F5',   
    textL:   '#F5F5F5',
    card:    '#333333',   
    cardLobby: '#333333',
    cardTxt: '#FFFFFF',
    statBg:  '#222222',
    border:  'rgba(255,255,255,0.05)'
  },
  LIGHT: {
    name: 'System Light',
    bg:      '#FFFFFF',   
    header:  '#F8F9FA',   
    gold:    '#007AFF',   
    goldDk:  '#0056b3',
    brown:   '#6c757d',
    brownLobby: '#495057',
    text:    '#000000',   
    textL:   '#000000',
    card:    '#F2F2F7',   
    cardLobby: '#E9ECEF',
    cardTxt: '#000000',
    statBg:  '#F8F9FA',
    border:  'rgba(0,0,0,0.05)'
  },
  DARK: {
    name: 'Dark Mode',
    bg:      '#121212',   
    header:  '#1E1E1E',   
    gold:    '#D4AF37',   
    goldDk:  '#B8860B',
    brown:   '#A0A0A0',
    brownLobby: '#D4AF37',
    text:    '#FFFFFF',   
    textL:   '#FFFFFF',
    card:    '#1E1E1E',   
    cardLobby: '#2C2C2C',
    cardTxt: '#FFFFFF',
    statBg:  '#121212',
    border:  'rgba(255,255,255,0.1)'
  }
};

type ThemeKey = keyof typeof THEMES;

interface ThemeContextType {
  activeThemeKey: ThemeKey;
  setTheme: (key: ThemeKey) => void;
  T: typeof THEMES['PREMIUM_DARK'];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Read saved theme synchronously to avoid flash on first render
  const [activeThemeKey, setActiveThemeKey] = useState<ThemeKey>(() => {
    if (typeof window !== 'undefined') {
      const saved = scopedLocalStorage.getItem('app_theme') as ThemeKey;
      if (saved && THEMES[saved]) return saved;
    }
    return 'PREMIUM_DARK';
  });

  const setTheme = (key: ThemeKey) => {
    setActiveThemeKey(key);
    scopedLocalStorage.setItem('app_theme', key);
  };

  const value = {
    activeThemeKey,
    setTheme,
    T: THEMES[activeThemeKey]
  };

  return (
    <ThemeContext.Provider value={value}>
      <div style={{ background: value.T.bg, minHeight: '100vh', transition: 'background 0.3s ease' }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
