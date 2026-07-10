'use client';

/**
 * Scoped storage — prefixes keys by Telegram user ID to isolate
 * state between multiple accounts on the same device.
 *
 * IMPORTANT: The prefix is computed lazily and is always '' if
 * Telegram WebApp SDK has not loaded yet (e.g. during SSR or early
 * hydration). This is intentional — all reads/writes before Telegram
 * loads use plain keys, which is safe because the app can't function
 * without Telegram anyway.
 */

const getTgUserId = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    const id = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
    return id ? String(id) : '';
  } catch (e) {
    return '';
  }
};

export const getStoragePrefix = (): string => {
  const uid = getTgUserId();
  return uid ? `tg_${uid}_` : '';
};

export const scopedLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    const prefix = getStoragePrefix();
    try {
      const prefixed = prefix ? localStorage.getItem(prefix + key) : null;
      if (prefixed !== null) return prefixed;
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    const prefix = getStoragePrefix();
    try {
      localStorage.setItem(prefix + key, value);
      if (prefix) {
        localStorage.removeItem(key);
      }
    } catch (e) {}
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    const prefix = getStoragePrefix();
    try {
      localStorage.removeItem(prefix + key);
      localStorage.removeItem(key);
    } catch (e) {}
  }
};

export const scopedSessionStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    const prefix = getStoragePrefix();
    try {
      const prefixed = prefix ? sessionStorage.getItem(prefix + key) : null;
      if (prefixed !== null) return prefixed;
      return sessionStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    const prefix = getStoragePrefix();
    try {
      sessionStorage.setItem(prefix + key, value);
      if (prefix) {
        sessionStorage.removeItem(key);
      }
    } catch (e) {}
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    const prefix = getStoragePrefix();
    try {
      sessionStorage.removeItem(prefix + key);
      sessionStorage.removeItem(key);
    } catch (e) {}
  }
};
