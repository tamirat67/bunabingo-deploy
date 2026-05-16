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
