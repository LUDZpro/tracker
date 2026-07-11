import type { AppEvent } from '@/lib/types';

/** One source of truth for how an event looks anywhere on Home. */

export const COLOR_BY_CATEGORY: Record<AppEvent['category'], string> = {
  marker: 'var(--sleep)',
  action: 'var(--sleep-dim)',
  intake: 'var(--intake)',
  state: 'var(--state)',
};

const ICON_BY_TYPE: Record<AppEvent['type'], string> = {
  wake_up: '☀',
  sleep_start: '☾',
  nap: '◔',
  caffeine: '☕',
  mood: '◐',
  energy: '◑',
};

export function eventIcon(ev: AppEvent): string {
  return ICON_BY_TYPE[ev.type];
}

/** "type · the one distinguishing value" per the row contract. */
export function eventSummary(ev: AppEvent): string {
  switch (ev.type) {
    case 'wake_up':
      return 'woke up';
    case 'sleep_start':
      return 'went to sleep';
    case 'nap':
      return ev.duration !== undefined ? `nap · ${ev.duration}min` : 'nap';
    case 'caffeine':
      return ev.kind ? `caffeine · ${ev.kind}` : 'caffeine';
    case 'mood':
    case 'energy':
      return ev.intensity !== undefined ? `${ev.type} · ${ev.intensity}/5` : ev.type;
  }
}

/** Precision badge text; empty when exact (badge only when fuzzy). */
export function precisionBadge(ev: AppEvent): string {
  return ev.precision === 'exact' ? '' : ev.precision.replace(/_/g, ' ');
}
