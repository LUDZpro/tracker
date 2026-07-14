'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchCbtRecords } from '@/lib/client/cbt';
import type { CbtHistoryResponse } from '@/lib/cbt/types';

/** ISO-cursor-paged thought records, newest first; refetches on refocus. */
export function useCbtRecords() {
  const [pages, setPages] = useState<CbtHistoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingMore = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const page = await fetchCbtRecords();
      setPages((prev) => [page, ...prev.slice(1)]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load records');
    } finally {
      setLoading(false);
    }
  }, []);

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
      const page = await fetchCbtRecords(last.nextCursor);
      setPages((prev) => [...prev, page]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load more');
    } finally {
      loadingMore.current = false;
    }
  }, [pages]);

  // Stable identity between re-renders — see the matching note in useHistory.
  const records = useMemo(() => pages.flatMap((p) => p.records), [pages]);
  const hasMore = pages.length > 0 && pages[pages.length - 1].nextCursor !== null;

  return { records, hasMore, loading, error, loadMore, refresh };
}
