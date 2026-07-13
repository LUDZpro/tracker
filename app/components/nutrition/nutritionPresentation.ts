import type { AppEvent } from '@/lib/types';

export const MEAL_COLOR = 'var(--intake)';
export const MEAL_ICON = '🍽';

/** "meal name · first bit of description or protein" per the row contract. */
export function mealSummary(ev: AppEvent): string {
  const bits: string[] = [];
  if (ev.description) bits.push(ev.description.slice(0, 20));
  else if (ev.proteinG !== undefined) bits.push(`${ev.proteinG}g protein`);
  const name = ev.mealName ?? 'meal';
  return bits.length > 0 ? `${name} · ${bits[0]}` : name;
}
