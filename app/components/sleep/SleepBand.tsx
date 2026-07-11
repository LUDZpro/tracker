'use client';

import { useRef, useState } from 'react';
import { toLocalISO, wallHHMM, wallMinutes } from '@/lib/time';
import type { AppEvent } from '@/lib/types';
import styles from './sleep.module.css';

/** Axis runs 20:00 → 14:00 next day (18 hours). */
const AXIS_MIN = 18 * 60;
const W = 1000;
const H = 130;
const TRACK_Y = 40;
const TRACK_H = 44;
const SNAP_MIN = 5;

function axisPos(iso: string): number {
  const m = wallMinutes(iso);
  const rel = m >= 20 * 60 ? m - 20 * 60 : m + 4 * 60;
  return Math.max(0, Math.min(AXIS_MIN, rel));
}

function x(min: number): number {
  return (min / AXIS_MIN) * W;
}

interface Props {
  start: AppEvent | null;
  end: AppEvent | null;
  editable: boolean;
  onMove: (event: AppEvent, newIso: string) => Promise<{ ok: boolean; message?: string }>;
  /** Tap (no drag) on a handle — opens the wheel picker (UX-PATCH-03). */
  onTapHandle?: (event: AppEvent) => void;
}

/** Last night's sleep band with draggable ends (5-minute snap). */
export default function SleepBand({ start, end, editable, onMove, onTapHandle }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ which: 'start' | 'end'; fromX: number } | null>(null);
  const [delta, setDelta] = useState<{ which: 'start' | 'end'; min: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!start && !end) {
    return <p className={styles.bandEmpty}>No sleep logged yet for last night.</p>;
  }

  const shifted = (ev: AppEvent, min: number) =>
    toLocalISO(new Date(Date.parse(ev.occurredAt) + min * 60_000));

  const liveIso = (which: 'start' | 'end'): string | null => {
    const ev = which === 'start' ? start : end;
    if (!ev) return null;
    return delta?.which === which ? shifted(ev, delta.min) : ev.occurredAt;
  };

  const toMinutes = (clientDx: number): number => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const raw = (clientDx / rect.width) * AXIS_MIN;
    return Math.round(raw / SNAP_MIN) * SNAP_MIN;
  };

  const onPointerDown = (which: 'start' | 'end') => (e: React.PointerEvent) => {
    if (!editable || busy) return;
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      // capture is best-effort; a tap still resolves without it
    }
    drag.current = { which, fromX: e.clientX };
    setError(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setDelta({ which: drag.current.which, min: toMinutes(e.clientX - drag.current.fromX) });
  };

  const onPointerUp = async () => {
    const which = drag.current?.which;
    const d = drag.current && delta;
    drag.current = null;
    if (!d || d.min === 0) {
      setDelta(null);
      // A press without movement is a tap — open the picker instead.
      if (which && onTapHandle) {
        const ev = which === 'start' ? start : end;
        if (ev) onTapHandle(ev);
      }
      return;
    }
    const ev = d.which === 'start' ? start : end;
    if (!ev) return setDelta(null);
    setBusy(true);
    const res = await onMove(ev, shifted(ev, d.min));
    setBusy(false);
    setDelta(null);
    if (!res.ok) setError(res.message ?? 'Could not move');
  };

  const sIso = liveIso('start');
  const eIso = liveIso('end');
  const sPos = sIso ? axisPos(sIso) : 0;
  const ePos = eIso ? axisPos(eIso) : AXIS_MIN;

  return (
    <section aria-label="Last night's sleep">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className={styles.bandSvg}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <rect x="0" y={TRACK_Y} width={W} height={TRACK_H} rx="8" className={styles.bandTrack} />
        {[20, 23, 2, 5, 8, 11, 14].map((h, i) => {
          const min = i * 3 * 60;
          return (
            <text
              key={h}
              x={x(min)}
              y={H - 10}
              className={styles.bandLabel}
              textAnchor={min === 0 ? 'start' : min === AXIS_MIN ? 'end' : 'middle'}
            >
              {String(h).padStart(2, '0')}
            </text>
          );
        })}
        <rect
          x={x(sPos)}
          y={TRACK_Y}
          width={Math.max(x(ePos) - x(sPos), 6)}
          height={TRACK_H}
          rx="8"
          className={styles.bandFill}
          opacity={!sIso || !eIso ? 0.45 : 1}
        />
        {sIso && start && (
          <g
            className={editable ? styles.handle : undefined}
            onPointerDown={onPointerDown('start')}
          >
            <rect x={x(sPos) - 32} y={TRACK_Y - 12} width="64" height={TRACK_H + 24} fill="transparent" />
            <circle cx={x(sPos)} cy={TRACK_Y + TRACK_H / 2} r="16" className={styles.handleDot} />
          </g>
        )}
        {eIso && end && (
          <g className={editable ? styles.handle : undefined} onPointerDown={onPointerDown('end')}>
            <rect x={x(ePos) - 32} y={TRACK_Y - 12} width="64" height={TRACK_H + 24} fill="transparent" />
            <circle cx={x(ePos)} cy={TRACK_Y + TRACK_H / 2} r="16" className={styles.handleDot} />
          </g>
        )}
      </svg>
      <p className={styles.bandReadout}>
        <time>{sIso ? wallHHMM(sIso) : '—'}</time>
        <span aria-hidden> → </span>
        <time>{eIso ? wallHHMM(eIso) : '—'}</time>
        {!editable && <small> · older than 48h, locked</small>}
        {busy && <small> · saving…</small>}
      </p>
      {error && (
        <p className="error-inline">
          {error}
          <button onClick={() => setError(null)}>dismiss</button>
        </p>
      )}
    </section>
  );
}
