'use client';

import DesktopHome from '@/components/desktop/DesktopHome';
import MobileHome from '@/components/home/MobileHome';
import { useMediaQuery } from '@/hooks/useMediaQuery';

/**
 * One route, two surfaces: the ≥1024px desktop console and the one-thumb
 * mobile logger. Rendered per-client (not CSS-hidden) so only one tree
 * mounts and fetches.
 */
export default function HomePage() {
  const desktop = useMediaQuery('(min-width: 1024px)');
  if (desktop === null) return null; // first client frame — avoid a layout flash
  return desktop ? <DesktopHome /> : <MobileHome />;
}
