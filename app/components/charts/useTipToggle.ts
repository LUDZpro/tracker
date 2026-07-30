'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Tap-to-open tooltip state for one chart.
 *
 * Hover and focus are pure CSS; this only exists so the tooltip works with a
 * thumb, which is the surface that matters most here. Tapping the same column
 * again, tapping elsewhere, or pressing Escape closes it.
 */
export function useTipToggle(): {
  openKey: string | null;
  toggle: (key: string) => void;
  isOpen: (key: string) => boolean;
} {
  const [openKey, setOpenKey] = useState<string | null>(null);

  const toggle = useCallback((key: string) => {
    setOpenKey((current) => (current === key ? null : key));
  }, []);

  useEffect(() => {
    if (openKey === null) return;

    const closeOnOutside = (e: PointerEvent) => {
      const target = e.target;
      if (target instanceof Element && target.closest('[data-chart-col]')) return;
      setOpenKey(null);
    };
    // Escape must not move focus — the column keeps it.
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenKey(null);
    };

    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openKey]);

  const isOpen = useCallback((key: string) => openKey === key, [openKey]);

  return { openKey, toggle, isOpen };
}
