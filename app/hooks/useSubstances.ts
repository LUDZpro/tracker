'use client';

import { useEffect, useState } from 'react';
import { fetchSubstances } from '@/lib/client/api';
import type { Substance } from '@/lib/substances/types';

/** The registry is a file, so it never changes under a running tab — fetch
 *  once per mount and keep it. */
export function useSubstances() {
  const [substances, setSubstances] = useState<Substance[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchSubstances()
      .then((list) => {
        if (live) setSubstances(list);
      })
      .catch(() => {
        if (live) setError('Could not load the substance list');
      });
    return () => {
      live = false;
    };
  }, []);

  return { substances, error };
}
