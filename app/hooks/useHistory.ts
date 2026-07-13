'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchHistory } from '@/lib/client/api';
import { getCachedHistory, setCachedHistory, type CachedPage } from '@/lib/client/historyCache';
import type { EventType } from '@/lib/types';

/**
 * Calendar-day-cursor-paged tracker history (Nutrition/Gym). Paints from the
 * module-level client cache instantly on mount (tab-switch feel), then
 * silently refreshes just the first page in the background — loaded later
 * pages are left alone so a long scroll position isn't disturbed.
 */
export function useHistory(type: EventType) {
  const [pages, setPages] = useState<CachedPage[]>(() => getCachedHistory(type) ?? []);
  const [loading, setLoading] = useState(pages.length === 0);
  const [error, setError] = useState<string | null>(null);
  const loadingMore = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const page = await fetchHistory(type);
      setPages((prev) => {
        const next = [page, ...prev.slice(1)];
        setCachedHistory(type, next);
        return next;
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load history');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refresh);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', refresh);
    };
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (loadingMore.current) return;
    const last = pages[pages.length - 1];
    if (!last || last.nextCursor === null) return;
    loadingMore.current = true;
    try {
      const page = await fetchHistory(type, last.nextCursor);
      setPages((prev) => {
        const next = [...prev, page];
        setCachedHistory(type, next);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load more');
    } finally {
      loadingMore.current = false;
    }
  }, [type, pages]);

  const events = pages.flatMap((p) => p.events);
  const hasMore = pages.length > 0 && pages[pages.length - 1].nextCursor !== null;

  return { events, hasMore, loading, error, loadMore, refresh };
}
