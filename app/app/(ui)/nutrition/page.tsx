'use client';

import MobileNutrition from '@/components/nutrition/MobileNutrition';
import NutritionConsole from '@/components/nutrition/desktop/NutritionConsole';
import { useMediaQuery } from '@/hooks/useMediaQuery';

/**
 * One route, two surfaces — same pattern as the home page: the ≥1024px
 * desktop console and the one-thumb mobile logger. Rendered per-client so
 * only one tree mounts and fetches.
 */
export default function NutritionPage() {
  const desktop = useMediaQuery('(min-width: 1024px)');
  if (desktop === null) return null; // first client frame — avoid a layout flash
  return desktop ? <NutritionConsole /> : <MobileNutrition />;
}
