'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';

export const THEMES = {
  GOLDEN: {
    name: 'Light Golden',
    bg:      '#F5E6BE',   
    header:  '#3D2B1F',   
    gold:    '#D4AF37',   
    goldDk:  '#8B6B1D',   
    brown:   '#8D6E63',   // For game text
    brownLobby: '#4B3621', // For lobby text
    text:    '#3D2B1F',   
    textL:   '#F5E6BE',
    card:    '#FFFFFF',   // Used in profile, game
    cardLobby: '#3D2B1F', // Used in lobby rows
    cardTxt: '#3D2B1F',
    statBg:  '#EEDCBA',
    border:  'rgba(61,43,31,0.1)'
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
  T: typeof THEMES['GOLDEN'];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [activeThemeKey, setActiveThemeKey] = useState<ThemeKey>('GOLDEN');

  useEffect(() => {
    const saved = localStorage.getItem('app_theme') as ThemeKey;
    if (saved && THEMES[saved]) {
      setActiveThemeKey(saved);
    }
  }, []);

  const setTheme = (key: ThemeKey) => {
    setActiveThemeKey(key);
    localStorage.setItem('app_theme', key);
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
