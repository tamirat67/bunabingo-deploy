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
    // Try prefixed key first, fall back to unprefixed (migration)
    const prefixed = prefix ? localStorage.getItem(prefix + key) : null;
    if (prefixed !== null) return prefixed;
    return localStorage.getItem(key);
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    const prefix = getStoragePrefix();
    localStorage.setItem(prefix + key, value);
    // If we now have a prefix, remove the old unprefixed key to avoid stale data
    if (prefix) {
      try { localStorage.removeItem(key); } catch (e) {}
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    const prefix = getStoragePrefix();
    localStorage.removeItem(prefix + key);
    localStorage.removeItem(key);
  }
};

export const scopedSessionStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    const prefix = getStoragePrefix();
    const prefixed = prefix ? sessionStorage.getItem(prefix + key) : null;
    if (prefixed !== null) return prefixed;
    return sessionStorage.getItem(key);
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    const prefix = getStoragePrefix();
    sessionStorage.setItem(prefix + key, value);
    if (prefix) {
      try { sessionStorage.removeItem(key); } catch (e) {}
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    const prefix = getStoragePrefix();
    sessionStorage.removeItem(prefix + key);
    sessionStorage.removeItem(key);
  }
};
