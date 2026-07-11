'use client';

import { useLongPress } from '@/hooks/useLongPress';
import styles from './home.module.css';

export type SheetKind = 'caffeine' | 'nap' | 'mood' | 'energy';

const ACTIONS: { kind: SheetKind; label: string; accent: string }[] = [
  { kind: 'caffeine', label: 'Caffeine', accent: 'var(--intake)' },
  { kind: 'nap', label: 'Nap', accent: 'var(--sleep)' },
  { kind: 'mood', label: 'Mood', accent: 'var(--state)' },
  { kind: 'energy', label: 'Energy', accent: 'var(--state)' },
];

interface Props {
  /** withTime: long-press — open the sheet with the time picker expanded. */
  onOpen: (k: SheetKind, withTime: boolean) => void;
}

function GridButton({
  kind,
  label,
  accent,
  onOpen,
}: (typeof ACTIONS)[number] & Pick<Props, 'onOpen'>) {
  const { guard, handlers } = useLongPress(() => onOpen(kind, true));
  return (
    <button
      className={`${styles.gridBtn} btn-flash`}
      style={{ '--accent': accent } as React.CSSProperties}
      {...handlers}
      onClick={guard(() => onOpen(kind, false))}
    >
      <span className={styles.gridDot} aria-hidden />
      {label}
    </button>
  );
}

export default function ActionGrid({ onOpen }: Props) {
  return (
    <section className={styles.grid} aria-label="Log an event">
      {ACTIONS.map((a) => (
        <GridButton key={a.kind} {...a} onOpen={onOpen} />
      ))}
    </section>
  );
}
