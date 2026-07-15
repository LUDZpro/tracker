'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchRecipes } from '@/lib/client/recipes';
import type { Recipe } from '@/lib/recipes/types';
import { PROTEIN_TARGET_G } from '@/lib/weekStats';

const DEFAULT_PROTEIN_TARGET = PROTEIN_TARGET_G; // matches the home goal card
const DEFAULT_CALORIE_TARGET = 2200;

/** Loads the pre-planned recipes plus daily targets once, refetching on
 *  refocus so edits made in Notion show up without a hard reload. */
export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [proteinTarget, setProteinTarget] = useState(DEFAULT_PROTEIN_TARGET);
  const [calorieTarget, setCalorieTarget] = useState(DEFAULT_CALORIE_TARGET);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchRecipes();
      setRecipes(data.recipes);
      setProteinTarget(data.proteinTarget);
      setCalorieTarget(data.calorieTarget);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load recipes');
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

  return { recipes, proteinTarget, calorieTarget, error, refresh };
}
