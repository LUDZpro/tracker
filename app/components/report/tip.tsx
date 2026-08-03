'use client';

/**
 * Hover/focus tooltips for the report charts.
 *
 * The charts previously relied on SVG <title>, which the browser renders
 * after a delay, in its own styling, and never for keyboard users. These are
 * positioned from the hovered element's own box rather than the pointer, so
 * the tip does not jitter under the cursor and lands in the same place when
 * the element is reached by Tab instead of a mouse.
 */
import { useCallback, useRef, useState } from 'react';
import styles from './report.module.css';

export interface TipRow {
  k: string;
  v: string;
}

interface TipState {
  x: number;
  y: number;
  title: string;
  rows: TipRow[];
}

/** Keeps the tip inside the plot instead of letting it run off the edge. */
const EDGE_PAD = 74;

export function useTip() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState | null>(null);

  const show = useCallback(
    (event: { currentTarget: Element }, title: string, rows: TipRow[]) => {
      const host = hostRef.current;
      if (!host) return;
      const hostBox = host.getBoundingClientRect();
      const box = event.currentTarget.getBoundingClientRect();
      const x = box.left + box.width / 2 - hostBox.left;
      setTip({
        x: Math.min(Math.max(x, EDGE_PAD), Math.max(EDGE_PAD, hostBox.width - EDGE_PAD)),
        y: box.top - hostBox.top,
        title,
        rows,
      });
    },
    [],
  );

  const hide = useCallback(() => setTip(null), []);

  /**
   * Spread onto any SVG shape to give it a tip.
   *
   * The hover pair is over/out rather than enter/leave: Chrome sets
   * `activeElement` on a tabindexed SVG shape but dispatches no focus event
   * for it, and React's enter/leave synthesis is built on the same
   * delegation, so enter/focus never reached these shapes at all. over/out
   * is delegated normally and does. The shapes have no children, so the
   * usual reason to prefer enter/leave does not apply here.
   *
   * `aria-label` stays so assistive tech reads the same numbers the tip
   * shows, even though the visual tip is pointer-driven.
   */
  const bind = useCallback(
    (title: string, rows: TipRow[]) => ({
      role: 'img',
      'aria-label': `${title}. ${rows.map((r) => `${r.k} ${r.v}`).join(', ')}`,
      onMouseOver: (e: React.MouseEvent<Element>) => show(e, title, rows),
      onMouseOut: hide,
      onFocus: (e: React.FocusEvent<Element>) => show(e, title, rows),
      onBlur: hide,
    }),
    [show, hide],
  );

  return { hostRef, tip, bind, hide };
}

interface ChartFrameProps {
  hostRef: React.RefObject<HTMLDivElement | null>;
  tip: TipState | null;
  onLeave: () => void;
  children: React.ReactNode;
}

/** Positioned wrapper that renders a chart and its floating tip. */
export function ChartFrame({ hostRef, tip, onLeave, children }: ChartFrameProps) {
  return (
    <div className={styles.plot} ref={hostRef} onMouseLeave={onLeave}>
      {children}
      {tip ? (
        <div className={styles.tip} style={{ left: tip.x, top: tip.y }} role="status">
          <div className={styles.tipTitle}>{tip.title}</div>
          {tip.rows.map((r) => (
            <div key={r.k} className={styles.tipRow}>
              <span>{r.k}</span>
              <b>{r.v}</b>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
