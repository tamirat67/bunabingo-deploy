'use client';
import { useCallback } from 'react';

/** Thin wrapper around Telegram WebApp HapticFeedback */
export function useTelegramHaptics() {
  const haptic = useCallback((
    type: 'spin' | 'win' | 'bigwin' | 'error' | 'select'
  ) => {
    try {
      const tg = (window as any).Telegram?.WebApp?.HapticFeedback;
      if (!tg) return;
      switch (type) {
        case 'spin':    tg.impactOccurred('medium'); break;
        case 'select':  tg.impactOccurred('light'); break;
        case 'win':     tg.notificationOccurred('success'); break;
        case 'bigwin':
          tg.impactOccurred('heavy');
          setTimeout(() => tg.impactOccurred('heavy'), 150);
          break;
        case 'error':   tg.notificationOccurred('error'); break;
      }
    } catch { /* WebApp not available in dev */ }
  }, []);

  return haptic;
}
