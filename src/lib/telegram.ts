'use client';

export const tg = () => {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
    return (window as any).Telegram.WebApp;
  }
  return null;
};

export const initTelegram = () => {
  try {
    const app = tg();
    if (app) {
      if (typeof app.ready === 'function') app.ready();
      if (typeof app.expand === 'function') app.expand();
      if (app.enableClosingConfirmation) app.enableClosingConfirmation();
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
    const override = localStorage.getItem('app_language');
    if (override === 'am' || override === 'en') return override;
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
    localStorage.setItem('app_language', lang);
    window.dispatchEvent(new Event('languageChange'));
  }
};
