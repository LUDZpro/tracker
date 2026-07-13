'use client';

import { useState } from 'react';
import { Icon } from './presentation';
import { useLongPress } from '@/hooks/useLongPress';
import { toLocalISO, wallHHMM } from '@/lib/time';
import type { AppEvent, CaffeineKind, EventPayload } from '@/lib/types';
import styles from './desktop.module.css';

/** Sheets the desktop capture column can open. */
export type DesktopSheet =
  | 'wake'
  | 'sleep'
  | 'coffee'
  | 'tea'
  | 'energy-drink'
  | 'nap'
  | 'meal'
  | 'gym';

interface CaptureDef {
  sheet: DesktopSheet;
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
  kbd: string;
  /** Payload for hold-to-log-now; null means holding opens the sheet instead
   *  (meal needs a name, gym deserves its editor). */
  holdPayload: (() => EventPayload) | null;
}

const nowIso = () => toLocalISO(new Date());

const caffeine = (kind: CaffeineKind) => (): EventPayload => ({
  type: 'caffeine',
  occurred_at: nowIso(),
  precision: 'exact',
  kind,
});

const CAPTURES: CaptureDef[] = [
  {
    sheet: 'wake',
    label: 'Wake',
    icon: 'wake',
    kbd: 'W',
    holdPayload: () => ({ type: 'wake_up', occurred_at: nowIso(), precision: 'exact' }),
  },
  {
    sheet: 'sleep',
    label: 'Sleep',
    icon: 'sleep',
    kbd: 'S',
    holdPayload: () => ({ type: 'sleep_start', occurred_at: nowIso(), precision: 'exact' }),
  },
  { sheet: 'coffee', label: 'Coffee', icon: 'coffee', kbd: 'C', holdPayload: caffeine('coffee') },
  { sheet: 'tea', label: 'Tea', icon: 'tea', kbd: 'T', holdPayload: caffeine('tea') },
  {
    sheet: 'energy-drink',
    label: 'Energy drink',
    icon: 'bolt',
    kbd: 'E',
    holdPayload: caffeine('energy'),
  },
  {
    sheet: 'nap',
    label: 'Nap',
    icon: 'nap',
    kbd: 'N',
    holdPayload: () => ({ type: 'nap', occurred_at: nowIso(), precision: 'exact' }),
  },
  { sheet: 'meal', label: 'Meal', icon: 'meal', kbd: 'M', holdPayload: null },
  { sheet: 'gym', label: 'Gym', icon: 'gym', kbd: 'G', holdPayload: null },
];

export const KEY_TO_SHEET: Record<string, DesktopSheet> = Object.fromEntries(
  CAPTURES.map((c) => [c.kbd, c.sheet]),
);

/** "×3 · 19:15"-style per-button recap of what's already logged today. */
function metaFor(def: CaptureDef, todayEvents: AppEvent[]): string | null {
  const match = (e: AppEvent): boolean => {
    switch (def.sheet) {
      case 'wake':
        return e.type === 'wake_up';
      case 'sleep':
        return e.type === 'sleep_start';
      case 'coffee':
        return e.type === 'caffeine' && e.kind === 'coffee';
      case 'tea':
        return e.type === 'caffeine' && e.kind === 'tea';
      case 'energy-drink':
        return e.type === 'caffeine' && e.kind === 'energy';
      case 'nap':
        return e.type === 'nap';
      case 'meal':
        return e.type === 'meal';
      case 'gym':
        return e.type === 'gym-session';
    }
  };
  const hits = todayEvents
    .filter(match)
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  if (hits.length === 0) return null;
  const last = hits[hits.length - 1];
  if (def.sheet === 'meal') {
    const grams = hits.reduce((sum, e) => sum + (e.proteinG ?? 0), 0);
    return `×${hits.length} · ${grams} g`;
  }
  if (def.sheet === 'gym') {
    const mins = last.sessionDuration;
    return `${wallHHMM(last.occurredAt)}${mins !== undefined ? ` · ${mins}m` : ''}`;
  }
  if (hits.length > 1) return `×${hits.length} · ${wallHHMM(last.occurredAt)}`;
  return wallHHMM(last.occurredAt);
}

const FLASH_MS = 600;

function CaptureButton({
  def,
  meta,
  onLogNow,
  onOpenSheet,
}: {
  def: CaptureDef;
  meta: string | null;
  onLogNow: (payload: EventPayload, label: string) => void;
  onOpenSheet: (sheet: DesktopSheet) => void;
}) {
  const [holding, setHolding] = useState(false);
  const [flash, setFlash] = useState(false);

  const { guard, handlers } = useLongPress(() => {
    setHolding(false);
    if (def.holdPayload) {
      onLogNow(def.holdPayload(), def.label);
      setFlash(true);
      setTimeout(() => setFlash(false), FLASH_MS);
    } else {
      onOpenSheet(def.sheet);
    }
  });

  return (
    <button
      className={`${styles.cap} ${holding ? styles.holding : ''} ${flash ? styles.flash : ''}`}
      {...handlers}
      onPointerDown={(e) => {
        setHolding(true);
        handlers.onPointerDown(e);
      }}
      onPointerUp={() => {
        setHolding(false);
        handlers.onPointerUp();
      }}
      onPointerLeave={() => {
        setHolding(false);
        handlers.onPointerLeave();
      }}
      onClick={guard(() => onOpenSheet(def.sheet))}
    >
      <span className={styles.capFill} aria-hidden />
      <Icon name={def.icon} />
      <span className={styles.capLbl}>{def.label}</span>
      <span className={`${styles.capMeta} ${meta ? styles.capMetaHit : ''}`}>{meta ?? '—'}</span>
      <kbd>{def.kbd}</kbd>
    </button>
  );
}

interface RateRowProps {
  kind: 'mood' | 'energy';
  todayEvents: AppEvent[];
  onLogNow: (payload: EventPayload, label: string) => void;
}

function RateRow({ kind, todayEvents, onLogNow }: RateRowProps) {
  const hits = todayEvents
    .filter((e) => e.type === kind && e.intensity !== undefined)
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  const last = hits[hits.length - 1];
  const label = kind === 'mood' ? 'Mood' : 'Energy';

  return (
    <>
      <div className={styles.rlab}>
        <span>{label}</span>
        <span>{last ? `${last.intensity} · ${wallHHMM(last.occurredAt)}` : 'not logged'}</span>
      </div>
      <div className={styles.rate} role="group" aria-label={`${label} 1 to 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            aria-pressed={last?.intensity === n}
            onClick={() =>
              onLogNow(
                {
                  type: kind,
                  occurred_at: nowIso(),
                  precision: 'exact',
                  intensity: n,
                  scope: 'momentary',
                },
                `${label} ${n}/5`,
              )
            }
          >
            {n}
          </button>
        ))}
      </div>
    </>
  );
}

interface Props {
  todayEvents: AppEvent[];
  onLogNow: (payload: EventPayload, label: string) => void;
  onOpenSheet: (sheet: DesktopSheet) => void;
}

/** Left column: one-hold logging plus mood/energy quick rating. */
export default function CaptureColumn({ todayEvents, onLogNow, onOpenSheet }: Props) {
  return (
    <>
      <div className={styles.sec}>
        <span className={styles.eyebrow}>Capture</span>
        <p className={styles.hint}>click opens the control · hold to log now</p>
        {CAPTURES.map((def) => (
          <CaptureButton
            key={def.sheet}
            def={def}
            meta={metaFor(def, todayEvents)}
            onLogNow={onLogNow}
            onOpenSheet={onOpenSheet}
          />
        ))}
      </div>
      <div className={styles.sec}>
        <span className={styles.eyebrow}>Mood · Energy</span>
        <RateRow kind="mood" todayEvents={todayEvents} onLogNow={onLogNow} />
        <RateRow kind="energy" todayEvents={todayEvents} onLogNow={onLogNow} />
      </div>
    </>
  );
}
