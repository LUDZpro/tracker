/**
 * Recipes, backed by Postgres. Recipes remain a *source* of meal payloads —
 * logging one still writes a normal `meal` event; there is no recipe event
 * type. Ingredients are a real `text[]` now instead of a newline-joined blob.
 */
import { query } from '../db/pool';
import type { Recipe } from './types';

interface RecipeRow {
  id: string;
  name: string;
  protein_g: string | number | null;
  calories: string | number | null;
  ingredients: string[] | null;
}

function num(v: string | number | null): number | undefined {
  if (v === null) return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** All live recipes, name-ascending. Recipes are few, so no paging. */
export async function queryRecipes(): Promise<Recipe[]> {
  const rows = await query<RecipeRow>(
    `SELECT id, name, protein_g, calories, ingredients
     FROM recipes
     WHERE archived_at IS NULL AND name <> ''
     ORDER BY name ASC`,
  );

  return rows.map((row) => {
    const proteinG = num(row.protein_g);
    const calories = num(row.calories);
    return {
      id: row.id,
      name: row.name,
      ...(proteinG !== undefined ? { proteinG } : {}),
      ...(calories !== undefined ? { calories } : {}),
      ingredients: row.ingredients ?? [],
    };
  });
}
