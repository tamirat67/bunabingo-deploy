'use client';
import { tg } from './telegram';

export const getStoragePrefix = () => {
  if (typeof window === 'undefined') return '';
  try {
    const user = tg()?.initDataUnsafe?.user;
    if (user?.id) return `tg_${user.id}_`;
  } catch (e) {}
  return '';
};

export const scopedLocalStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(getStoragePrefix() + key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(getStoragePrefix() + key, value);
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(getStoragePrefix() + key);
  }
};

export const scopedSessionStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(getStoragePrefix() + key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(getStoragePrefix() + key, value);
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(getStoragePrefix() + key);
  }
};
