'use client';
import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { GambleResult } from '../types';

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
      const { data } = await api.post('/games/slot/gamble', { spinId, choice });
      const result = data as GambleResult;
      setCurrent(result.newPayout);
      setRound(result.round);
      setComplete(result.gambleComplete);
      onResult(result);
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.message ?? 'Gamble failed';
      setError(msg);
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
      const { data } = await api.post('/games/slot/collect', { spinId });
      setComplete(true);
      onCollected(data.finalPayout, data.newBalance);
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.message ?? 'Collect failed';
      setError(msg);
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
