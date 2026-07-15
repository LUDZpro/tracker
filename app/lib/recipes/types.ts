/** A pre-planned meal, read from the Notion Recipes database. Recipes are a
 *  *source* of meal payloads — logging one writes a normal `meal` event; there
 *  is no separate "recipe" event type. */
export interface Recipe {
  id: string;
  name: string;
  proteinG?: number; // grams per serving
  calories?: number; // kcal per serving
  ingredients: string[]; // one per line, e.g. "Rolled oats — 80g"
}

/** Response shape for GET /api/recipes. Targets ride along so the client gets
 *  everything the nutrition surfaces need in one round trip. */
export interface RecipesResponse {
  recipes: Recipe[];
  proteinTarget: number; // grams
  calorieTarget: number; // kcal
}
