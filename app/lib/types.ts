export type Category = 'marker' | 'action' | 'intake' | 'state';

export type EventType =
  | 'wake_up'
  | 'sleep_start'
  | 'nap'
  | 'caffeine'
  | 'mood'
  | 'energy';

export type Precision = 'exact' | '~5min' | '~hour' | '~part_of_day';

export type CaffeineKind = 'coffee' | 'tea' | 'energy' | 'other';

export const CATEGORY_BY_TYPE: Record<EventType, Category> = {
  wake_up: 'marker',
  sleep_start: 'marker',
  nap: 'action',
  caffeine: 'intake',
  mood: 'state',
  energy: 'state',
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

/** Payload accepted by POST /api/event (client → server). */
export interface EventPayload {
  type: EventType;
  occurred_at: string; // ISO 8601 with timezone offset
  precision: Precision;
  duration?: number; // minutes, nap only
  intensity?: number; // 1–5, mood/energy only
  kind?: CaffeineKind; // caffeine only
  scope?: string; // mood/energy only, defaults to "momentary"
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
  editable?: boolean; // set by /api/today (48h rule) so the client doesn't guess
}

/** Fields accepted by PATCH /api/event/[id] (client → server). */
export interface EventPatch {
  occurred_at?: string;
  precision?: Precision;
  kind?: CaffeineKind;
  intensity?: number;
  duration?: number;
}

export interface SleepPair {
  start: AppEvent;
  end: AppEvent;
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
