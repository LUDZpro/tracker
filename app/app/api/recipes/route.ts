import { NextResponse } from 'next/server';
import { getCachedRecipes, setCachedRecipes } from '@/lib/cache';
import { errorResponse } from '@/lib/http';
import { calorieTarget, proteinTarget } from '@/lib/nutrition/targets';
import { queryRecipes } from '@/lib/recipes/notion';
import type { Recipe, RecipesResponse } from '@/lib/recipes/types';

export async function GET() {
  try {
    let recipes = getCachedRecipes<Recipe[]>();
    if (!recipes) {
      recipes = await queryRecipes();
      setCachedRecipes(recipes);
    }
    const payload: RecipesResponse = {
      recipes,
      proteinTarget: proteinTarget(),
      calorieTarget: calorieTarget(),
    };
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
