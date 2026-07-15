import { describe, expect, it } from 'vitest';
import { fromRecipeNotionPage } from './mapping';

function page(props: Record<string, any>, extra: Record<string, any> = {}) {
  return { id: 'page-1', properties: props, ...extra };
}

const nameProp = (name: string) => ({ title: [{ plain_text: name }] });
const richText = (text: string) => ({ rich_text: [{ plain_text: text }] });

describe('fromRecipeNotionPage', () => {
  it('parses a full row', () => {
    const r = fromRecipeNotionPage(
      page({
        Name: nameProp('Protein oats'),
        Protein: { number: 32 },
        Calories: { number: 450 },
        Ingredients: richText('Rolled oats — 80g\nWhey scoop — 30g\nBanana — 1'),
      }),
    );
    expect(r).toEqual({
      id: 'page-1',
      name: 'Protein oats',
      proteinG: 32,
      calories: 450,
      ingredients: ['Rolled oats — 80g', 'Whey scoop — 30g', 'Banana — 1'],
    });
  });

  it('omits missing macros and yields an empty ingredient list', () => {
    const r = fromRecipeNotionPage(
      page({ Name: nameProp('Mystery snack'), Ingredients: richText('') }),
    );
    expect(r).toEqual({ id: 'page-1', name: 'Mystery snack', ingredients: [] });
    expect(r).not.toHaveProperty('proteinG');
    expect(r).not.toHaveProperty('calories');
  });

  it('trims blank ingredient lines', () => {
    const r = fromRecipeNotionPage(
      page({
        Name: nameProp('Bowl'),
        Ingredients: richText('  Yogurt — 250g \n\n  Granola — 30g\n'),
      }),
    );
    expect(r?.ingredients).toEqual(['Yogurt — 250g', 'Granola — 30g']);
  });

  it('rejects archived, trashed, and nameless pages', () => {
    expect(fromRecipeNotionPage(page({ Name: nameProp('X') }, { archived: true }))).toBeNull();
    expect(fromRecipeNotionPage(page({ Name: nameProp('X') }, { in_trash: true }))).toBeNull();
    expect(fromRecipeNotionPage(page({ Name: nameProp('   ') }))).toBeNull();
    expect(fromRecipeNotionPage(page({}))).toBeNull();
    expect(fromRecipeNotionPage(null)).toBeNull();
  });
});
