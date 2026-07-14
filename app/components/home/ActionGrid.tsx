'use client';

import { Icon } from '@/components/desktop/presentation';
import { useLongPress } from '@/hooks/useLongPress';
import { buildSleepPairs } from '@/lib/sleep';
import { minutesBetween, toLocalISO, wallHHMM } from '@/lib/time';
import type { AppEvent, CaffeineKind, EventPayload, TodayResponse } from '@/lib/types';
import styles from './home.module.css';

export type SheetKind = 'caffeine' | 'nap' | 'mood' | 'energy' | 'meal' | 'gym' | 'wake' | 'sleep';

type QuickAction =
  | {
      id: 'wake' | 'sleep' | 'nap';
      label: string;
      icon: 'wake' | 'sleep' | 'nap';
      tone: 'sleep';
      payload: () => EventPayload;
      longPress: () => void;
    }
  | {
      id: Exclude<CaffeineKind, 'other'>;
      label: string;
      icon: 'coffee' | 'tea' | 'bolt';
      tone: 'intake';
      payload: () => EventPayload;
      longPress: () => void;
    };

const TONE_CLASS = {
  sleep: styles.capSleep,
  intake: styles.capIntake,
} as const;

const DEFAULT_NAP_MINUTES = 45;
const NAP_MAX_MINUTES = 180;

interface Props {
  /** withTime: long-press — open the sheet with the time picker expanded. */
  onOpen: (k: SheetKind, withTime: boolean, initialKind?: CaffeineKind) => void;
  onLog: (payload: EventPayload, label: string) => void;
  today: TodayResponse;
  events: AppEvent[];
}

function latestMeta(events: readonly AppEvent[], type: AppEvent['type'], kind?: CaffeineKind) {
  const matching = events
    .filter((e) => e.type === type && (kind === undefined || e.kind === kind))
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  const last = matching[matching.length - 1];
  if (!last) return '';
  if (type === 'caffeine') {
    return matching.length > 1 ? `x${matching.length} · ${wallHHMM(last.occurredAt)}` : wallHHMM(last.occurredAt);
  }
  return wallHHMM(last.occurredAt);
}

function latestNapMeta(events: readonly AppEvent[]): string {
  const pairs = buildSleepPairs(events).filter((pair) => {
    const duration = minutesBetween(pair.start.occurredAt, pair.end.occurredAt);
    return duration > 0 && duration <= NAP_MAX_MINUTES;
  });
  const last = pairs[pairs.length - 1];
  if (!last) return '';
  const duration = minutesBetween(last.start.occurredAt, last.end.occurredAt);
  return `${duration}m · ${wallHHMM(last.end.occurredAt)}`;
}

function CaptureButton({
  action,
  meta,
  onLog,
}: {
  action: QuickAction;
  meta: string;
  onLog: Props['onLog'];
}) {
  const { guard, handlers } = useLongPress(action.longPress);

  return (
    <button
      className={`${styles.cap} ${TONE_CLASS[action.tone]} btn-flash`}
      {...handlers}
      onClick={guard(() => onLog(action.payload(), action.label))}
    >
      <span className={styles.capFill} aria-hidden />
      <Icon name={action.icon} size={19} />
      <span className={styles.capLabel}>{action.label}</span>
      <span className={`${styles.capMeta} ${meta ? styles.capMetaHit : ''}`}>{meta || '-'}</span>
    </button>
  );
}

function WideButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: 'meal' | 'gym';
  onClick: () => void;
}) {
  return (
    <button className={styles.wideCap} onClick={onClick}>
      <Icon name={icon} size={17} />
      {label}
    </button>
  );
}

export default function ActionGrid({ onOpen, onLog, today, events }: Props) {
  const nowPayload = (type: EventPayload['type'], extras: Partial<EventPayload> = {}): EventPayload => ({
    type,
    occurred_at: toLocalISO(new Date()),
    precision: 'exact',
    ...extras,
  });

  const actions: QuickAction[] = [
    {
      id: 'wake',
      label: 'Wake',
      icon: 'wake',
      tone: 'sleep',
      payload: () => nowPayload('wake_up'),
      longPress: () => onOpen('wake', true),
    },
    {
      id: 'sleep',
      label: 'Sleep',
      icon: 'sleep',
      tone: 'sleep',
      payload: () => nowPayload('sleep_start'),
      longPress: () => onOpen('sleep', true),
    },
    {
      id: 'nap',
      label: 'Nap',
      icon: 'nap',
      tone: 'sleep',
      payload: () => nowPayload('nap', { duration: DEFAULT_NAP_MINUTES }),
      longPress: () => onOpen('nap', true),
    },
    {
      id: 'coffee',
      label: 'Coffee',
      icon: 'coffee',
      tone: 'intake',
      payload: () => nowPayload('caffeine', { kind: 'coffee' }),
      longPress: () => onOpen('caffeine', true, 'coffee'),
    },
    {
      id: 'tea',
      label: 'Tea',
      icon: 'tea',
      tone: 'intake',
      payload: () => nowPayload('caffeine', { kind: 'tea' }),
      longPress: () => onOpen('caffeine', true, 'tea'),
    },
    {
      id: 'energy',
      label: 'Energy',
      icon: 'bolt',
      tone: 'intake',
      payload: () => nowPayload('caffeine', { kind: 'energy' }),
      longPress: () => onOpen('caffeine', true, 'energy'),
    },
  ];

  const metaById: Record<QuickAction['id'], string> = {
    wake: today.last_sleep.end ? wallHHMM(today.last_sleep.end.occurredAt) : latestMeta(events, 'wake_up'),
    sleep: today.last_sleep.start ? wallHHMM(today.last_sleep.start.occurredAt) : latestMeta(events, 'sleep_start'),
    nap: latestNapMeta(events),
    coffee: latestMeta(events, 'caffeine', 'coffee'),
    tea: latestMeta(events, 'caffeine', 'tea'),
    energy: latestMeta(events, 'caffeine', 'energy'),
  };

  return (
    <section className={styles.captureSection} aria-label="Log an event">
      <div className={styles.qgrid}>
        {actions.map((action) => (
          <CaptureButton
            key={action.id}
            action={action}
            meta={metaById[action.id]}
            onLog={onLog}
          />
        ))}
      </div>
      <div className={styles.wideGrid}>
        <WideButton label="Meal" icon="meal" onClick={() => onOpen('meal', false)} />
        <WideButton label="Gym" icon="gym" onClick={() => onOpen('gym', false)} />
      </div>
      <p className={styles.hint}>tap logs now · hold opens time</p>
    </section>
  );
}
