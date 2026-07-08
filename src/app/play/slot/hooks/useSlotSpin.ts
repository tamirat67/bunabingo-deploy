'use client';
import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { SpinResult } from '../types';

function getInitData(): string {
  try { return (window as any).Telegram?.WebApp?.initData ?? ''; }
  catch { return ''; }
}

export function useSlotSpin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doSpin = useCallback(async (
    betAmount: number,
    clientSeed?: string,
  ): Promise<SpinResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/games/slot/spin', {
        betAmount,
        clientSeed,
      }, {
        headers: { 'x-telegram-init-data': getInitData() },
      });
      return data as SpinResult;
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.message ?? 'Spin failed';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { doSpin, loading, error, clearError: () => setError(null) };
}

export function useSlotConfig() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/games/slot/config', {
        headers: { 'x-telegram-init-data': getInitData() },
      });
      setConfig(data.config);
    } catch { /* use defaults */ }
    finally { setLoading(false); }
  }, []);

  return { config, fetchConfig, loading };
}

export function useSlotHistory() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/games/slot/history', {
        headers: { 'x-telegram-init-data': getInitData() },
      });
      setHistory(data.spins ?? []);
    } catch { }
    finally { setLoading(false); }
  }, []);

  return { history, fetchHistory, loading };
}
