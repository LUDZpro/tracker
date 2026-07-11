'use client';

import { useState } from 'react';
import Sheet from './Sheet';
import WheelTimePicker from '@/components/ui/WheelTimePicker';
import { COLOR_BY_CATEGORY, eventSummary } from '@/components/home/eventPresentation';
import { patchEvent } from '@/lib/client/api';
import { CAFFEINE_KINDS, type AppEvent, type EventPatch } from '@/lib/types';
import styles from './sheets.module.css';

const NAP_PRESETS = [20, 45, 90] as const;
const NAP_STEP = 5;
const NAP_MAX = 600;

interface Props {
  event: AppEvent;
  nowIso: string;
  onClose: () => void;
  onSaved: () => void;
  onDelete: (ev: AppEvent) => void;
}

/** Tap-a-row sheet: wheel time picker + the event's own options + Delete. */
export default function EditEventSheet({ event, nowIso, onClose, onSaved, onDelete }: Props) {
  const readOnly = event.editable === false;
  const [occurredAt, setOccurredAt] = useState(event.occurredAt);
  const [kind, setKind] = useState(event.kind);
  const [intensity, setIntensity] = useState(event.intensity);
  const [duration, setDuration] = useState(event.duration ?? 45);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const timeChanged = occurredAt !== event.occurredAt;
  const patch: EventPatch = {
    // A picked/typed time is explicit — always exact (UX-PATCH-03 §1).
    ...(timeChanged ? { occurred_at: occurredAt, precision: 'exact' } : {}),
    ...(event.type === 'caffeine' && kind && kind !== event.kind ? { kind } : {}),
    ...((event.type === 'mood' || event.type === 'energy') &&
    intensity !== undefined &&
    intensity !== event.intensity
      ? { intensity }
      : {}),
    ...(event.type === 'nap' && duration !== event.duration ? { duration } : {}),
  };
  const dirty = Object.keys(patch).length > 0;

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    const res = await patchEvent(event.id, patch);
    setSaving(false);
    if (res.ok) {
      navigator.vibrate?.(50);
      onSaved();
      onClose();
    } else {
      setError(res.message);
    }
  };

  return (
    <Sheet title={eventSummary(event)} onClose={onClose}>
      {readOnly && (
        <p className={styles.readOnlyNotice}>Older than 48h — read-only.</p>
      )}

      <WheelTimePicker
        valueIso={occurredAt}
        onChange={setOccurredAt}
        nowIso={nowIso}
        disabled={readOnly}
        allowPrevDay={event.category === 'marker'}
        accent={COLOR_BY_CATEGORY[event.category]}
      />

      {event.type === 'caffeine' && (
        <div className={styles.chipRow}>
          {CAFFEINE_KINDS.map((k) => (
            <button
              key={k}
              className={`chip ${styles.bigChip}`}
              aria-pressed={kind === k}
              disabled={readOnly}
              onClick={() => setKind(k)}
            >
              {k}
            </button>
          ))}
        </div>
      )}

      {(event.type === 'mood' || event.type === 'energy') && (
        <div className={styles.scaleRow} role="group" aria-label={`${event.type} 1 to 5`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={styles.scaleBtn}
              aria-pressed={intensity === n}
              disabled={readOnly}
              onClick={() => setIntensity(n)}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {event.type === 'nap' && (
        <>
          <div className={styles.chipRow}>
            {NAP_PRESETS.map((m) => (
              <button
                key={m}
                className={`chip ${styles.bigChip}`}
                aria-pressed={duration === m}
                disabled={readOnly}
                onClick={() => setDuration(m)}
              >
                {m}min
              </button>
            ))}
          </div>
          <div className={styles.stepper}>
            <button
              disabled={readOnly}
              onClick={() => setDuration((d) => Math.max(NAP_STEP, d - NAP_STEP))}
              aria-label="Less"
            >
              −
            </button>
            <span className={styles.stepperValue}>{duration}min</span>
            <button
              disabled={readOnly}
              onClick={() => setDuration((d) => Math.min(NAP_MAX, d + NAP_STEP))}
              aria-label="More"
            >
              +
            </button>
          </div>
        </>
      )}

      {error && <p className="error-inline">{error}</p>}

      {!readOnly && (
        <div className={styles.editFooter}>
          <button
            className={styles.deleteBtn}
            onClick={() => {
              onDelete(event);
              onClose();
            }}
          >
            Delete
          </button>
          <button className={styles.logBtn} onClick={save} disabled={!dirty || saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </Sheet>
  );
}
