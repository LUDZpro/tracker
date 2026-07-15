import { notionFetch } from '../notion';
import { fromRecipeNotionPage } from './mapping';
import type { Recipe } from './types';

/**
 * The Recipes data source — a database of its own, deliberately separate from
 * the event log (created 2026-07-14 under the same parent page as the event
 * log and CBT databases, so the integration token reaches all three).
 */
const RECIPES_DATA_SOURCE_ID = '8b0358e9-dbee-4c07-96a4-7f5496659450';

/** All recipes, name-ascending. Recipes are few, so one page suffices. */
export async function queryRecipes(): Promise<Recipe[]> {
  const data = await notionFetch(`/data_sources/${RECIPES_DATA_SOURCE_ID}/query`, {
    method: 'POST',
    body: JSON.stringify({
      sorts: [{ property: 'Name', direction: 'ascending' }],
      page_size: 100,
    }),
  });
  const recipes: Recipe[] = [];
  for (const page of data.results ?? []) {
    const r = fromRecipeNotionPage(page);
    if (r) recipes.push(r);
  }
  return recipes;
}
