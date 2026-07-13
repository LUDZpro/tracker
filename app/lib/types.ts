export type Category = 'marker' | 'action' | 'intake' | 'state';

export type EventType =
  | 'wake_up'
  | 'sleep_start'
  | 'nap'
  | 'caffeine'
  | 'mood'
  | 'energy'
  | 'meal'
  | 'gym-session';

export type Precision = 'exact' | '~5min' | '~hour' | '~part_of_day';

export type CaffeineKind = 'coffee' | 'tea' | 'energy' | 'other';

export type MealPreset = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

export type ExerciseUnit = 'kg' | 'lb';

/** One exercise row within a gym session. Every field is optional. */
export interface ExerciseRow {
  name?: string;
  sets?: number;
  weight?: number;
  unit?: ExerciseUnit;
}

export const CATEGORY_BY_TYPE: Record<EventType, Category> = {
  wake_up: 'marker',
  sleep_start: 'marker',
  nap: 'action',
  caffeine: 'intake',
  mood: 'state',
  energy: 'state',
  meal: 'action',
  'gym-session': 'action',
};

export const PRECISIONS: readonly Precision[] = [
  'exact',
  '~5min',
  '~hour',
  '~part_of_day',
];

export const CAFFEINE_KINDS: readonly CaffeineKind[] = [
  'coffee',
  'tea',
  'energy',
  'other',
];

export const MEAL_PRESETS: readonly MealPreset[] = [
  'Breakfast',
  'Lunch',
  'Dinner',
  'Snack',
];

export const EXERCISE_UNITS: readonly ExerciseUnit[] = ['kg', 'lb'];

/** Payload accepted by POST /api/event (client → server). */
export interface EventPayload {
  type: EventType;
  occurred_at: string; // ISO 8601 with timezone offset
  precision: Precision;
  duration?: number; // minutes, nap only
  intensity?: number; // 1–5, mood/energy only
  kind?: CaffeineKind; // caffeine only
  scope?: string; // mood/energy only, defaults to "momentary"
  mealName?: string; // meal only, required
  description?: string; // meal only
  proteinG?: number; // meal only
  calories?: number; // meal only
  sessionDuration?: number; // gym-session only, minutes
  exercises?: ExerciseRow[]; // gym-session only
}

/** An event as read back from Notion. */
export interface AppEvent {
  id: string;
  type: EventType;
  category: Category;
  occurredAt: string;
  precision: Precision;
  duration?: number;
  intensity?: number;
  kind?: CaffeineKind; // caffeine only, parsed back from the title
  mealName?: string; // meal only, parsed back from the title
  description?: string; // meal only
  proteinG?: number; // meal only
  calories?: number; // meal only
  sessionDuration?: number; // gym-session only, minutes
  exercises?: ExerciseRow[]; // gym-session only
  editable?: boolean; // set by /api/today (48h rule) so the client doesn't guess
}

/** Fields accepted by PATCH /api/event/[id] (client → server). */
export interface EventPatch {
  occurred_at?: string;
  precision?: Precision;
  kind?: CaffeineKind;
  intensity?: number;
  duration?: number;
  mealName?: string;
  description?: string;
  proteinG?: number;
  calories?: number;
  sessionDuration?: number;
  exercises?: ExerciseRow[];
}

export interface SleepPair {
  start: AppEvent;
  end: AppEvent;
}

/** Response shape for GET /api/history (Nutrition/Gym — calendar-day paged). */
export interface HistoryResponse {
  events: AppEvent[];
  nextCursor: string | null; // pass as `before` for the next page; null = no more
}

/** Response shape for GET /api/week (desktop goal cards + 7-day column). */
export interface WeekResponse {
  now: string;
  /** All event types, last ~8 calendar days (one spare day so the oldest
   *  night's sleep_start can pair with its wake_up). Ascending order. */
  events: AppEvent[];
}

export interface TodayResponse {
  now: string;
  state: 'awake' | 'asleep';
  events: AppEvent[];
  last_sleep: { start: AppEvent | null; end: AppEvent | null };
  missing_nights: string[];
  offset: number; // wake-windows back from now (0 = current)
  axis_date: string; // wall date (YYYY-MM-DD) the 24h strip should draw
}
