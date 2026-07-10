'use client';

export const tg = () => {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
    return (window as any).Telegram.WebApp;
  }
  return null;
};

export const initTelegram = (retryCount = 0) => {
  try {
    const app = tg();
    if (app && typeof app.ready === 'function') {
      app.ready();
      if (typeof app.expand === 'function') app.expand();
      if (app.enableClosingConfirmation) app.enableClosingConfirmation();
    } else if (retryCount < 20) {
      setTimeout(() => initTelegram(retryCount + 1), 100);
    }
  } catch (e) {
    console.warn('Telegram SDK init failed:', e);
  }
};

export const getTgInitData = () => {
  try {
    return tg()?.initData || '';
  } catch (e) {
    return '';
  }
};

export const getLanguage = () => {
  if (typeof window !== 'undefined') {
    try {
      // Read from localStorage directly to avoid circular imports with storage.ts
      const uid = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
      const prefix = uid ? `tg_${uid}_` : '';
      const override = localStorage.getItem(prefix + 'app_language') || localStorage.getItem('app_language');
      if (override === 'am' || override === 'en') return override;
    } catch (e) {
      // Ignore
    }
  }
  try {
    const lang = tg()?.initDataUnsafe?.user?.language_code;
    return lang === 'am' ? 'am' : 'en';
  } catch (e) {
    return 'en';
  }
};

export const setLanguage = (lang: 'en' | 'am') => {
  if (typeof window !== 'undefined') {
    try {
      const uid = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
      const prefix = uid ? `tg_${uid}_` : '';
      localStorage.setItem(prefix + 'app_language', lang);
      // Clean up old unprefixed key
      if (prefix) localStorage.removeItem('app_language');
    } catch (e) {
      // Ignore
    }
    window.dispatchEvent(new Event('languageChange'));
  }
};
