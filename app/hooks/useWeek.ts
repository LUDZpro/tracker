'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchWeek } from '@/lib/client/api';
import type { WeekResponse } from '@/lib/types';

const REFRESH_MS = 60_000;

/** Last-7-days dataset for the desktop view; polls and refocuses like useToday. */
export function useWeek() {
  const [week, setWeek] = useState<WeekResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setWeek(await fetchWeek());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the week');
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', refresh);
    };
  }, [refresh]);

  return { week, error, refresh };
}
