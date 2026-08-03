'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchReport } from '@/lib/client/api';
import type { WeekResponse } from '@/lib/types';

/**
 * The complete event log for the report.
 *
 * Unlike useToday/useWeek this does not poll: the report is a document read
 * end to end, and having charts shift under the reader mid-appointment would
 * be worse than being 60 seconds stale. It refetches on refocus only.
 */
export function useReport() {
  const [report, setReport] = useState<WeekResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setReport(await fetchReport());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the record');
    }
  }, []);

  useEffect(() => {
    refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  return { report, error, refresh };
}
