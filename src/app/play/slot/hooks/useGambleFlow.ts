'use client';
import { useState, useCallback } from 'react';
import axios from 'axios';
import { GambleResult } from '../types';

function getInitData(): string {
  try { return (window as any).Telegram?.WebApp?.initData ?? ''; }
  catch { return ''; }
}

const headers = () => ({ 'x-telegram-init-data': getInitData() });

export function useGambleFlow() {
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [currentPayout, setCurrent] = useState(0);
  const [round, setRound]       = useState(0);
  const [complete, setComplete] = useState(false);

  const startGamble = useCallback((initialPayout: number) => {
    setCurrent(initialPayout);
    setRound(0);
    setComplete(false);
    setError(null);
  }, []);

  const makeChoice = useCallback(async (
    spinId: string,
    choice: 'red' | 'black',
    onResult: (r: GambleResult) => void,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post(
        '/api/games/slot/gamble',
        { spinId, choice },
        { headers: headers() },
      );
      const result = data as GambleResult;
      setCurrent(result.newPayout);
      setRound(result.round);
      setComplete(result.gambleComplete);
      onResult(result);
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message ?? 'Gamble failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const doCollect = useCallback(async (
    spinId: string,
    onCollected: (finalPayout: number, newBalance: number) => void,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post(
        '/api/games/slot/collect',
        { spinId },
        { headers: headers() },
      );
      setComplete(true);
      onCollected(data.finalPayout, data.newBalance);
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message ?? 'Collect failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setCurrent(0);
    setRound(0);
    setComplete(false);
    setError(null);
  }, []);

  return { loading, error, currentPayout, round, complete, startGamble, makeChoice, doCollect, reset };
}
