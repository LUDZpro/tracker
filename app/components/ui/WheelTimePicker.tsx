'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { shiftDateKey, wallDateKey, wallParts, withWallDate, withWallTime } from '@/lib/time';
import styles from './ui.module.css';

const ITEM_H = 44; // px per row, 3 rows visible
const COPIES = 3; // middle copy is "home"; edges teleport back for infinite loop
const SETTLE_MS = 120;

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const pad2 = (n: number) => String(n).padStart(2, '0');

interface WheelProps {
  count: number; // 24 for hours, 60 for minutes
  value: number;
  onPick: (v: number) => void;
  label: string;
  disabled?: boolean;
}

/**
 * One scroll wheel: native overflow scrolling with CSS snap (no custom
 * momentum physics), looped by rendering three copies of the values and
 * teleporting back to the middle copy after the scroll settles.
 */
function Wheel({ count, value, onPick, label, disabled }: WheelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToIndex = useCallback((idx: number, smooth = false) => {
    ref.current?.scrollTo({ top: idx * ITEM_H, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Keep the wheel on the external value (mount, input-mode confirm, day flip) —
  // but never while a gesture is settling, or we'd fight the user's scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el || settleTimer.current) return;
    const idx = Math.round(el.scrollTop / ITEM_H);
    const centered = idx >= count && idx < 2 * count && idx % count === value;
    if (!centered) scrollToIndex(count + value);
  }, [value, count, scrollToIndex]);

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  // Idempotent settle: programmatic scrolls (mount, sync, teleport) always
  // land on the current value, so only a user flick produces v !== value.
  const onScroll = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null; // gesture over — sync effect may act again
      const el = ref.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / ITEM_H);
      const v = ((idx % count) + count) % count;
      // Teleport from an edge copy back to the middle one (same value, invisible).
      if (idx < count || idx >= 2 * count) {
        el.scrollTo({ top: (count + v) * ITEM_H });
      }
      if (v !== value) {
        navigator.vibrate?.(20);
        onPick(v);
      }
    }, SETTLE_MS);
  };

  const step = (delta: number) => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;
    scrollToIndex(Math.round(el.scrollTop / ITEM_H) + delta, true);
    navigator.vibrate?.(20);
    onPick((((value + delta) % count) + count) % count);
  };

  return (
    <div className={styles.wheelCol}>
      <button
        type="button"
        className={styles.wheelArrow}
        aria-label={`${label} up`}
        disabled={disabled}
        onClick={() => step(-1)}
      >
        ▲
      </button>
      <div className={styles.wheelWindow}>
        <div
          ref={ref}
          className={styles.wheel}
          role="listbox"
          aria-label={label}
          onScroll={disabled ? undefined : onScroll}
          style={disabled ? { overflow: 'hidden' } : undefined}
        >
          {range(COPIES * count).map((i) => {
            const v = i % count;
            return (
              <div
                key={i}
                className={`${styles.wheelItem} num ${v === value ? styles.wheelItemActive : ''}`}
                role="option"
                aria-selected={v === value}
                onClick={() => !disabled && step(shortestStep(value, v, count))}
              >
                {pad2(v)}
              </div>
            );
          })}
        </div>
        <div className={styles.wheelMask} aria-hidden />
      </div>
      <button
        type="button"
        className={styles.wheelArrow}
        aria-label={`${label} down`}
        disabled={disabled}
        onClick={() => step(1)}
      >
        ▼
      </button>
    </div>
  );
}

/** Signed shortest distance v→from on a ring of `count` (for tap-a-neighbor). */
function shortestStep(from: number, to: number, count: number): number {
  const up = (to - from + count) % count;
  const down = up - count;
  return up <= -down ? up : down;
}

interface Props {
  valueIso: string;
  onChange: (iso: string) => void;
  nowIso: string;
  disabled?: boolean;
  /** Show a day toggle (previous day ↔ value's day) for times that may cross midnight. */
  allowPrevDay?: boolean;
  /** Accent for the selected value, e.g. 'var(--intake)'. */
  accent?: string;
}

/**
 * Scroll-wheel time picker (UX-PATCH-03): hour + minute wheels with an
 * input-mode fallback for typing the exact time. Always 24h, always exact.
 */
export default function WheelTimePicker({
  valueIso,
  onChange,
  nowIso,
  disabled,
  allowPrevDay,
  accent = 'var(--sleep)',
}: Props) {
  const parts = wallParts(valueIso);
  const hour = parts?.hour ?? 0;
  const minute = parts?.minute ?? 0;

  // Picks fire from debounced scroll timers, possibly two in one tick with no
  // re-render between. Compose on a ref and update it eagerly so one wheel's
  // pick can never clobber or drop the other's.
  const isoRef = useRef(valueIso);
  isoRef.current = valueIso;
  const pick = (part: 'hour' | 'minute') => (v: number) => {
    const p = wallParts(isoRef.current);
    isoRef.current = withWallTime(
      isoRef.current,
      part === 'hour' ? v : (p?.hour ?? 0),
      part === 'minute' ? v : (p?.minute ?? 0),
    );
    onChange(isoRef.current);
  };
  const pickHour = pick('hour');
  const pickMinute = pick('minute');

  const [inputMode, setInputMode] = useState(false);
  const [hhText, setHhText] = useState(pad2(hour));
  const [mmText, setMmText] = useState(pad2(minute));

  const valueKey = wallDateKey(valueIso);
  const todayKey = wallDateKey(nowIso);
  const dayLabel = (key: string) =>
    key === todayKey ? 'today' : key === shiftDateKey(todayKey, -1) ? 'yesterday' : key;
  // The reachable days: the value's own day and (optionally) the one before.
  const anchorKey = valueKey === shiftDateKey(todayKey, -1) && allowPrevDay ? todayKey : valueKey;
  const dayKeys = allowPrevDay ? [shiftDateKey(anchorKey, -1), anchorKey] : [valueKey];

  const openInput = () => {
    if (disabled) return;
    setHhText(pad2(hour));
    setMmText(pad2(minute));
    setInputMode(true);
  };

  const confirmInput = () => {
    // Clamp instead of reject: 25→23, 75→59 (acceptance §4.6).
    const h = Math.min(23, Math.max(0, parseInt(hhText, 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(mmText, 10) || 0));
    onChange(withWallTime(valueIso, h, m));
    setInputMode(false);
    navigator.vibrate?.(20);
  };

  return (
    <div className={styles.picker} style={{ '--wheel-accent': accent } as React.CSSProperties}>
      {allowPrevDay && dayKeys.length === 2 && (
        <div className={styles.dayRow} role="group" aria-label="Day">
          {dayKeys.map((key) => (
            <button
              key={key}
              type="button"
              className="chip"
              aria-pressed={key === valueKey}
              disabled={disabled}
              onClick={() => key !== valueKey && onChange(withWallDate(valueIso, key))}
            >
              {dayLabel(key)}
            </button>
          ))}
        </div>
      )}

      {inputMode ? (
        <div className={styles.inputRow}>
          <input
            className={`${styles.timeInput} num`}
            type="number"
            inputMode="numeric"
            min={0}
            max={23}
            value={hhText}
            onChange={(e) => setHhText(e.target.value.slice(0, 2))}
            aria-label="Hours"
            autoFocus
          />
          <span className={styles.inputColon}>:</span>
          <input
            className={`${styles.timeInput} num`}
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            value={mmText}
            onChange={(e) => setMmText(e.target.value.slice(0, 2))}
            aria-label="Minutes"
          />
          <div className={styles.inputActions}>
            <button type="button" className="chip" onClick={confirmInput}>
              ok
            </button>
            <button type="button" className="chip" onClick={() => setInputMode(false)}>
              cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.wheelRow}>
          <Wheel count={24} value={hour} label="Hours" disabled={disabled} onPick={pickHour} />
          <span className={styles.wheelColon} aria-hidden>
            :
          </span>
          <Wheel
            count={60}
            value={minute}
            label="Minutes"
            disabled={disabled}
            onPick={pickMinute}
          />
        </div>
      )}

      {!inputMode && (
        <button type="button" className={styles.inputToggle} onClick={openInput} disabled={disabled}>
          <span className="num">
            {pad2(hour)}:{pad2(minute)}
          </span>{' '}
          <small>{dayLabel(valueKey)} · tap to type</small>
        </button>
      )}
    </div>
  );
}
