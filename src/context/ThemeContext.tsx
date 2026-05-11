'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';

export const THEMES = {
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
