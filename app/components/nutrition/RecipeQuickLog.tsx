'use client';

import type { Recipe } from '@/lib/recipes/types';
import styles from './recipe-quick-log.module.css';

interface Props {
  recipes: Recipe[];
  onLog: (recipe: Recipe) => void;
}

function macrosLine(r: Recipe): string | null {
  const parts: string[] = [];
  if (r.proteinG !== undefined) parts.push(`${r.proteinG}g`);
  if (r.calories !== undefined) parts.push(`${r.calories} kcal`);
  return parts.length ? parts.join(' · ') : null;
}

/** Horizontal strip of pre-planned recipes — one tap logs the meal now. */
export default function RecipeQuickLog({ recipes, onLog }: Props) {
  if (recipes.length === 0) return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>Recipes</div>
      <div className={styles.row}>
        {recipes.map((r) => {
          const macros = macrosLine(r);
          return (
            <button key={r.id} className={styles.chip} onClick={() => onLog(r)}>
              <span className={styles.chipName}>+ {r.name}</span>
              {macros && <span className={styles.chipMacros}>{macros}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
