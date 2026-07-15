import { PROTEIN_TARGET_G } from '../weekStats';

/** Daily nutrition targets, read server-side from env. Server-only (not
 *  NEXT_PUBLIC): the values reach the client via the GET /api/recipes
 *  response so there is no extra round trip. The protein default is the same
 *  constant the home goal cards read, so the two surfaces agree unless the
 *  env var deliberately overrides the nutrition console. */

const DEFAULT_PROTEIN_TARGET = PROTEIN_TARGET_G; // grams
const DEFAULT_CALORIE_TARGET = 2200; // kcal

function parseTarget(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

export function proteinTarget(): number {
  return parseTarget(process.env.PROTEIN_TARGET, DEFAULT_PROTEIN_TARGET);
}

export function calorieTarget(): number {
  return parseTarget(process.env.CALORIE_TARGET, DEFAULT_CALORIE_TARGET);
}
