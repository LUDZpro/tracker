'use client';

import { useEffect, useState } from 'react';

/**
 * Reactive matchMedia. Returns null before the first client measurement so
 * callers can avoid flashing the wrong layout during hydration.
 */
export function useMediaQuery(query: string): boolean | null {
  const [matches, setMatches] = useState<boolean | null>(null);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
