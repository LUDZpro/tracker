'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchToday } from '@/lib/client/api';
import type { TodayResponse } from '@/lib/types';

const REFRESH_MS = 60_000;

/** Load the wake-window `offset` back; polls/refocuses only on the live view. */
export function useToday(offset = 0) {
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setToday(await fetchToday(offset));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load today');
    }
  }, [offset]);

  useEffect(() => {
    refresh();
    if (offset !== 0) return; // past windows are static — no polling
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
  }, [refresh, offset]);

  return { today, error, refresh };
}
