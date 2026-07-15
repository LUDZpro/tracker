'use client';

import { useState } from 'react';
import type { Recipe } from '@/lib/recipes/types';
import styles from './nutrition-console.module.css';

interface Props {
  recipes: Recipe[];
  error: string | null;
  onLog: (recipe: Recipe) => void;
}

function macrosLine(r: Recipe): string {
  const parts: string[] = [];
  if (r.proteinG !== undefined) parts.push(`${r.proteinG}g protein`);
  if (r.calories !== undefined) parts.push(`${r.calories} kcal`);
  return parts.length ? parts.join(' · ') : 'no macros set';
}

/** "Rolled oats — 80g" → name/qty columns; lines without the dash render whole. */
function splitIngredient(line: string): { name: string; qty: string | null } {
  const at = line.lastIndexOf('—');
  if (at === -1) return { name: line.trim(), qty: null };
  return { name: line.slice(0, at).trim(), qty: line.slice(at + 1).trim() || null };
}

export default function RecipeList({ recipes, error, onLog }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className={styles.col}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionLabel}>Recipes</span>
        <span className={styles.sectionHint}>click for ingredients</span>
      </div>

      {error && <p className={styles.errorInline}>{error}</p>}

      {recipes.length === 0 && !error && (
        <p className={styles.emptyCol}>
          No recipes yet — add rows to the 🍱 Recipes database in Notion and they show up here.
        </p>
      )}

      {recipes.map((r) => {
        const open = openId === r.id;
        return (
          <div key={r.id} className={`${styles.recipeCard} ${open ? styles.recipeCardOpen : ''}`}>
            <div
              className={styles.recipeHead}
              onClick={() => setOpenId(open ? null : r.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setOpenId(open ? null : r.id);
              }}
            >
              <div className={styles.recipeInfo}>
                <div className={styles.recipeName}>{r.name}</div>
                <div className={styles.recipeMacros}>{macrosLine(r)}</div>
              </div>
              <button
                className={styles.logBtn}
                title="Log now"
                aria-label={`Log ${r.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onLog(r);
                }}
              >
                +
              </button>
            </div>
            {open && r.ingredients.length > 0 && (
              <div className={styles.ingredients}>
                <div className={styles.ingredientsInner}>
                  {r.ingredients.map((line, i) => {
                    const { name, qty } = splitIngredient(line);
                    return (
                      <div key={i} className={styles.ingRow}>
                        <span>{name}</span>
                        {qty && <span className={styles.ingQty}>{qty}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
