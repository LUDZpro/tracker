import type { AppEvent, CaffeineKind, EventType } from '@/lib/types';

/** One source of truth for how an event looks on the desktop surface. */

export type Tone = 'sleep' | 'intake' | 'meal' | 'gym' | 'state';

export const TONE_VAR: Record<Tone, string> = {
  sleep: 'var(--accent)',
  intake: 'var(--warn)',
  meal: 'var(--ok)',
  gym: 'var(--bad)',
  state: 'var(--cyan)',
};

const TONE_BY_TYPE: Record<EventType, Tone> = {
  wake_up: 'sleep',
  sleep_start: 'sleep',
  nap: 'sleep',
  caffeine: 'intake',
  meal: 'meal',
  'gym-session': 'gym',
  mood: 'state',
  energy: 'state',
  trigger: 'state',
};

export function toneFor(type: EventType): Tone {
  return TONE_BY_TYPE[type];
}

type IconName =
  | 'wake'
  | 'sleep'
  | 'nap'
  | 'coffee'
  | 'tea'
  | 'bolt'
  | 'meal'
  | 'gym'
  | 'mood'
  | 'energy'
  | 'clock'
  | 'list'
  | 'trigger'
  | 'report'
  | 'mind';

const ICON_BODY: Record<IconName, React.ReactNode> = {
  wake: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  sleep: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  nap: (
    <>
      <path d="M14 12.5A6.5 6.5 0 1 1 7 5.5a5 5 0 0 0 7 7Z" />
      <path d="M16 4h4l-4 4h4" />
    </>
  ),
  coffee: (
    <>
      <path d="M17 8h1a3 3 0 0 1 0 6h-1" />
      <path d="M3 8h14v5a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8Z" />
    </>
  ),
  tea: <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z" />,
  bolt: <path d="M13 2 3 14h7l-1 8 11-14h-8l1-6Z" />,
  meal: (
    <>
      <path d="M7 3v7a2 2 0 0 0 4 0V3" />
      <path d="M9 3v18" />
      <path d="M17 3c-1.5 2-2 4-2 7h2v11" />
    </>
  ),
  gym: <path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11" />,
  mood: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
    </>
  ),
  energy: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  list: <path d="M4 6h16M4 12h16M4 18h10" />,
  report: (
    <>
      <path d="M4 20V4h11l5 5v11z" />
      <path d="M8 17v-4M12 17v-7M16 17v-2" />
    </>
  ),
  trigger: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4c3-1.6 6 1.6 9 0s5 0 5 0v9s-2-1.6-5 0-6-1.6-9 0" />
    </>
  ),
  mind: (
    <>
      <path d="M12 3a7 7 0 0 1 7 7c0 2.4-1.2 4-2.4 5.4L16 21h-6l-.4-3H8a2 2 0 0 1-2-2v-2H4.5l1.7-3.4A7 7 0 0 1 12 3Z" />
      <path d="M10.5 9.5c.4-1 1.6-1.5 2.6-1" />
    </>
  ),
};

const CAFFEINE_ICON: Record<CaffeineKind, IconName> = {
  coffee: 'coffee',
  tea: 'tea',
  energy: 'bolt',
  other: 'coffee',
};

function iconNameFor(type: EventType, kind?: CaffeineKind): IconName {
  switch (type) {
    case 'wake_up':
      return 'wake';
    case 'sleep_start':
      return 'sleep';
    case 'nap':
      return 'nap';
    case 'caffeine':
      return CAFFEINE_ICON[kind ?? 'other'];
    case 'meal':
      return 'meal';
    case 'gym-session':
      return 'gym';
    case 'mood':
      return 'mood';
    case 'energy':
      return 'energy';
    case 'trigger':
      return 'trigger';
  }
}

interface IconProps {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 17 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICON_BODY[name]}
    </svg>
  );
}

export function EventIcon({ ev, size = 12 }: { ev: Pick<AppEvent, 'type' | 'kind'>; size?: number }) {
  return <Icon name={iconNameFor(ev.type, ev.kind)} size={size} />;
}

const KIND_LABEL: Record<CaffeineKind, string> = {
  coffee: 'Coffee',
  tea: 'Tea',
  energy: 'Energy drink',
  other: 'Caffeine',
};

export interface RowText {
  main: string;
  meta?: string;
  value?: string;
}

/** Ledger row copy: main text, dimmed meta, right-aligned value. */
export function rowText(ev: AppEvent): RowText {
  switch (ev.type) {
    case 'wake_up':
      return { main: 'Wake' };
    case 'sleep_start':
      return { main: 'Sleep' };
    case 'nap':
      return { main: 'Nap', ...(ev.duration !== undefined ? { value: `${ev.duration} min` } : {}) };
    case 'caffeine':
      return { main: KIND_LABEL[ev.kind ?? 'other'] };
    case 'meal': {
      const parts = [
        ev.proteinG !== undefined ? `${ev.proteinG} g` : null,
        ev.calories !== undefined ? `${ev.calories}` : null,
      ].filter((p): p is string => p !== null);
      return {
        main: ev.mealName ?? 'Meal',
        ...(ev.description ? { meta: ev.description } : {}),
        ...(parts.length > 0 ? { value: parts.join(' · ') } : {}),
      };
    }
    case 'gym-session': {
      const n = ev.exercises?.length ?? 0;
      return {
        main: ev.sessionDuration !== undefined ? `Gym · ${ev.sessionDuration} min` : 'Gym',
        ...(n > 0 ? { meta: `${n} exercise${n === 1 ? '' : 's'}` } : {}),
      };
    }
    case 'mood':
    case 'energy': {
      const label = ev.type === 'mood' ? 'Mood' : 'Energy';
      return { main: ev.intensity !== undefined ? `${label} · ${ev.intensity}/5` : label };
    }
    case 'trigger':
      return { main: 'Trigger', meta: 'thought record' };
  }
}
