import type { Recipe } from './types';

const INGREDIENT_SEP = '\n';

type NotionPage = {
  id: string;
  archived?: boolean;
  in_trash?: boolean;
  properties?: Record<string, any>;
};

function plainText(prop: unknown): string {
  const rt = (prop as any)?.rich_text;
  if (!Array.isArray(rt)) return '';
  return rt.map((r: any) => r?.plain_text ?? '').join('');
}

function titleText(prop: unknown): string {
  const t = (prop as any)?.title;
  if (!Array.isArray(t)) return '';
  return t.map((r: any) => r?.plain_text ?? '').join('');
}

function splitIngredients(text: string): string[] {
  return text
    .split(INGREDIENT_SEP)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Parse a Notion page from the Recipes database into a Recipe; null if it
 *  isn't usable (archived, or no name). */
export function fromRecipeNotionPage(page: unknown): Recipe | null {
  const p = page as NotionPage;
  if (!p?.id || !p.properties) return null;
  if (p.archived || p.in_trash) return null;

  const name = titleText(p.properties.Name).trim();
  if (!name) return null;

  const protein = p.properties.Protein?.number;
  const calories = p.properties.Calories?.number;

  return {
    id: p.id,
    name,
    ...(typeof protein === 'number' ? { proteinG: protein } : {}),
    ...(typeof calories === 'number' ? { calories } : {}),
    ingredients: splitIngredients(plainText(p.properties.Ingredients)),
  };
}
